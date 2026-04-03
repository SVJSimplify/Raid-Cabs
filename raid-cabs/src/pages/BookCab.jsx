import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getRouteInfo, searchPlaces, reverseGeocode, calcFare } from '../lib/location'
import LiveMap from '../components/LiveMap'
import SafetyPanel from '../components/SafetyPanel'
import { ArrowLeft, MapPin, Navigation, Phone, AlertCircle, CheckCircle, Car, Clock, Zap, X, Search, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const IIT = { lat: 17.5934, lng: 78.1270, name: 'IIT Hyderabad, Sangareddy' }

function Stars({ v }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={`st-${i}`} style={{ fontSize:'.8rem', color: i <= Math.round(v) ? 'var(--gold)' : 'var(--tm)' }}>★</span>
      ))}
      <span style={{ marginLeft:4, fontSize:'.77rem', color:'var(--ts)' }}>{Number(v).toFixed(1)}</span>
    </span>
  )
}

export default function BookCab() {
  const { user, profile } = useAuth()
  const navigate          = useNavigate()

  const [pickup,     setPickup]    = useState('')
  const [userPos,    setUserPos]   = useState(null)
  const [sugs,       setSugs]      = useState([])
  const [sugLoading, setSugLoad]   = useState(false)
  const [locating,   setLocating]  = useState(false)

  const [step,       setStep]      = useState('form') // form|searching|confirm|confirming|confirmed
  const [drivers,    setDrivers]   = useState([])
  const [driver,     setDriver]    = useState(null)
  const [routeInfo,  setRoute]     = useState(null)
  const [fare,       setFare]      = useState(null)
  const [bookingId,  setBkId]      = useState(null)
  const [countdown,  setCountdown] = useState(null)
  const [driverPos,  setDriverPos] = useState(null)
  const [cancelling, setCancelling]= useState(false)
  const [liveStatus, setLiveStatus]= useState(null)

  const sugTimer = useRef(null)

  // Load available drivers
  useEffect(() => {
    q(() => supabase.from('drivers').select('*').eq('status','available').eq('is_approved',true).order('rating',{ascending:false}))
      .then(({ data }) => setDrivers(data || []))
  }, [])

  // Real-time booking status
  useEffect(() => {
    if (!bookingId) return
    const ch = supabase.channel(`bk-${bookingId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'bookings', filter:`id=eq.${bookingId}` },
        ({ new: r }) => {
          setLiveStatus(r.status)
          if (r.status === 'completed') toast.success('Trip completed! Please rate your driver ⭐')
          if (r.status === 'cancelled') {
            toast.error('Booking cancelled')
            navigate('/dashboard')
          }
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [bookingId, navigate])

  // Countdown timer
  useEffect(() => {
    if (!countdown || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Simulated driver movement (realistic GPS drift toward pickup)
  useEffect(() => {
    if (step !== 'confirmed' || !userPos) return
    const angle = Math.random() * 2 * Math.PI
    let d = { lat: userPos.lat + Math.cos(angle) * 0.018, lng: userPos.lng + Math.sin(angle) * 0.018 }
    setDriverPos({ ...d })
    const iv = setInterval(() => {
      d = {
        lat: d.lat + (userPos.lat - d.lat) * 0.09 + (Math.random()-.5) * .0001,
        lng: d.lng + (userPos.lng - d.lng) * 0.09 + (Math.random()-.5) * .0001,
      }
      setDriverPos({ ...d })
    }, 2500)
    return () => clearInterval(iv)
  }, [step, userPos])

  // Autocomplete
  const handlePickupInput = e => {
    const v = e.target.value
    setPickup(v)
    setSugs([])
    if (sugTimer.current) clearTimeout(sugTimer.current)
    if (v.length >= 3) {
      setSugLoad(true)
      sugTimer.current = setTimeout(async () => {
        const res = await searchPlaces(v)
        setSugs(res)
        setSugLoad(false)
      }, 420)
    } else {
      setSugLoad(false)
    }
  }

  const selectSug = sug => {
    setPickup(sug.address || sug.name)
    if (sug.lat && sug.lng) setUserPos({ lat: sug.lat, lng: sug.lng })
    setSugs([])
  }

  const detectGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS not available on this device'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserPos({ lat, lng })
        const address = await reverseGeocode(lat, lng)
        setPickup(address)
        toast.success('📍 Location detected!')
        setLocating(false)
      },
      err => {
        const msg = err.code === 1 ? 'Location permission denied' : 'Could not get your location'
        toast.error(msg)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSearch = async e => {
    e.preventDefault()
    setSugs([])
    if (!pickup.trim()) { toast.error('Enter your pickup address'); return }
    const pos = userPos || { lat: 17.4065, lng: 78.4772 }
    setUserPos(pos)
    setStep('searching')
    const info = await getRouteInfo(pos, IIT)
    setRoute(info)
    setFare(calcFare(info.distKm, profile?.discount_percent || 0))
    setDriver(drivers[0] || null)
    setStep('confirm')
  }

  const handleBook = async () => {
    if (!driver) { toast.error('No drivers available right now'); return }
    setStep('confirming')
    const { data, error } = await q(() =>
      supabase.from('bookings').insert({
        user_id:         user.id,
        driver_id:       driver.id,
        pickup_address:  pickup,
        pickup_lat:      userPos?.lat,
        pickup_lng:      userPos?.lng,
        drop_address:    IIT.name,
        drop_lat:        IIT.lat,
        drop_lng:        IIT.lng,
        distance_km:     routeInfo.distKm,
        base_fare:       fare.base,
        discount_amount: fare.discount,
        final_fare:      fare.final,
        eta_pickup:      `${routeInfo.driverEta} mins`,
        eta_drop:        `${routeInfo.tripMins} mins`,
        status:          'confirmed',
      }).select('id').single()
    )
    if (error) {
      toast.error('Booking failed: ' + error.message)
      setStep('confirm')
      return
    }
    await q(() => supabase.from('drivers').update({ status:'busy' }).eq('id', driver.id))
    setBkId(data.id)
    setCountdown(routeInfo.driverEta * 60)
    setStep('confirmed')
    toast.success('🚗 Cab booked!')
  }

  const handleCancel = useCallback(async () => {
    setCancelling(true)
    // Both updates must complete before navigating
    const results = await Promise.all([
      bookingId
        ? q(() => supabase.from('bookings')
            .update({ status:'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason:'User cancelled' })
            .eq('id', bookingId))
        : null,
      driver
        ? q(() => supabase.from('drivers').update({ status:'available' }).eq('id', driver.id))
        : null,
    ])
    const hasError = results.some(r => r?.error)
    if (hasError) {
      toast.error('Cancel failed — please try again')
      setCancelling(false)
      return
    }
    toast.success('Booking cancelled')
    setCancelling(false)
    // Wait for Supabase to propagate before Dashboard refetches
    await new Promise(r => setTimeout(r, 600))
    navigate('/dashboard', { replace: true })
  }, [bookingId, driver, navigate])


  const handleArriveSafe = async () => {
    if (!bookingId) return
    await q(() => supabase.from('bookings').update({ arrived_safe: true }).eq('id', bookingId))
    toast.success('Marked as arrived safe ✓')
  }

  const fmtCD = s => s > 0 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : null

  const grid = { display:'grid', gridTemplateColumns:'380px 1fr', gap:'1.75rem', maxWidth:1060, margin:'0 auto' }

  // ── FORM STEP ─────────────────────────────────────────────────────────────
  if (step === 'form') return (
    <div className="main" style={{ padding:'2rem' }}>
      <div style={{ maxWidth:1060, margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb2" onClick={() => navigate('/dashboard')}><ArrowLeft size={15}/> Back</button>
        <div className="mb3">
          <h1 className="h1">🚖 Book a Cab</h1>
          <p className="sub">Drop is always <strong style={{ color:'var(--gold)' }}>IIT Hyderabad</strong></p>
        </div>
        <div style={{ ...grid }}>
          <div>
            <div className="card fu">
              <h3 className="h3 mb3"><MapPin size={16} style={{ color:'var(--gold)', marginRight:7, verticalAlign:'middle' }}/>Your Pickup</h3>
              <form onSubmit={handleSearch}>
                <div className="fg mb2">
                  <label className="label">Pickup Address</label>
                  <div style={{ position:'relative' }}>
                    <div className="input-wrap">
                      <Search size={15} className="ico"/>
                      <input className="input" type="text" placeholder="Type your location…" value={pickup} onChange={handlePickupInput} autoComplete="off" required/>
                      {pickup && (
                        <button type="button" onClick={() => { setPickup(''); setSugs([]); setUserPos(null) }} style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex' }}>
                          <X size={14}/>
                        </button>
                      )}
                    </div>
                    {(sugLoading || sugs.length > 0) && (
                      <div className="ac-list">
                        {sugLoading && <div className="ac-item" style={{ color:'var(--tm)', justifyContent:'center' }}><span className="spinner" style={{ width:14, height:14 }}/> Searching…</div>}
                        {sugs.map(s => (
                          <div key={s.id} className="ac-item" onClick={() => selectSug(s)}>
                            <MapPin size={13} style={{ color:'var(--gold)', flexShrink:0 }}/>
                            <div>
                              <div style={{ fontWeight:600, fontSize:'.86rem' }}>{s.name}</div>
                              {s.address !== s.name && <div style={{ fontSize:'.74rem', color:'var(--ts)', marginTop:1 }}>{s.address}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button type="button" className="btn btn-outline btn-sm btn-blk mb2" onClick={detectGPS} disabled={locating}>
                  {locating ? <span className="spinner" style={{ width:13, height:13 }}/> : <Navigation size={13}/>}
                  {locating ? 'Detecting…' : 'Use My Current Location'}
                </button>
                {userPos && (
                  <p style={{ fontSize:'.75rem', color:'var(--green)', textAlign:'center', marginBottom:'.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                    <CheckCircle size={11}/> Location pinned ({userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)})
                  </p>
                )}
                <div className="fg mb3">
                  <label className="label">Drop (Fixed)</label>
                  <div className="input-wrap"><Navigation size={15} className="ico"/><input className="input" value={IIT.name} readOnly/></div>
                </div>
                {drivers.length === 0 && (
                  <div className="warn-box mb2"><AlertCircle size={14} style={{ flexShrink:0 }}/> No drivers available right now.</div>
                )}
                {(profile?.discount_percent || 0) > 0 && (
                  <div className="good-box mb2"><Zap size={13} style={{ flexShrink:0 }}/> {profile.discount_percent}% concession will be applied!</div>
                )}
                <button type="submit" className="btn btn-primary btn-blk btn-lg"><Car size={15}/> Find a Driver</button>
              </form>
            </div>
          </div>
          <LiveMap userPos={userPos} height={430}/>
        </div>
      </div>
    </div>
  )

  // ── SEARCHING ─────────────────────────────────────────────────────────────
  if (step === 'searching') return (
    <div className="main" style={{ padding:'3rem 2rem', textAlign:'center' }}>
      <div className="spinner" style={{ width:52, height:52, margin:'0 auto 1.5rem' }}/>
      <h2 className="h2">Calculating route…</h2>
      <p className="sub mt1">Finding the best path to IIT Hyderabad</p>
    </div>
  )

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div className="main" style={{ padding:'2rem' }}>
      <div style={{ ...grid }}>
        <div>
          <button className="btn btn-ghost btn-sm mb2" onClick={() => setStep('form')}><ArrowLeft size={14}/> Change</button>
          <h2 className="h2 mb3">Confirm Booking</h2>
          <div className="card mb2">
            <h3 className="h4 mb2" style={{ color:'var(--ts)' }}>Fare Breakdown</h3>
            {[['Distance', `${routeInfo.distKm} km`],['Rate','₹12 / km'],['Base Fare',`₹${fare.base}`],
              ...(fare.discount > 0 ? [[`Concession (${profile.discount_percent}%)`, `-₹${fare.discount}`, 'var(--green)']] : [])
            ].map(([l,v,c]) => (
              <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ color:c||'var(--tp)', fontWeight:600 }}>{v}</span></div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'.7rem', marginTop:'.25rem', borderTop:'1px solid var(--b2)' }}>
              <span style={{ fontFamily:'var(--fd)', fontWeight:700 }}>Total</span>
              <span style={{ fontFamily:'var(--fd)', fontSize:'1.55rem', fontWeight:900, color:'var(--gold)' }}>₹{fare.final}</span>
            </div>
          </div>
          <div className="card mb2">
            <h3 className="h4 mb2" style={{ color:'var(--ts)' }}>Time Estimate</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
              {[['🚗', 'Driver ETA', `${routeInfo.driverEta} mins`],['⏱', 'Trip Duration', `${routeInfo.tripMins} mins`]].map(([em,l,v]) => (
                <div key={l} style={{ textAlign:'center', background:'rgba(255,255,255,.03)', borderRadius:'var(--rs)', padding:'.9rem .5rem' }}>
                  <div style={{ fontSize:'1.3rem', marginBottom:'.3rem' }}>{em}</div>
                  <div style={{ fontSize:'.7rem', color:'var(--tm)', textTransform:'uppercase', letterSpacing:'.07em' }}>{l}</div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:700, color:'var(--gold)', marginTop:3 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          {driver && (
            <div className="card mb3">
              <h3 className="h4 mb2" style={{ color:'var(--ts)' }}>Your Driver</h3>
              <div style={{ display:'flex', alignItems:'center', gap:'.9rem' }}>
                <div style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--orange))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontWeight:700, color:'#05050e', flexShrink:0, fontSize:'1.1rem' }}>
                  {driver.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700 }}>{driver.name}</div>
                  <Stars v={driver.rating}/>
                  <div style={{ color:'var(--ts)', fontSize:'.8rem' }}>{driver.vehicle_model} · <strong style={{ letterSpacing:'.04em' }}>{driver.vehicle_number}</strong></div>
                </div>
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:'.9rem' }}>
            <button className="btn btn-outline w100" onClick={() => setStep('form')}>← Back</button>
            <button className="btn btn-primary w100 btn-lg" onClick={handleBook}>🚀 Confirm Booking</button>
          </div>
        </div>
        <LiveMap userPos={userPos} height={430}/>
      </div>
    </div>
  )

  // ── CONFIRMING ────────────────────────────────────────────────────────────
  if (step === 'confirming') return (
    <div className="main" style={{ padding:'3rem 2rem', textAlign:'center' }}>
      <div className="spinner" style={{ width:52, height:52, margin:'0 auto 1.5rem' }}/>
      <h2 className="h2">Confirming your booking…</h2>
    </div>
  )

  // ── CONFIRMED ─────────────────────────────────────────────────────────────
  return (
    <div className="main" style={{ padding:'2rem' }}>
      <div style={{ ...grid }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.75rem' }}>
            <CheckCircle size={24} style={{ color:'var(--green)' }}/>
            <h1 className="h1">Cab Booked! 🎉</h1>
            {liveStatus && <span className={`badge ${liveStatus==='confirmed'?'b-green':'b-gold'}`}>{liveStatus}</span>}
          </div>

          {/* Countdown */}
          {countdown !== null && countdown > 0 && (
            <div className="card mb2" style={{ textAlign:'center', borderColor:'rgba(46,204,113,.28)', background:'rgba(46,204,113,.05)' }}>
              <div style={{ fontSize:'.74rem', color:'var(--tm)', textTransform:'uppercase', letterSpacing:'.08em' }}>Driver Arrives In</div>
              <div style={{ fontFamily:'var(--fd)', fontSize:'3.2rem', fontWeight:900, color:'var(--green)', fontVariantNumeric:'tabular-nums' }}>{fmtCD(countdown)}</div>
              <div style={{ display:'flex', justifyContent:'center', marginTop:'.5rem' }}><span className="dot"/></div>
            </div>
          )}
          {countdown === 0 && (
            <div className="card mb2 good-box" style={{ justifyContent:'center', textAlign:'center' }}>
              🚗 Driver has arrived!
            </div>
          )}

          {/* Driver */}
          {driver && (
            <div className="card mb2">
              <div style={{ display:'flex', alignItems:'center', gap:'.9rem' }}>
                <div style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--orange))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontWeight:700, color:'#05050e', flexShrink:0, fontSize:'1.1rem' }}>
                  {driver.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700 }}>{driver.name}</div>
                  <Stars v={driver.rating}/>
                  <div style={{ color:'var(--ts)', fontSize:'.8rem' }}>{driver.vehicle_model} · {driver.vehicle_number}</div>
                </div>
                <a href={`tel:${driver.phone}`} className="btn btn-primary btn-sm"><Phone size={13}/> Call</a>
              </div>
    
            </div>
          )}

          {/* Trip details */}
          <div className="card mb2">
            {[['Pickup', pickup],['Drop', IIT.name, 'var(--gold)'],['Distance', `${routeInfo?.distKm} km`],['Duration', `${routeInfo?.tripMins} mins`],['Fare', `₹${fare?.final}`, 'var(--gold)']].map(([l,v,c]) => (
              <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ fontWeight:700, color:c||'var(--tp)', textAlign:'right', maxWidth:'60%', fontSize:'.87rem' }}>{v}</span></div>
            ))}
          </div>

          <div style={{ marginBottom:'.85rem' }}>
            <SafetyPanel
              booking={bookingId ? { id: bookingId, user_id: user?.id, driver_id: driver?.id, status: liveStatus || 'confirmed', pickup_address: pickup } : null}
              driver={driver}
              userPos={userPos}
              onArriveSafe={handleArriveSafe}
            />
          </div>

          <div style={{ display:'flex', gap:'.75rem' }}>
            <button className="btn btn-outline w100" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="btn btn-danger w100" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <span className="spinner"/> : '✕ Cancel Trip'}
            </button>
          </div>
        </div>

        <LiveMap userPos={userPos} driverPos={driverPos} height={480} liveLabel="Driver approaching…"/>
      </div>
    </div>
  )
}
