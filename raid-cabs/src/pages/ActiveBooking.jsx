// ActiveBooking — Real-time booking tracker
// - User enters PIN to start ride (PIN generated at signup)
// - Real driver GPS tracking via Supabase realtime
// - Live countdown, chat, safety, cancel

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../contexts/AuthContext'
import LiveMap from '../components/LiveMap'
import SafetyPanel from '../components/SafetyPanel'
import ChatWidget from '../components/ChatWidget'
import RatingPrompt from '../components/RatingPrompt'
import { Phone, MessageSquare, ArrowLeft, CheckCircle, Clock, MapPin, Navigation, Shield, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

const CANCEL_REASONS = [
  'Driver is taking too long',
  'Booked by mistake',
  'Change of plans',
  'Found another ride',
  'Emergency',
  'Other',
]

function Stars({ v }) {
  return (
    <span style={{ display:'inline-flex', gap:1, alignItems:'center' }}>
      {[1,2,3,4,5].map(i =>
        <span key={i} style={{ fontSize:'.85rem', color: i<=Math.round(v) ? 'var(--gold)' : 'var(--tm)' }}>★</span>
      )}
      <span style={{ marginLeft:4, fontSize:'.75rem', color:'var(--ts)' }}>{Number(v).toFixed(1)}</span>
    </span>
  )
}

// ── PIN Entry Component ────────────────────────────────────────────────────
function PinEntry({ onVerified }) {
  const { profile } = useAuth()
  const [pin,       setPin]       = useState(['','','',''])
  const [error,     setError]     = useState('')
  const [verifying, setVerifying] = useState(false)
  const refs = useRef([])

  const onCell = (i, val) => {
    const v = val.replace(/\D/g,'').slice(-1)
    const n = [...pin]; n[i] = v; setPin(n)
    setError('')
    if (v && i < 3) refs.current[i+1]?.focus()
    if (v && i === 3) {
      // All 4 entered — auto-verify
      verifyPin([...n].join(''))
    }
  }

  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) refs.current[i-1]?.focus()
  }

  const onPaste = e => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,4)
    if (!p) return; e.preventDefault()
    const n = ['','','','']
    p.split('').forEach((c,i) => { n[i]=c })
    setPin(n)
    refs.current[Math.min(p.length, 3)]?.focus()
    if (p.length === 4) verifyPin(p)
  }

  const verifyPin = async (code) => {
    setVerifying(true)
    const expected = profile?.ride_code
    if (!expected) {
      setError('No ride code found. Check Profile → Safety tab.')
      setVerifying(false)
      return
    }
    if (code !== expected) {
      setError('Wrong PIN. Find your 4-digit code in Profile → Safety tab.')
      setPin(['','','',''])
      refs.current[0]?.focus()
      setVerifying(false)
      return
    }
    setError('')
    onVerified()
    setVerifying(false)
  }

  return (
    <div className="card mb3" style={{ border:'2px solid rgba(245,166,35,.3)', background:'rgba(245,166,35,.04)', textAlign:'center' }}>
      <div style={{ fontSize:'2rem', marginBottom:'.65rem' }}>🔑</div>
      <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', marginBottom:'.4rem' }}>Enter Your Ride PIN</h3>
      <p style={{ color:'var(--ts)', fontSize:'.83rem', lineHeight:1.6, marginBottom:'1.25rem' }}>
        Your driver has arrived. Enter your 4-digit Ride PIN to start the trip.
        Find it in <strong style={{ color:'var(--gold)' }}>Profile → Safety tab</strong>.
      </p>

      <div style={{ display:'flex', gap:'.6rem', justifyContent:'center', marginBottom:'1rem' }}>
        {[0,1,2,3].map(i => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={pin[i]}
            onChange={e => onCell(i, e.target.value)}
            onKeyDown={e => onKey(i, e)}
            onPaste={i===0 ? onPaste : undefined}
            autoFocus={i===0}
            style={{
              width: 56, height: 64, textAlign:'center',
              fontSize:'1.6rem', fontWeight:900,
              fontFamily:'var(--fd)', letterSpacing:'.05em',
              background: pin[i] ? 'rgba(245,166,35,.1)' : 'rgba(255,255,255,.04)',
              border: `2px solid ${pin[i] ? 'rgba(245,166,35,.6)' : 'rgba(255,255,255,.1)'}`,
              borderRadius: 12, color:'var(--tp)', outline:'none',
              transition:'all .15s',
              touchAction: 'manipulation',
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ color:'var(--red)', fontSize:'.82rem', marginBottom:'.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          ⚠ {error}
        </p>
      )}

      {verifying && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, color:'var(--green)', fontSize:'.88rem' }}>
          <span className="spinner" style={{ borderTopColor:'var(--green)', borderColor:'rgba(34,197,94,.2)' }}/> Verifying…
        </div>
      )}

      <p style={{ fontSize:'.72rem', color:'var(--tm)', marginTop:'.5rem' }}>
        This confirms you are the right passenger before the driver starts.
      </p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
const UPI_ID = import.meta.env.VITE_UPI_ID || 'raidcabs@upi'

export default function ActiveBooking() {
  const { id: paramId }  = useParams()
  const { user, profile }= useAuth()
  const navigate         = useNavigate()

  const [booking,      setBooking]    = useState(null)
  const [driver,       setDriver]     = useState(null)
  const [driverPos,    setDriverPos]  = useState(null)
  const [loading,      setLoading]    = useState(true)
  const [countdown,    setCountdown]  = useState(null)
  const [chatOpen,     setChatOpen]   = useState(false)
  const [cancelModal,  setCancelModal]= useState(false)
  const [cancelReason, setCancelR]    = useState('')
  const [cancelling,   setCancelling] = useState(false)
  const [showRating,   setShowRating] = useState(false)
  const [pinVerified,  setPinVerified]= useState(false)
  const [startingRide, setStarting]  = useState(false)

  const loadBooking = useCallback(async () => {
    if (!user) return
    let data, error

    if (paramId) {
      ({ data, error } = await supabase.from('bookings').select('*,drivers(*)').eq('id', paramId).maybeSingle())
    } else {
      // Load most recent active booking
      const res = await supabase.from('bookings')
        .select('*,drivers(*)')
        .eq('user_id', user.id)
        .in('status', ['pending_admin','confirmed','en_route','in_progress','completed'])
        .order('created_at', { ascending:false })
        .limit(1)
        .maybeSingle()
      data  = res.data
      error = res.error
    }

    if (error || !data) { navigate('/dashboard'); return }

    setBooking(data)
    setDriver(data.drivers || null)

    if (data.status === 'in_progress') setPinVerified(true) // already started

    if (data.status === 'confirmed') {
      // Use scheduled time for realistic ETA
      const minsToPickup = data.scheduled_at
        ? etaFromScheduled(data.scheduled_at)
        : parseInt(data.eta_pickup) || 10
      setCountdown(minsToPickup * 60)
    }
    if (data.status === 'completed' && !data.user_rating) setShowRating(true)
    setLoading(false)
  }, [user, paramId, navigate])

  useEffect(() => { loadBooking() }, [loadBooking])

  // ── Real-time booking status ────────────────────────────────────────────
  useEffect(() => {
    if (!booking?.id) return
    const ch = supabase.channel(`active-bk-${booking.id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'bookings', filter:`id=eq.${booking.id}` },
        ({ new: r }) => {
          setBooking(prev => ({ ...prev, ...r }))
          if (r.status === 'in_progress') {
            setPinVerified(true)
            setCountdown(null)
            toast.success('🚗 Ride started! Enjoy your trip.')
          }
          if (r.status === 'completed') {
            setCountdown(null)
            toast.success('✅ Trip completed! Rate your driver.')
            setShowRating(true)
          }
          if (r.status === 'cancelled') {
            toast.error('Booking cancelled')
            navigate('/dashboard')
          }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [booking?.id, navigate])

  // ── Real driver GPS tracking — realtime + polling fallback ──────────────
  useEffect(() => {
    if (!driver?.id) return
    let alive = true

    const fetchPos = async () => {
      const { data } = await supabase
        .from('drivers')
        .select('current_lat,current_lng,location_updated_at')
        .eq('id', driver.id)
        .maybeSingle()
      if (alive && data?.current_lat && data?.current_lng) {
        setDriverPos({ lat: parseFloat(data.current_lat), lng: parseFloat(data.current_lng) })
      }
    }

    // Fetch immediately
    fetchPos()

    // Poll every 6 seconds as fallback (works even if realtime isn't configured)
    const poll = setInterval(fetchPos, 15000) // poll every 15 seconds

    // Also subscribe to realtime for instant updates
    const ch = supabase.channel(`drv-loc-${driver.id}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'drivers',
        filter: `id=eq.${driver.id}`,
      }, ({ new: d }) => {
        if (alive && d.current_lat && d.current_lng) {
          setDriverPos({ lat: parseFloat(d.current_lat), lng: parseFloat(d.current_lng) })
        }
      })
      .subscribe()

    return () => {
      alive = false
      clearInterval(poll)
      supabase.removeChannel(ch)
    }
  }, [driver?.id])

  // ── Countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!countdown || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── PIN verified → start ride ────────────────────────────────────────────
  const handlePinVerified = async () => {
    setStarting(true)
    setPinVerified(true)
    // Update booking to in_progress
    const { error } = await q(() => supabase.from('bookings')
      .update({ status:'in_progress', started_at: new Date().toISOString() })
      .eq('id', booking.id)
    )
    if (error) {
      toast.error('Could not start ride. Try again.')
      setPinVerified(false)
      setStarting(false)
      return
    }
    // Driver's app will detect in_progress via realtime and update their view
    toast.success('🚗 Ride started! Your driver is ready.')
    setBooking(b => ({ ...b, status:'in_progress' }))
    setStarting(false)
  }

  const handleCancel = async () => {
    if (!cancelReason) { toast.error('Select a reason'); return }
    setCancelling(true)
    await Promise.all([
      q(() => supabase.from('bookings').update({
        status:'cancelled', cancelled_at:new Date().toISOString(), cancel_reason_code:cancelReason
      }).eq('id', booking.id)),
      driver ? q(() => supabase.from('drivers').update({ status:'available' }).eq('id', driver.id)) : null,
    ])
    toast.success('Booking cancelled')
    await new Promise(r => setTimeout(r, 400))
    navigate('/dashboard', { replace:true })
  }

  const fmtCD = s => {
    if (!s || s <= 0) return null
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  }

  const userPos = booking?.pickup_lat && booking?.pickup_lng
    ? { lat: parseFloat(booking.pickup_lat), lng: parseFloat(booking.pickup_lng) } : null
  const dropPos = booking?.drop_lat && booking?.drop_lng
    ? { lat: parseFloat(booking.drop_lat), lng: parseFloat(booking.drop_lng), label: booking.drop_address || 'Drop Off' } : null
  const isCompleted  = booking?.status === 'completed'
  const isInProgress = booking?.status === 'in_progress'
  const isConfirmed  = booking?.status === 'confirmed'
  const isPending    = booking?.status === 'pending_admin'
  const isEnRoute    = booking?.status === 'en_route'
  const driverArrived= isConfirmed && countdown !== null && countdown <= 0

  if (loading) return (
    <div className="main" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'70vh' }}>
      <div className="spinner" style={{ width:44, height:44 }}/>
    </div>
  )
  if (!booking) return null

  return (
    <div className="main page-pad">
      <div className="page-inner">
        <button className="btn btn-ghost btn-sm mb3" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={14}/> Dashboard
        </button>

        {/* Status Header */}
        <div className="card mb3" style={{
          borderColor: isCompleted ? 'rgba(34,197,94,.2)' : isInProgress ? 'rgba(245,166,35,.2)' : 'rgba(34,197,94,.18)',
          background:  isCompleted ? 'rgba(34,197,94,.04)' : isInProgress ? 'rgba(245,166,35,.04)' : 'rgba(34,197,94,.03)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.85rem' }}>
            <div style={{ fontSize:'2.5rem', flexShrink:0 }}>
              {isCompleted ? '✅' : isInProgress ? '🚗' : isPending ? '📋' : isEnRoute ? '🚗' : driverArrived ? '🎉' : '✅'}
            </div>
            <div style={{ flex:1 }}>
              <h1 className="h2" style={{ marginBottom:'.25rem' }}>
                {isCompleted ? 'Trip Completed' : isInProgress ? 'Ride in Progress' : isPending ? 'Waiting for Admin' : isEnRoute ? 'Driver On The Way' : driverArrived ? 'Driver Arrived!' : 'Ride Confirmed'}
              </h1>
              <span className={`badge ${isCompleted?'b-green':isInProgress?'b-gold':'b-green'}`}>
                {booking.status.replace('_',' ')}
              </span>
            </div>
          </div>

          {/* En route message */}
          {isEnRoute && (
            <div style={{ marginTop:'1.25rem', textAlign:'center', padding:'1rem', background:'rgba(59,130,246,.06)', borderRadius:'var(--rs)', border:'1px solid rgba(59,130,246,.15)' }}>
              <div style={{ fontSize:'.72rem', color:'var(--ts)', marginBottom:'.4rem' }}>Your driver is on the way</div>
              <div style={{ fontWeight:700, color:'#3b82f6', fontSize:'.9rem' }}>Watch the map for live location</div>
            </div>
          )}

          {/* Pending admin message */}
          {isPending && (
            <div style={{ marginTop:'1.25rem', textAlign:'center', padding:'1rem', background:'rgba(245,166,35,.06)', borderRadius:'var(--rs)', border:'1px solid rgba(245,166,35,.15)' }}>
              <div style={{ fontSize:'.72rem', color:'var(--ts)', marginBottom:'.4rem' }}>Admin is reviewing your booking</div>
              <div style={{ fontWeight:700, color:'var(--gold)', fontSize:'.9rem' }}>You'll be notified once a driver is assigned</div>
              <div style={{ fontSize:'.75rem', color:'var(--tm)', marginTop:'.4rem' }}>Scheduled for: {booking?.scheduled_at ? new Date(booking.scheduled_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</div>
            </div>
          )}

          {/* Countdown */}
          {isConfirmed && countdown !== null && countdown > 0 && (
            <div style={{ marginTop:'1.25rem', textAlign:'center', padding:'1.1rem', background:'rgba(34,197,94,.06)', borderRadius:'var(--rs)', border:'1px solid rgba(34,197,94,.15)' }}>
              <div style={{ fontSize:'.7rem', color:'var(--ts)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.35rem' }}>Driver Arrives In</div>
              <div style={{ fontFamily:'var(--fd)', fontSize:'clamp(2rem,6vw,3rem)', fontWeight:900, color:'var(--green)', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
                {fmtCD(countdown)}
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginTop:'.5rem' }}><span className="dot"/></div>
            </div>
          )}
        </div>

        <div className="two-col-layout">
          <div>
            {/* PIN entry when driver arrives */}
            {driverArrived && !pinVerified && (
              <PinEntry onVerified={handlePinVerified}/>
            )}
            {startingRide && (
              <div className="good-box mb3" style={{ justifyContent:'center' }}>
                <span className="spinner" style={{ borderTopColor:'var(--green)', borderColor:'rgba(34,197,94,.2)' }}/>
                Starting your ride…
              </div>
            )}

            {/* Driver Card */}
            {driver && (
              <div className="card mb3">
                <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--ts)', marginBottom:'.85rem' }}>Your Driver</div>
                <div style={{ display:'flex', alignItems:'center', gap:'.85rem', marginBottom:'1rem' }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--orange))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontWeight:700, color:'#0a0a0f', fontSize:'1.2rem', flexShrink:0, overflow:'hidden', border:'2px solid rgba(245,166,35,.3)' }}>
                    {driver.photo_url
                      ? <img src={driver.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                      : driver.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'1rem' }}>{driver.name}</div>
                    <Stars v={driver.rating || 5}/>
                    <div style={{ color:'var(--ts)', fontSize:'.8rem', marginTop:2 }}>
                      {driver.vehicle_model} · <strong style={{ letterSpacing:'.04em' }}>{driver.vehicle_number}</strong>
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'.65rem' }}>
                  <a href={`tel:${driver.phone}`} className="btn btn-primary btn-sm" style={{ flex:1, justifyContent:'center' }}>
                    <Phone size={13}/> Call Driver
                  </a>
                  {(isConfirmed || isInProgress) && (
                    <button className="btn btn-blue btn-sm" style={{ flex:1 }} onClick={() => setChatOpen(v=>!v)}>
                      <MessageSquare size={13}/> Chat
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Trip Details */}
            <div className="card mb3">
              <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--ts)', marginBottom:'.85rem' }}>Trip Details</div>
              {[
                [<MapPin    size={13} style={{ color:'var(--blue)' }}/>,    'Pickup',   booking.pickup_address || '—'],
                [<Navigation size={13} style={{ color:'var(--gold)' }}/>,   'Drop',     booking.drop_address || 'IIT Hyderabad'],
                [<Clock     size={13} style={{ color:'var(--ts)'  }}/>,     'ETA',      `Pickup: ${booking.eta_pickup||'—'} · Trip: ${booking.eta_drop||'—'}`],
              ].map(([icon, label, value]) => (
                <div key={label} className="fare-r">
                  <span style={{ color:'var(--tm)', display:'flex', alignItems:'center', gap:5, flexShrink:0, fontSize:'.83rem' }}>{icon} {label}</span>
                  <span style={{ fontWeight:600, textAlign:'right', fontSize:'.84rem', maxWidth:'58%', color:'var(--tp)', lineHeight:1.4 }}>{value}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'.65rem 0 0', marginTop:'.25rem', borderTop:'1px solid var(--b1)', alignItems:'center' }}>
                <span style={{ color:'var(--tm)', fontSize:'.83rem' }}>Total Fare</span>
                <span style={{ fontFamily:'var(--fd)', fontSize:'1.55rem', fontWeight:900, color:'var(--gold)' }}>₹{booking.final_fare}</span>
              </div>
            </div>

            {/* Safety */}
            {!isCompleted && (
              <div className="mb3">
                <SafetyPanel booking={booking} driver={driver} userPos={userPos}
                  onArriveSafe={async () => {
                    await q(() => supabase.from('bookings').update({ arrived_safe:true }).eq('id', booking.id))
                    toast.success('Marked as arrived safe ✓')
                  }}/>
              </div>
            )}

            {/* Actions */}
            {!isCompleted && (
              <div style={{ display:'flex', gap:'.75rem' }}>
                <button className="btn btn-ghost w100" onClick={() => navigate('/dashboard')}>← Dashboard</button>
                <button className="btn btn-danger w100" onClick={() => setCancelModal(true)}>✕ Cancel</button>
              </div>
            )}
            {isCompleted && (
              <div style={{ marginTop:'1.25rem' }}>
                {/* Payment QR */}
                <div style={{ background:'rgba(34,197,94,.04)', border:'1px solid rgba(34,197,94,.2)', borderRadius:'var(--r)', padding:'1.5rem', textAlign:'center', marginBottom:'1rem' }}>
                  <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:'1rem', marginBottom:'.25rem' }}>💳 Pay Your Fare</div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginBottom:'1.25rem' }}>
                    Scan the QR code to pay <strong style={{ color:'var(--gold)' }}>₹{booking.final_fare}</strong> via UPI
                  </div>
                  <div style={{ display:'inline-block', background:'#fff', padding:14, borderRadius:12, boxShadow:'0 4px 24px rgba(0,0,0,.35)', marginBottom:'1rem' }}>
                    <QRCodeSVG
                      value={`upi://pay?pa=${UPI_ID}&pn=RaidCabs&am=${booking.final_fare}&cu=INR&tn=RaidCabs+Ride+Fare`}
                      size={200}
                      fgColor="#05050e"
                      bgColor="#ffffff"
                      level="H"
                    />
                  </div>
                  <div style={{ fontSize:'.8rem', color:'var(--ts)' }}>
                    UPI ID: <code style={{ color:'var(--gold)', background:'rgba(245,166,35,.1)', padding:'2px 8px', borderRadius:4 }}>{UPI_ID}</code>
                  </div>
                  <div style={{ fontSize:'.75rem', color:'var(--tm)', marginTop:'.5rem' }}>
                    Pay using any UPI app — PhonePe, GPay, Paytm, BHIM
                  </div>
                </div>
                <button className="btn btn-primary btn-blk btn-lg" onClick={() => navigate('/dashboard')}>Done — Back to Dashboard</button>
              </div>
            )}
          </div>

          {/* Live Map */}
          <div style={{ position:'sticky', top:70 }}>
            <LiveMap
              userPos={userPos}
              driverPos={driverPos}
              dropPos={dropPos}
              height={440}
              isInRide={isInProgress}
              liveLabel={driverPos ? '🟢 Driver GPS live' : null}
            />
            {!driverPos && isConfirmed && (
              <p style={{ fontSize:'.75rem', color:'var(--tm)', textAlign:'center', marginTop:'.6rem' }}>
                Driver location will appear here once they go online
              </p>
            )}
            {driverPos && (
              <p style={{ fontSize:'.73rem', color:'var(--green)', textAlign:'center', marginTop:'.6rem', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <span className="dot" style={{ width:6, height:6 }}/> Live GPS updating every 5 seconds
              </p>
            )}
          </div>
        </div>

        {/* Chat */}
        {chatOpen && booking?.id && (
          <ChatWidget bookingId={booking.id} open={chatOpen} onClose={() => setChatOpen(false)}/>
        )}

        {/* Cancel Modal */}
        {cancelModal && (
          <div className="overlay">
            <div className="modal" style={{ maxWidth:400 }}>
              <h3 style={{ fontFamily:'var(--fd)', fontSize:'1.1rem', marginBottom:'1rem' }}>Why are you cancelling?</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'.45rem', marginBottom:'1.25rem' }}>
                {CANCEL_REASONS.map(r => (
                  <button key={r} onClick={() => setCancelR(r)}
                    style={{ padding:'.7rem 1rem', borderRadius:'var(--rs)', border:`1px solid ${cancelReason===r?'rgba(245,166,35,.4)':'var(--b1)'}`, background:cancelReason===r?'rgba(245,166,35,.08)':'transparent', color:cancelReason===r?'var(--gold)':'var(--tp)', fontFamily:'var(--fb)', fontSize:'.87rem', textAlign:'left', cursor:'pointer', fontWeight:cancelReason===r?700:400, transition:'all .15s' }}>
                    {cancelReason===r?'✓ ':''}{r}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'.75rem' }}>
                <button className="btn btn-ghost w100" onClick={() => { setCancelModal(false); setCancelR('') }}>Keep Ride</button>
                <button className="btn btn-danger w100" onClick={handleCancel} disabled={!cancelReason||cancelling}>
                  {cancelling ? <span className="spinner"/> : 'Cancel Ride'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rating Prompt */}
        {showRating && (
          <RatingPrompt booking={booking} driver={driver} onDone={() => { setShowRating(false); navigate('/dashboard') }}/>
        )}
      </div>
    </div>
  )
}
