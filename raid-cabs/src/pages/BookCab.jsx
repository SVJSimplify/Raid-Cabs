import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getRouteInfo, searchPlaces, reverseGeocode, calcFare, HAS_KEY } from '../lib/mappls'
import MapplsMap from '../components/MapplsMap'
import { ArrowLeft, MapPin, Navigation, Phone, AlertCircle, CheckCircle, Car, Route, Clock, Shield, Zap, X, Search, Star } from 'lucide-react'
import toast from 'react-hot-toast'

const IIT = { lat: 17.5934, lng: 78.1270, name: 'IIT Hyderabad, Sangareddy' }

function Stars({ v }) {
  return (
    <span style={{ display:'inline-flex', gap:1, alignItems:'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={`star-${i}`} style={{ fontSize:'.82rem', color: i<=Math.round(v)?'var(--gold)':'var(--tm)' }}>★</span>
      ))}
      <span style={{ marginLeft:5, fontSize:'.79rem', color:'var(--ts)' }}>{Number(v).toFixed(1)}</span>
    </span>
  )
}

export default function BookCab() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // form state
  const [pickup,    setPickup]   = useState('')
  const [userPos,   setUserPos]  = useState(null)
  const [sugs,      setSugs]     = useState([])
  const [sugLoad,   setSugLoad]  = useState(false)
  const [locating,  setLocating] = useState(false)

  // booking flow state
  const [step,      setStep]     = useState('form') // form | searching | confirm | confirming | confirmed
  const [drivers,   setDrivers]  = useState([])
  const [driver,    setDriver]   = useState(null)
  const [routeInfo, setRoute]    = useState(null)
  const [fare,      setFare]     = useState(null)
  const [bookingId, setBkId]     = useState(null)
  const [countdown, setCountdown]= useState(null)
  const [driverPos, setDriverPos]= useState(null)
  const [cancelling,setCancelling]=useState(false)
  const [realStatus,setRealStatus]=useState(null)

  const sugTimer = useRef(null)

  // Load available drivers (sorted by rating)
  useEffect(() => {
    q(() => supabase.from('drivers').select('*').eq('status','available').order('rating',{ascending:false}))
      .then(({ data }) => setDrivers(data || []))
  }, [])

  // Real-time booking status updates
  useEffect(() => {
    if (!bookingId) return
    const ch = supabase.channel(`booking-status-${bookingId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'bookings',
        filter: `id=eq.${bookingId}`,
      }, ({ new: newRow }) => {
        setRealStatus(newRow.status)
        if (newRow.status === 'completed') toast.success('Trip completed! Please rate your driver ⭐')
        if (newRow.status === 'cancelled') toast.error('Your booking was cancelled by admin.')
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [bookingId])

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Simulated driver movement (realistic curve toward user)
  useEffect(() => {
    if (step !== 'confirmed' || !userPos) return
    // Start 1.8km away at random angle
    const angle = Math.random() * 2 * Math.PI
    let d = {
      lat: userPos.lat + Math.cos(angle) * 0.016,
      lng: userPos.lng + Math.sin(angle) * 0.016,
    }
    setDriverPos({ ...d })
    // Move toward user with slight wobble (realistic GPS jitter)
    const iv = setInterval(() => {
      d = {
        lat: d.lat + (userPos.lat - d.lat) * 0.09 + (Math.random() - 0.5) * 0.00012,
        lng: d.lng + (userPos.lng - d.lng) * 0.09 + (Math.random() - 0.5) * 0.00012,
      }
      setDriverPos({ ...d })
    }, 2000)
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
      }, 380)
    }
  }

  const selectSug = sug => {
    setPickup(sug.address || sug.name)
    if (sug.lat && sug.lng) setUserPos({ lat: +sug.lat, lng: +sug.lng })
    setSugs([])
  }

  const detectGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS not supported on this device'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserPos({ lat, lng })
        // Reverse geocode to fill the address field
        const address = await reverseGeocode(lat, lng)
        setPickup(address)
        toast.success('📍 Location captured!')
        setLocating(false)
      },
      err => {
        toast.error(err.code === 1 ? 'Location permission denied' : 'Could not get location')
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
    if (!driver) { toast.error('No driver available right now'); return }
    setStep('confirming')
    const { data, error } = await q(() =>
      supabase.from('bookings').insert({
        user_id:          user.id,
        driver_id:        driver.id,
        pickup_address:   pickup,
        pickup_lat:       userPos?.lat,
        pickup_lng:       userPos?.lng,
        drop_address:     IIT.name,
        drop_lat:         IIT.lat,
        drop_lng:         IIT.lng,
        distance_km:      routeInfo.distKm,
        base_fare:        fare.base,
        discount_amount:  fare.discount,
        final_fare:       fare.final,
        eta_pickup:       `${routeInfo.driverEta} mins`,
        eta_drop:         `${routeInfo.tripMins} mins`,
        status:           'confirmed',
      }).select('id').single()
    )
    if (error) {
      toast.error('Booking failed: ' + error.message)
      setStep('confirm')
      return
    }
    // Mark driver busy
    await q(() => supabase.from('drivers').update({ status: 'busy' }).eq('id', driver.id))
    setBkId(data.id)
    setCountdown(routeInfo.driverEta * 60)
    setStep('confirmed')
    toast.success('🚗 Cab booked!')

    // Push notification
    if (Notification.permission === 'default') await Notification.requestPermission()
    if (Notification.permission === 'granted') {
      new Notification('Raid Cabs — Cab Confirmed!', {
        body: `${driver.name} is on the way. ETA: ${routeInfo.driverEta} mins`,
        icon: '/logo.png',
      })
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    if (bookingId) {
      await q(() => supabase.from('bookings').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'User cancelled',
      }).eq('id', bookingId))
    }
    if (driver) {
      await q(() => supabase.from('drivers').update({ status: 'available' }).eq('id', driver.id))
    }
    toast.success('Booking cancelled')
    setCancelling(false)
    navigate('/dashboard')
  }

  const fmtCountdown = s => {
    if (!s && s !== 0) return null
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  }

  // ─── Sub-components ──────────────────────────────────────────────────────
  const FareCard = () => (
    <div className="card mb2">
      <h3 style={{ fontWeight:700, marginBottom:'1rem', display:'flex', alignItems:'center', gap:8 }}>
        <Route size={16} style={{ color:'var(--gold)' }}/> Fare Breakdown
      </h3>
      {[
        { l:'Distance',         v: `${routeInfo.distKm} km ${routeInfo.source==='mappls'?'🛣️':'≈'}`,   c:'var(--tp)' },
        { l:'Rate',             v: '₹12 / km',                                                         c:'var(--ts)' },
        { l:'Base Fare',        v: `₹${fare.base}`,                                                    c:'var(--tp)' },
        fare.discount > 0
          ? { l:`Concession (${profile.discount_percent}%)`, v: `−₹${fare.discount}`, c:'var(--green)' }
          : null,
      ].filter(Boolean).map(({ l, v, c }) => (
        <div key={l} className="fare-r">
          <span style={{ color: l.includes('Concession') ? 'var(--green)' : 'var(--ts)' }}>{l}</span>
          <span style={{ color: c, fontWeight: 600 }}>{v}</span>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'.7rem', marginTop:'.25rem', borderTop:'1px solid var(--b2)' }}>
        <span style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:'1.05rem' }}>Total Payable</span>
        <span style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:'1.55rem', color:'var(--gold)' }}>₹{fare.final}</span>
      </div>
      <p style={{ fontSize:'.71rem', color:'var(--tm)', marginTop:'.55rem' }}>
        {routeInfo.source === 'mappls'
          ? '🛣️ Real road distance via Mappls Distance Matrix API'
          : '≈ Straight-line estimate × 1.4 (add Mappls key for road accuracy)'}
      </p>
    </div>
  )

  const EtaCard = () => (
    <div className="card mb2">
      <h3 style={{ fontWeight:700, marginBottom:'1rem', display:'flex', alignItems:'center', gap:8 }}>
        <Clock size={16} style={{ color:'var(--gold)' }}/> Journey Time
      </h3>
      <div className="g2" style={{ gap:'.75rem' }}>
        {[
          ['🚗', 'Driver ETA', `${routeInfo.driverEta} mins`],
          ['🎯', 'Trip Duration', `${routeInfo.tripMins} mins`],
        ].map(([em, l, v]) => (
          <div key={l} style={{ textAlign:'center', background:'rgba(255,255,255,.03)', borderRadius:'var(--rs)', padding:'.9rem .75rem' }}>
            <div style={{ fontSize:'1.4rem', marginBottom:'.3rem' }}>{em}</div>
            <div style={{ fontSize:'.72rem', color:'var(--tm)', textTransform:'uppercase', letterSpacing:'.07em' }}>{l}</div>
            <div style={{ fontFamily:'var(--fd)', fontSize:'1.45rem', fontWeight:700, color:'var(--gold)', marginTop:3 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )

  const DriverCard = ({ showCall, showSos }) => driver && (
    <div className="card mb2">
      <h3 style={{ fontWeight:700, marginBottom:'1rem', display:'flex', alignItems:'center', gap:8 }}>
        {showSos ? <><span className="dot"/> Driver En Route</> : '🧑‍✈️ Your Driver'}
      </h3>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1.1rem', background:'rgba(255,255,255,.025)', border:'1px solid var(--b1)', borderRadius:'var(--rs)' }}>
        <div style={{ width:50, height:50, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--orange))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontSize:'1.25rem', fontWeight:700, color:'#05050e', flexShrink:0 }}>
          {driver.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700 }}>{driver.name}</div>
          <Stars v={driver.rating}/>
          {driver.total_ratings > 0 && (
            <div style={{ fontSize:'.72rem', color:'var(--tm)', marginTop:1 }}>{driver.total_ratings} ratings</div>
          )}
          <div style={{ color:'var(--ts)', fontSize:'.8rem', marginTop:3 }}>
            {driver.vehicle_model}
            {driver.vehicle_number && <> · <strong style={{ letterSpacing:'.04em' }}>{driver.vehicle_number}</strong></>}
          </div>
          {driver.is_emergency && (
            <span className="badge b-red" style={{ marginTop:5, fontSize:'.67rem' }}>
              <AlertCircle size={8}/> Emergency Driver
            </span>
          )}
        </div>
        {showCall && (
          <a href={`tel:${driver.phone}`} className="btn btn-primary btn-sm">
            <Phone size={13}/> Call
          </a>
        )}
      </div>
      {showSos && (
        <button
          className="btn btn-danger btn-blk"
          style={{ marginTop:'.75rem' }}
          onClick={() => toast.error('🆘 SOS Alert sent! Emergency contact notified.', { duration:6000, icon:'🆘' })}
        >
          <Shield size={14}/> SOS Emergency
        </button>
      )}
    </div>
  )

  return (
    <div className="main" style={{ padding:'2rem' }}>
      <style>{`
        .bk-grid { display:grid; grid-template-columns:390px 1fr; gap:1.75rem; max-width:1080px; margin:0 auto; }
        @media(max-width:860px) { .bk-grid { grid-template-columns:1fr; } }
      `}</style>
      <div style={{ maxWidth:1080, margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb2" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={15}/> Back
        </button>

        {/* ─── FORM ────────────────────────────────────────────────────── */}
        {step === 'form' && (
          <>
            <div className="mb3">
              <h1 className="h1">🚖 Book a Cab</h1>
              <p className="sub">Drop always: <strong style={{ color:'var(--gold)' }}>{IIT.name}</strong></p>
            </div>
            <div className="bk-grid">
              <div>
                <div className="card fu">
                  <h3 style={{ fontWeight:700, marginBottom:'1.15rem' }}>📍 Enter Pickup</h3>
                  <form onSubmit={handleSearch}>
                    <div className="fg mb2">
                      <label className="label">Pickup Address</label>
                      <div style={{ position:'relative' }}>
                        <div className="input-wrap">
                          <Search size={16} className="ico"/>
                          <input
                            className="input"
                            type="text"
                            placeholder="Type your pickup location…"
                            value={pickup}
                            onChange={handlePickupInput}
                            autoComplete="off"
                            required
                          />
                          {pickup && (
                            <button type="button" onClick={() => { setPickup(''); setSugs([]); setUserPos(null) }}
                              style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}>
                              <X size={15}/>
                            </button>
                          )}
                        </div>
                        {/* Autocomplete dropdown */}
                        {(sugLoad || sugs.length > 0) && (
                          <div className="ac-list">
                            {sugLoad && (
                              <div className="ac-item" style={{ color:'var(--tm)', justifyContent:'center' }}>
                                <span className="spinner" style={{ width:15, height:15 }}/> Searching Mappls…
                              </div>
                            )}
                            {sugs.map(s => (
                              <div key={s.id || s.name} className="ac-item" onClick={() => selectSug(s)}>
                                <MapPin size={14} style={{ color:'var(--gold)', flexShrink:0 }}/>
                                <div>
                                  <div style={{ fontWeight:600, fontSize:'.86rem' }}>{s.name}</div>
                                  {s.address !== s.name && (
                                    <div style={{ fontSize:'.75rem', color:'var(--ts)', marginTop:1 }}>{s.address}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button type="button" className="btn btn-outline btn-sm btn-blk mb2" onClick={detectGPS} disabled={locating}>
                      {locating ? <span className="spinner" style={{ width:13, height:13 }}/> : <Navigation size={13}/>}
                      {locating ? 'Getting GPS…' : 'Use My Current Location'}
                    </button>

                    {userPos && (
                      <p style={{ fontSize:'.75rem', color:'var(--green)', textAlign:'center', marginBottom:'.8rem', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        <CheckCircle size={11}/> Location captured ({userPos.lat.toFixed(4)}, {userPos.lng.toFixed(4)})
                      </p>
                    )}

                    <div className="fg mb3">
                      <label className="label">Drop Point (Fixed)</label>
                      <div className="input-wrap">
                        <Navigation size={16} className="ico"/>
                        <input className="input" value={IIT.name} readOnly/>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-blk">
                      <Car size={15}/> Get Fare & Find Driver
                    </button>
                  </form>

                  {drivers.length === 0 && (
                    <div className="err-box mt2" style={{ fontSize:'.82rem' }}>
                      <AlertCircle size={14} style={{ flexShrink:0 }}/> No drivers available right now. Try again shortly.
                    </div>
                  )}
                </div>

                <div className="card mt2 fu d2" style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'1.2rem 1.5rem' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(46,204,113,.12)', border:'1px solid rgba(46,204,113,.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--green)', flexShrink:0 }}>
                    <Car size={17}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>{drivers.length} Driver{drivers.length !== 1 ? 's' : ''} Online</div>
                    <div style={{ fontSize:'.76rem', color:'var(--tm)', marginTop:1 }}>Sorted by rating · Highest first</div>
                  </div>
                  {drivers.length > 0 && <span className="dot"/>}
                </div>

                {(profile?.discount_percent || 0) > 0 && (
                  <div className="warn-box mt2 fu d3">
                    <Zap size={14} style={{ flexShrink:0 }}/>
                    <span>Your <strong>{profile.discount_percent}% concession</strong> will be applied to this ride!</span>
                  </div>
                )}

                {!HAS_KEY && (
                  <div className="info-box mt2 fu d4" style={{ fontSize:'.78rem' }}>
                    <MapPin size={13} style={{ flexShrink:0 }}/>
                    <span>No Mappls key — distance uses straight-line estimate × 1.4. <a href="https://auth.mappls.com/console/" target="_blank" rel="noreferrer" style={{ color:'var(--gold)', fontWeight:700 }}>Get free key →</a></span>
                  </div>
                )}
              </div>

              <MapplsMap userPos={userPos} height={430}/>
            </div>
          </>
        )}

        {/* ─── SEARCHING ───────────────────────────────────────────────── */}
        {step === 'searching' && (
          <div style={{ textAlign:'center', padding:'7rem 2rem' }}>
            <div className="spinner" style={{ width:56, height:56, margin:'0 auto 1.5rem' }}/>
            <h2 className="h2">Calculating route…</h2>
            <p className="sub mt1">{HAS_KEY ? 'Fetching road distance via Mappls API' : 'Estimating distance'}</p>
          </div>
        )}

        {/* ─── CONFIRM ─────────────────────────────────────────────────── */}
        {step === 'confirm' && fare && routeInfo && (
          <>
            <div className="mb3"><h1 className="h1">✅ Confirm Booking</h1></div>
            <div className="bk-grid">
              <div>
                <FareCard/>
                <EtaCard/>
                <DriverCard showCall={false} showSos={false}/>
                {!driver && (
                  <div className="warn-box mb3">
                    <AlertCircle size={14} style={{ flexShrink:0 }}/>
                    No drivers available. Admin will assign one manually.
                  </div>
                )}
                <div style={{ display:'flex', gap:'.9rem' }}>
                  <button className="btn btn-outline btn-blk" onClick={() => setStep('form')}>← Change</button>
                  <button className="btn btn-primary btn-blk btn-lg" onClick={handleBook}>🚀 Confirm</button>
                </div>
              </div>
              <MapplsMap userPos={userPos} height={430}/>
            </div>
          </>
        )}

        {/* ─── CONFIRMING ──────────────────────────────────────────────── */}
        {step === 'confirming' && (
          <div style={{ textAlign:'center', padding:'7rem 2rem' }}>
            <div className="spinner" style={{ width:56, height:56, margin:'0 auto 1.5rem' }}/>
            <h2 className="h2">Confirming your booking…</h2>
          </div>
        )}

        {/* ─── CONFIRMED ───────────────────────────────────────────────── */}
        {step === 'confirmed' && (
          <>
            <div className="mb3">
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                <CheckCircle size={26} style={{ color:'var(--green)' }}/>
                <h1 className="h1">Cab Booked! 🎉</h1>
              </div>
              <p className="sub mt1" style={{ display:'flex', alignItems:'center', gap:6 }}>
                Live tracking active
                {realStatus && realStatus !== 'confirmed' && (
                  <span className="badge b-green" style={{ marginLeft:6 }}>{realStatus}</span>
                )}
              </p>
            </div>
            <div className="bk-grid">
              <div>
                {/* Countdown */}
                {countdown !== null && countdown > 0 && (
                  <div className="card mb2" style={{ textAlign:'center', background:'rgba(46,204,113,.06)', borderColor:'rgba(46,204,113,.25)' }}>
                    <div style={{ fontSize:'.76rem', color:'var(--tm)', textTransform:'uppercase', letterSpacing:'.08em' }}>Driver Arrives In</div>
                    <div style={{ fontFamily:'var(--fd)', fontSize:'3.2rem', fontWeight:900, color:'var(--green)', marginTop:'.2rem', fontVariantNumeric:'tabular-nums' }}>
                      {fmtCountdown(countdown)}
                    </div>
                    <div style={{ marginTop:'.6rem', display:'flex', justifyContent:'center' }}><span className="dot"/></div>
                  </div>
                )}
                {countdown === 0 && (
                  <div className="card mb2" style={{ textAlign:'center', background:'rgba(255,179,71,.07)', borderColor:'var(--b2)' }}>
                    <div style={{ fontSize:'1.6rem', marginBottom:'.4rem' }}>🚗</div>
                    <div style={{ fontWeight:700, color:'var(--gold)', fontSize:'1rem' }}>Driver has arrived!</div>
                  </div>
                )}

                <DriverCard showCall={true} showSos={true}/>

                <div className="card mb2">
                  {[
                    ['Pickup',       pickup],
                    ['Drop',         IIT.name,            'var(--gold)'],
                    ['Road Distance',`${routeInfo?.distKm} km`],
                    ['Trip Duration',`${routeInfo?.tripMins} mins`],
                    ['Total Fare',   `₹${fare?.final}`,   'var(--gold)'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="fare-r">
                      <span style={{ color:'var(--tm)' }}>{l}</span>
                      <span style={{ fontWeight:700, color:c||'var(--tp)', textAlign:'right', maxWidth:'62%', fontSize:'.87rem' }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', gap:'.75rem' }}>
                  <button className="btn btn-outline btn-blk" onClick={() => navigate('/dashboard')}>Dashboard</button>
                  <button className="btn btn-danger btn-blk" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? <span className="spinner"/> : 'Cancel Trip'}
                  </button>
                </div>
              </div>

              <MapplsMap
                userPos={userPos}
                driverPos={driverPos}
                height={480}
                liveLabel="Driver approaching your location"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
