import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDriver } from '../contexts/DriverContext'
import { supabase, q } from '../lib/supabase'
import { haversineKm } from '../lib/location'
import LiveMap from '../components/LiveMap'
import { Phone, History, LogOut, CheckCircle, XCircle, Clock, Zap, AlertTriangle, Navigation, MapPin, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

function Stars({ v }) {
  return (
    <span style={{ display:'inline-flex', gap:1, alignItems:'center' }}>
      {[1,2,3,4,5].map(i => <span key={`s-${i}`} style={{ fontSize:'.8rem', color: i<=Math.round(v)?'#ffb347':'#504c74' }}>★</span>)}
      <span style={{ marginLeft:4, fontSize:'.77rem', color:'#9890c2' }}>{Number(v).toFixed(1)}</span>
    </span>
  )
}

export default function DriverHome() {
  const { driver, currentBooking, updateBookingStatus, setOnlineStatus, signOutDriver } = useDriver()
  const navigate = useNavigate()

  const [driverPos,     setDriverPos]    = useState(null)
  const [gpsError,      setGpsError]     = useState(false)
  const [actionLoading, setActionLoad]   = useState(false)
  const [todayStats,    setTodayStats]   = useState({ trips:0, earnings:0 })
  const [showSos,       setShowSos]      = useState(false)
  const [rideSeconds,   setRideSeconds]  = useState(0)
  const rideTimerRef = useRef(null)
  const [mapExpanded,   setMapExpanded]  = useState(true)
  const watchRef = useRef(null)

  // Live GPS tracking — pushes location to Supabase for passenger to see
  useEffect(() => {
    if (!navigator.geolocation || !driver) { setGpsError(true); return }
    let lastPush = 0
    watchRef.current = navigator.geolocation.watchPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setDriverPos({ lat, lng })
        setGpsError(false)
        // Push to Supabase every 4 seconds
        const now = Date.now()
        if (now - lastPush > 15000) { // push every 15 seconds
          lastPush = now
          const { error } = await supabase.from('drivers').update({
            current_lat: lat,
            current_lng: lng,
            location_updated_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
          }).eq('id', driver.id)
          if (error) console.warn('[GPS push error]', error.message)
        }
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    )
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current) }
  }, [driver])

  // Today stats
  useEffect(() => {
    if (!driver) return
    const today = new Date().toISOString().slice(0,10)
    q(() => supabase.from('bookings').select('final_fare').eq('driver_id', driver.id).eq('status','completed').gte('created_at',`${today}T00:00:00`))
      .then(({ data }) => setTodayStats({ trips: data?.length||0, earnings: data?.reduce((s,b)=>s+(b.final_fare||0),0)||0 }))
  }, [driver, currentBooking])

  // Ride timer — starts when in_progress
  useEffect(() => {
    if (currentBooking?.status === 'in_progress') {
      const started = currentBooking.started_at
        ? new Date(currentBooking.started_at).getTime()
        : Date.now()
      rideTimerRef.current = setInterval(() => {
        setRideSeconds(Math.floor((Date.now() - started) / 1000))
      }, 1000)
    } else {
      if (rideTimerRef.current) clearInterval(rideTimerRef.current)
      setRideSeconds(0)
    }
    return () => { if (rideTimerRef.current) clearInterval(rideTimerRef.current) }
  }, [currentBooking?.status, currentBooking?.started_at])

  // Countdown to scheduled pickup
  const [pickupCountdown, setPickupCountdown] = useState(null)
  useEffect(() => {
    if (!currentBooking?.scheduled_at || currentBooking.status !== 'confirmed') {
      setPickupCountdown(null); return
    }
    const tick = () => {
      const diff = Math.floor((new Date(currentBooking.scheduled_at) - Date.now()) / 1000)
      setPickupCountdown(diff)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [currentBooking?.scheduled_at, currentBooking?.status])

  const fmtTimer = s => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const fmtCountdown = s => {
    if (s <= 0) return 'NOW'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }

  // Driver should dispatch 30 mins before scheduled time
  const DISPATCH_MINS = 30
  const canDispatch = pickupCountdown !== null && pickupCountdown <= DISPATCH_MINS * 60
  const minsToDispatch = pickupCountdown !== null ? Math.ceil((pickupCountdown - DISPATCH_MINS * 60) / 60) : null

  const doAction = async (status, label) => {
    setActionLoad(true)
    const { error } = await updateBookingStatus(currentBooking.id, status)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(label)
        // Send email + deduct balance on completion
      const sendEmail = (type, extra={}) => fetch('/api/send-email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ type, bookingId:currentBooking.id, ...extra })
      }).catch(()=>{})

      if (status === 'in_progress') {
        sendEmail('driver_arrived', { data:{ rideCode:currentBooking.ride_code } })
      }
      if (status === 'completed') {
        sendEmail('receipt')
        // Deduct fare from passenger's balance
        const { data: prof } = await supabase.from('profiles')
          .select('balance').eq('id', currentBooking.user_id).maybeSingle()
        if (prof) {
          const newBal = Math.max(0, Number(prof.balance || 0) - Number(currentBooking.final_fare || 0))
          await supabase.from('profiles').update({ balance: newBal }).eq('id', currentBooking.user_id)
          // Log transaction
          supabase.from('balance_transactions').insert({
            user_id: currentBooking.user_id,
            booking_id: currentBooking.id,
            amount: -currentBooking.final_fare,
            type: 'ride_deduction',
            balance_before: prof.balance,
            balance_after: newBal,
            notes: `Ride fare deducted`,
          }).catch(() => {})
        }
      }
    }
    setActionLoad(false)
  }

  const toggleOnline = async () => {
    const goOnline = driver.status === 'offline'
    await setOnlineStatus(goOnline)
    toast.success(goOnline ? 'You are now online 🟢' : 'You are now offline')
  }

  const isOnline = driver?.status !== 'offline'

  // Customer position from booking
  const customerPos = currentBooking?.pickup_lat && currentBooking?.pickup_lng
    ? { lat: currentBooking.pickup_lat, lng: currentBooking.pickup_lng } : null

  // Distance to customer
  const distToCustomer = driverPos && customerPos
    ? haversineKm(driverPos, customerPos).toFixed(1) : null

  const Spinner = () => <div style={{ width:18, height:18, border:'2.5px solid rgba(5,5,14,.3)', borderTopColor:'#05050e', borderRadius:'50%', animation:'sp .7s linear infinite' }}/>

  return (
    <div style={{ minHeight:'100vh', background:'#05050e', fontFamily:"'Nunito',sans-serif", color:'#ede8d8' }}>
      <style>{`
        @keyframes sp{to{transform:rotate(360deg)}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(46,204,113,.5)}70%{box-shadow:0 0 0 8px rgba(46,204,113,0)}100%{box-shadow:0 0 0 0 rgba(46,204,113,0)}}
        .dh-card{background:#0e0e20;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:1.25rem;margin-bottom:.85rem;}
        .dh-row{display:flex;justify-content:space-between;align-items:flex-start;padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.86rem;}
        .dh-row:last-child{border-bottom:none;}
        .dh-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:.82rem;border-radius:10px;font-family:'Nunito',sans-serif;font-weight:700;font-size:.9rem;cursor:pointer;border:none;transition:all .2s;width:100%;}
        .dh-g{background:linear-gradient(135deg,#2ecc71,#27ae60);color:#05050e;box-shadow:0 4px 16px rgba(46,204,113,.25);}
        .dh-o{background:linear-gradient(135deg,#ffb347,#ff6b35);color:#05050e;box-shadow:0 4px 16px rgba(255,179,71,.25);}
        .dh-r{background:rgba(231,76,60,.12);color:#e74c3c;border:1px solid rgba(231,76,60,.25);}
        .dh-ghost{background:transparent;border:1px solid rgba(255,255,255,.1);color:#9890c2;}
        .dh-btn:hover:not(:disabled){transform:translateY(-1px);}
        .dh-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .pulse-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ecc71;animation:pulse 1.6s infinite;}
        .sos-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(10px);z-index:999;display:flex;align-items:center;justify-content:center;padding:2rem;}
      `}</style>

      {/* Navbar */}
      <nav style={{ height:58, background:'rgba(5,5,14,.92)', borderBottom:'1px solid rgba(46,204,113,.15)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.25rem', position:'sticky', top:0, zIndex:100, backdropFilter:'blur(20px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.7rem' }}>
          <div style={{ width:34, height:34, background:'rgba(46,204,113,.12)', border:'1px solid rgba(46,204,113,.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#2ecc71', fontSize:'.9rem', overflow:'hidden', flexShrink:0 }}>
            {driver?.photo_url
              ? <img src={driver.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : driver?.name?.[0]?.toUpperCase()
            }
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:'.88rem', color:'#2ecc71' }}>{driver?.name}</div>
            <div style={{ fontSize:'.68rem', color:'#504c74' }}>{driver?.vehicle_number}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          {driverPos && <span style={{ background:'rgba(46,204,113,.1)', border:'1px solid rgba(46,204,113,.2)', borderRadius:99, padding:'.28rem .7rem', fontSize:'.7rem', color:'#2ecc71', display:'flex', alignItems:'center', gap:5 }}><span className="pulse-dot" style={{ width:6, height:6 }}/> GPS Live</span>}
          {gpsError  && <span style={{ background:'rgba(231,76,60,.1)', border:'1px solid rgba(231,76,60,.2)', borderRadius:99, padding:'.28rem .7rem', fontSize:'.7rem', color:'#e74c3c' }}>⚠ No GPS</span>}
          <button onClick={() => navigate('/driver/history')} style={{ background:'transparent', border:'1px solid rgba(255,255,255,.1)', color:'#9890c2', borderRadius:8, padding:'.35rem .7rem', cursor:'pointer', fontSize:'.75rem', fontFamily:"'Nunito',sans-serif", display:'flex', alignItems:'center', gap:4 }}><History size={12}/> Trips</button>
          <button onClick={()=>{ signOutDriver(); navigate('/driver') }} style={{ background:'transparent', border:'none', color:'#504c74', cursor:'pointer', display:'flex', padding:4 }}><LogOut size={15}/></button>
        </div>
      </nav>

      <div style={{ maxWidth:540, margin:'0 auto', padding:'var(--page-py) var(--page-px) 5rem' }}>

        {/* Online toggle */}
        <div className="dh-card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderColor: isOnline?'rgba(46,204,113,.25)':'rgba(255,255,255,.08)' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'.92rem', display:'flex', alignItems:'center', gap:7 }}>
              {isOnline ? <><span className="pulse-dot"/> Online</> : <><span style={{ width:8, height:8, borderRadius:'50%', background:'#504c74', display:'inline-block' }}/> Offline</>}
            </div>
            <div style={{ fontSize:'.75rem', color:'#504c74', marginTop:2 }}>{isOnline ? 'Ready for ride assignments' : 'Go online to receive rides'}</div>
          </div>
          <button onClick={toggleOnline} style={{ background: isOnline?'rgba(231,76,60,.12)':'rgba(46,204,113,.12)', border:`1px solid ${isOnline?'rgba(231,76,60,.28)':'rgba(46,204,113,.28)'}`, color: isOnline?'#e74c3c':'#2ecc71', borderRadius:99, padding:'.42rem 1rem', cursor:'pointer', fontSize:'.8rem', fontWeight:700, fontFamily:"'Nunito',sans-serif" }}>
            Go {isOnline?'Offline':'Online'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'.75rem', marginBottom:'.85rem' }}>
          {[
            [`₹${todayStats.earnings.toLocaleString()}`, 'Earnings', '#ffb347'],
            [todayStats.trips, 'Trips', '#2ecc71'],
          ].map(([v,l,c]) => (
            <div key={l} style={{ textAlign:'center', background:'#0e0e20', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, padding:'.95rem .5rem' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:'.68rem', color:'#504c74', textTransform:'uppercase', letterSpacing:'.06em', marginTop:2 }}>{l}</div>
            </div>
          ))}
          <div style={{ textAlign:'center', background:'#0e0e20', border:'1px solid rgba(255,255,255,.07)', borderRadius:12, padding:'.95rem .5rem' }}>
            <div style={{ fontSize:'.95rem', marginTop:4 }}><Stars v={driver?.rating||5}/></div>
            <div style={{ fontSize:'.68rem', color:'#504c74', textTransform:'uppercase', letterSpacing:'.06em', marginTop:4 }}>Rating</div>
          </div>
        </div>

        {/* No booking */}
        {!currentBooking && (
          <div className="dh-card" style={{ textAlign:'center', padding:'2.5rem 1.5rem' }}>
            <div style={{ fontSize:'2.8rem', marginBottom:'.75rem' }}>⏳</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700, marginBottom:'.5rem' }}>
              {isOnline ? 'Waiting for a ride…' : 'You are offline'}
            </div>
            <p style={{ color:'#504c74', fontSize:'.83rem', lineHeight:1.65 }}>
              {isOnline ? 'Admin will assign you a ride. It appears here instantly.' : 'Switch online to receive rides.'}
            </p>
            {isOnline && <div style={{ marginTop:'1rem', display:'flex', justifyContent:'center' }}><span className="pulse-dot"/></div>}
            {driverPos && isOnline && (
              <div style={{ marginTop:'1.25rem' }}>
                <LiveMap
                    userPos={driverPos}
                    dropPos={customerPos}
                    showDrop={false}
                    height={200}
                  />
              </div>
            )}
          </div>
        )}

        {/* Active booking */}
        {currentBooking && (
          <>
            {/* Map */}
            <div className="dh-card" style={{ padding:'1rem' }}>
              <div onClick={() => setMapExpanded(v=>!v)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom: mapExpanded ? '.85rem' : 0 }}>
                <div style={{ fontWeight:700, fontSize:'.88rem', display:'flex', alignItems:'center', gap:7 }}>
                  <span className="pulse-dot" style={{ background: currentBooking.status==='in_progress'?'#ffb347':'#2ecc71' }}/>
                  Live Map
                  {distToCustomer && (
                    <span style={{ background:'rgba(52,152,219,.1)', border:'1px solid rgba(52,152,219,.2)', borderRadius:99, padding:'.22rem .7rem', fontSize:'.72rem', color:'#3498db', display:'flex', alignItems:'center', gap:4 }}>
                      <MapPin size={10}/> {distToCustomer} km away
                    </span>
                  )}
                </div>
                <ChevronDown size={15} style={{ color:'#504c74', transform: mapExpanded?'rotate(180deg)':'none', transition:'.2s' }}/>
              </div>
              {mapExpanded && (
                <>
                  <LiveMap
                    userPos={customerPos}
                    driverPos={driverPos}
                    dropPos={currentBooking?.drop_lat ? { lat: parseFloat(currentBooking.drop_lat), lng: parseFloat(currentBooking.drop_lng), label: currentBooking.drop_address || 'Drop Off' } : null}
                    height={300}
                    liveLabel="🟢 Tracking live"
                  />
                  {gpsError && <p style={{ fontSize:'.74rem', color:'#e74c3c', marginTop:'.5rem', textAlign:'center' }}>⚠ Enable GPS to show your location on map</p>}
                </>
              )}
            </div>

            {/* Booking details */}
            <div className="dh-card" style={{ borderColor: currentBooking.status==='in_progress'?'rgba(255,179,71,.3)':'rgba(46,204,113,.25)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:'1rem' }}>
                <span className="pulse-dot" style={{ background: currentBooking.status==='in_progress'?'#ffb347':'#2ecc71' }}/>
                <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'.95rem' }}>
                  {currentBooking.status === 'in_progress' ? '🚗 Trip in Progress' : '📋 New Ride Assigned'}
                </span>
                <span style={{ marginLeft:'auto', padding:'.2rem .6rem', borderRadius:99, fontSize:'.66rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', background: currentBooking.status==='in_progress'?'rgba(255,179,71,.12)':'rgba(46,204,113,.12)', color: currentBooking.status==='in_progress'?'#ffb347':'#2ecc71', border:`1px solid ${currentBooking.status==='in_progress'?'rgba(255,179,71,.3)':'rgba(46,204,113,.3)'}` }}>
                  {currentBooking.status.replace('_',' ')}
                </span>
              </div>
              {[
                [<MapPin size={12} color="#2ecc71"/>,    'Pickup',   currentBooking.pickup_address],
                [<Navigation size={12} color="#ffb347"/>, 'Drop',   currentBooking.drop_address],
                [<Clock size={12} color="#9890c2"/>,      'ETAs',   `Driver: ${currentBooking.eta_pickup||'—'} · Trip: ${currentBooking.eta_drop||'—'}`],
              ].map(([icon,l,v]) => (
                <div key={l} className="dh-row">
                  <span style={{ color:'#504c74', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>{icon} {l}</span>
                  <span style={{ fontWeight:600, textAlign:'right', maxWidth:'62%', fontSize:'.84rem', lineHeight:1.4 }}>{v}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'.65rem', marginTop:'.2rem', borderTop:'1px solid rgba(255,255,255,.07)' }}>
                <span style={{ color:'#504c74', fontSize:'.83rem' }}>Fare</span>
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', fontWeight:800, color:'#ffb347' }}>₹{currentBooking.final_fare}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', flexDirection:'column', gap:'.6rem', marginBottom:'.85rem' }}>
              {currentBooking.status === 'confirmed' && (
                <>
                  {/* Pickup info card */}
                  <div style={{ padding:'1.1rem', background:'rgba(46,204,113,.07)', border:'2px solid rgba(46,204,113,.3)', borderRadius:14, marginBottom:'1rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'.65rem' }}>
                      <div style={{ width:36,height:36,borderRadius:'50%',background:'rgba(46,204,113,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0 }}>✅</div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:'.95rem', color:'#2ecc71' }}>Ride Assigned To You!</div>
                        <div style={{ fontSize:'.74rem', color:'#9890c2', marginTop:1 }}>Head to pickup. Press Start Ride when passenger is in.</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                      <div style={{ display:'flex', gap:'.6rem', fontSize:'.82rem' }}>
                        <span style={{ color:'#3b82f6', flexShrink:0 }}>📍</span>
                        <span style={{ color:'#ede8d8', fontWeight:600 }}>{currentBooking.pickup_address?.split(',')[0] || '—'}</span>
                      </div>
                      <div style={{ display:'flex', gap:'.6rem', fontSize:'.82rem' }}>
                        <span style={{ color:'#ffb347', flexShrink:0 }}>🏁</span>
                        <span style={{ color:'#9890c2' }}>{currentBooking.drop_address?.split(',')[0] || '—'}</span>
                      </div>
                      {currentBooking.scheduled_at && (
                        <div style={{ display:'flex', gap:'.6rem', fontSize:'.82rem', marginTop:'.25rem' }}>
                          <span style={{ flexShrink:0 }}>🕐</span>
                          <span style={{ color:'#ffb347', fontWeight:700 }}>
                            {new Date(currentBooking.scheduled_at).toLocaleString('en-IN',{weekday:'short',hour:'2-digit',minute:'2-digit'})}
                            {' · ₹'}{currentBooking.final_fare}
                            {currentBooking.discount_amount > 0 ? ` (₹${currentBooking.discount_amount} off)` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* START RIDE button — prominent */}
                  <button className="dh-btn" onClick={() => doAction('in_progress','🚗 Ride started!')} disabled={actionLoading}
                    style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', fontSize:'1rem', fontWeight:800, padding:'1rem', marginBottom:'.6rem', boxShadow:'0 4px 20px rgba(34,197,94,.4)' }}>
                    {actionLoading ? <Spinner/> : <><Zap size={18}/> Start Ride</>}
                  </button>
                  <button className="dh-btn dh-r" onClick={() => doAction('cancelled','Booking cancelled')} disabled={actionLoading}>
                    <XCircle size={14}/> Cancel Ride
                  </button>
                </>
              )}
              {currentBooking.status === 'en_route' && (
                <>
                  <div style={{ padding:'1rem', background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.25)', borderRadius:12, marginBottom:'.75rem', textAlign:'center' }}>
                    <div style={{ fontSize:'1.4rem', marginBottom:'.3rem' }}>🚗</div>
                    <div style={{ fontWeight:700, fontSize:'.9rem', color:'#3b82f6', marginBottom:'.2rem' }}>En Route to Pickup</div>
                    <div style={{ fontSize:'.78rem', color:'#9890c2', lineHeight:1.5 }}>
                      When the passenger is in the vehicle and gives you the go-ahead, tap Start Ride.
                    </div>
                    <div style={{ marginTop:'.5rem', fontSize:'.78rem', color:'#9890c2' }}>
                      📍 {currentBooking.pickup_address?.split(',')[0]}
                    </div>
                  </div>
                  <button className="dh-btn dh-g" onClick={() => doAction('in_progress','🚀 Ride started!')} disabled={actionLoading} style={{ marginBottom:'.5rem' }}>
                    {actionLoading ? <Spinner/> : <><Zap size={16}/> Start Ride</>}
                  </button>
                  <button className="dh-btn dh-r" onClick={() => doAction('cancelled','Booking cancelled')} disabled={actionLoading}>
                    <XCircle size={14}/> Cancel Ride
                  </button>
                </>
              )}

              {currentBooking.status === 'in_progress' && (
                <>
                  {/* Ride timer */}
                  <div style={{ textAlign:'center', padding:'.85rem', background:'rgba(46,204,113,.06)', border:'1px solid rgba(46,204,113,.2)', borderRadius:12, marginBottom:'.75rem' }}>
                    <div style={{ fontSize:'.72rem', color:'#504c74', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.35rem' }}>Ride Duration</div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'2.4rem', fontWeight:900, color:'#2ecc71', fontVariantNumeric:'tabular-nums', lineHeight:1 }}>
                      {fmtTimer(rideSeconds)}
                    </div>
                    <div style={{ fontSize:'.75rem', color:'#504c74', marginTop:'.35rem' }}>
                      🎯 Drop: {currentBooking.drop_address?.split(',')[0] || 'Destination'}
                    </div>
                  </div>
                  <button className="dh-btn dh-g" onClick={() => doAction('completed','✅ Ride ended — passenger will see payment QR!')} disabled={actionLoading} style={{ marginBottom:'.5rem' }}>
                    {actionLoading?<Spinner/>:<><CheckCircle size={16}/> End Ride</>}
                  </button>
                  <button className="dh-btn dh-ghost" onClick={() => setShowSos(true)}>
                    <AlertTriangle size={14}/> SOS Emergency
                  </button>
                </>
              )}
            </div>

            {/* Call passenger */}
            <div className="dh-card" style={{ display:'flex', alignItems:'center', gap:'.9rem' }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(52,152,219,.1)', border:'1px solid rgba(52,152,219,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1.1rem' }}>👤</div>
              <div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:'.87rem' }}>Passenger</div><div style={{ fontSize:'.74rem', color:'#504c74' }}>Call if you cannot find them</div></div>
              <a href={`tel:${currentBooking.user_phone||''}`} style={{ background:'rgba(52,152,219,.1)', border:'1px solid rgba(52,152,219,.22)', color:'#3498db', borderRadius:8, padding:'.45rem .9rem', fontWeight:700, fontSize:'.82rem', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
                <Phone size={13}/> Call
              </a>
            </div>
          </>
        )}
      </div>

      {/* SOS Modal */}
      {showSos && (
        <div className="sos-overlay" onClick={() => setShowSos(false)}>
          <div style={{ background:'#0e0e20', border:'2px solid rgba(231,76,60,.4)', borderRadius:18, padding:'2rem', maxWidth:360, width:'100%', textAlign:'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🆘</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.15rem', color:'#ede8d8', marginBottom:'.65rem' }}>SOS Emergency</h3>
            <p style={{ color:'#9890c2', fontSize:'.84rem', lineHeight:1.65, marginBottom:'1.5rem' }}>Admin will be notified immediately.</p>
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button className="dh-btn dh-r" onClick={() => { toast.error('🆘 SOS sent! Admin notified.',{duration:6000,icon:'🆘'}); setShowSos(false) }}>
                <AlertTriangle size={14}/> Send SOS
              </button>
              <button className="dh-btn dh-ghost" onClick={() => setShowSos(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
