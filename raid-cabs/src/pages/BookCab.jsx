import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getRouteInfo, searchPlaces, reverseGeocode, calcFare, calcConcession, searchCampusPlaces, CAMPUS_PLACES } from '../lib/location'
import LiveMap from '../components/LiveMap'
import { ArrowLeft, MapPin, Navigation, CheckCircle, Zap, X, Search, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const MIN_ADVANCE_HOURS = 1

export default function BookCab() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  // Pickup
  const [pickup,      setPickup]    = useState('')
  const [userPos,     setUserPos]   = useState(null)
  const [sugs,        setSugs]      = useState([])
  const [sugLoad,     setSugLoad]   = useState(false)
  const [showSugs,    setShowSugs]  = useState(false)
  const [locating,    setLocating]  = useState(false)

  // Drop (custom)
  const [drop,        setDrop]      = useState('')
  const [dropPos,     setDropPos]   = useState(null)
  const [dropSugs,    setDropSugs]  = useState([])
  const [dropSugLoad, setDropSugLoad] = useState(false)
  const [showDropSugs,setShowDropSugs] = useState(false)

  // Schedule + extras
  const [schedTime,   setSchedTime] = useState('')
  const [notes,       setNotes]     = useState('')
  const [fareRate,    setFareRate]  = useState({ rate_per_km:12, minimum_fare:80 })
  const [farePreview, setFarePreview] = useState(null)
  const [routeGeo,    setRouteGeo]  = useState(null)

  // Flow
  const [step,        setStep]      = useState('form') // form|confirm|submitting|done
  const [routeInfo,   setRoute]     = useState(null)
  const [fare,        setFare]      = useState(null)

  const pickupRef = useRef(null)
  const dropRef   = useRef(null)
  const sugTimer  = useRef(null)
  const dropTimer = useRef(null)

  const concession = calcConcession(profile?.total_deposited || 0)

  useEffect(() => {
    q(() => supabase.from('fare_settings').select('*').limit(1).maybeSingle())
      .then(({ data }) => { if (data) setFareRate({ rate_per_km: data.rate_per_km, minimum_fare: data.minimum_fare }) })
  }, [])

  // Live fare + route preview (geometry comes from getRouteInfo now)
  useEffect(() => {
    if (!userPos || !dropPos) { setFarePreview(null); setRouteGeo(null); return }
    getRouteInfo(userPos, dropPos).then(info => {
      setFarePreview(calcFare(info.distKm, concession, fareRate.rate_per_km, fareRate.minimum_fare))
      setRoute(info)
      if (info.geometry) setRouteGeo(info.geometry)
    })
  }, [userPos, dropPos, fareRate, concession])

  // Autocomplete helper
  const makeSearch = (setValue, setPos, setS, setLoad, setShow, timer) => e => {
    const v = e.target.value
    setValue(v); setS([]); setShow(true)
    if (timer.current) clearTimeout(timer.current)
    if (!v.trim()) { setLoad(false); return }
    const campus = searchCampusPlaces(v)
    if (campus.length) setS(campus)
    if (v.length >= 2) {
      setLoad(true)
      timer.current = setTimeout(async () => {
        const api    = await searchPlaces(v)
        const cIds   = new Set(campus.map(p => p.id))
        const merged = [...campus, ...api.filter(p => !cIds.has(p.id))].slice(0, 7)
        setS(merged); setLoad(false)
      }, 350)
    } else setLoad(false)
  }

  const handlePickupInput = makeSearch(setPickup, setUserPos, setSugs, setSugLoad, setShowSugs, sugTimer)
  const handleDropInput   = makeSearch(setDrop, setDropPos, setDropSugs, setDropSugLoad, setShowDropSugs, dropTimer)

  const selectPickup = sug => {
    setPickup(sug.address || sug.name)
    if (sug.lat && sug.lng) setUserPos({ lat: sug.lat, lng: sug.lng })
    setSugs([]); setShowSugs(false)
  }

  const selectDrop = sug => {
    setDrop(sug.name || sug.address)
    if (sug.lat && sug.lng) setDropPos({ lat: sug.lat, lng: sug.lng, label: sug.name })
    setDropSugs([]); setShowDropSugs(false)
  }

  const detectGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS not available'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude:lat, longitude:lng } = pos.coords
        setUserPos({ lat, lng })
        const address = await reverseGeocode(lat, lng)
        setPickup(address); setShowSugs(false)
        toast.success('📍 Location detected!')
        setLocating(false)
      },
      () => { toast.error('Could not get location'); setLocating(false) },
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    )
  }

  const minTime = () => {
    const d = new Date()
    d.setHours(d.getHours() + MIN_ADVANCE_HOURS)
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
    return d.toISOString().slice(0, 16)
  }

  const handleSearch = async e => {
    e.preventDefault()
    setSugs([]); setShowSugs(false); setDropSugs([]); setShowDropSugs(false)
    if (!pickup.trim())  { toast.error('Enter pickup location'); return }
    if (!drop.trim())    { toast.error('Enter drop location'); return }
    if (!dropPos)        { toast.error('Select a drop location from the list'); return }
    if (!schedTime)      { toast.error(`Schedule at least ${MIN_ADVANCE_HOURS} hour in advance`); return }
    const sDate = new Date(schedTime), minD = new Date()
    minD.setHours(minD.getHours() + MIN_ADVANCE_HOURS)
    if (sDate < minD)    { toast.error(`Must be at least ${MIN_ADVANCE_HOURS} hour in advance`); return }
    const pos = userPos || { lat:17.4065, lng:78.4772 }
    setUserPos(pos)
    const info = await getRouteInfo(pos, dropPos)
    setRoute(info)
    setFare(calcFare(info.distKm, concession, fareRate.rate_per_km, fareRate.minimum_fare))
    if (info.geometry) setRouteGeo(info.geometry)
    setStep('confirm')
  }

  const handleSubmit = async () => {
    setStep('submitting')
    const { error } = await q(() => supabase.from('bookings').insert({
      user_id:         user.id,
      pickup_address:  pickup,
      pickup_lat:      userPos?.lat,
      pickup_lng:      userPos?.lng,
      drop_address:    drop,
      drop_lat:        dropPos?.lat,
      drop_lng:        dropPos?.lng,
      distance_km:     routeInfo?.distKm,
      base_fare:       fare?.base,
      discount_amount: fare?.discount,
      final_fare:      fare?.final,
      status:          'pending_admin',
      is_scheduled:    true,
      scheduled_at:    new Date(schedTime).toISOString(),
      admin_notes:     notes.trim() || null,
      eta_drop:        `${routeInfo?.tripMins} mins`,
    }))
    if (error) { toast.error('Booking failed: ' + error.message); setStep('confirm'); return }
    toast.success('📋 Booking sent to admin!')
    setStep('done')
  }

  const SugList = ({ sugs, loading, onSelect, show, header }) => show && (sugs.length > 0 || loading || !pickup) ? (
    <div className="ac-list">
      {!loading && sugs.length === 0 && (
        <>
          <div style={{ padding:'.42rem 1rem', fontSize:'.69rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--tm)', background:'rgba(255,255,255,.02)', borderBottom:'1px solid var(--b1)' }}>
            {header}
          </div>
          {CAMPUS_PLACES.slice(0, 5).map(p => (
            <div key={p.id} className="ac-item" onMouseDown={() => onSelect(p)}>
              <MapPin size={13} style={{ color:'var(--gold)', flexShrink:0 }}/>
              <div>
                <div style={{ fontWeight:600, fontSize:'.86rem' }}>{p.name}</div>
                <div style={{ fontSize:'.73rem', color:'var(--ts)', marginTop:1 }}>{p.address}</div>
              </div>
            </div>
          ))}
        </>
      )}
      {loading && <div className="ac-item" style={{ color:'var(--tm)', justifyContent:'center' }}><span className="spinner" style={{ width:14,height:14 }}/> Searching…</div>}
      {sugs.map(s => (
        <div key={s.id} className="ac-item" onMouseDown={() => onSelect(s)}>
          <MapPin size={13} style={{ color:'var(--gold)', flexShrink:0 }}/>
          <div>
            <div style={{ fontWeight:600, fontSize:'.86rem' }}>{s.name}</div>
            {s.address !== s.name && <div style={{ fontSize:'.73rem', color:'var(--ts)', marginTop:1 }}>{s.address}</div>}
          </div>
        </div>
      ))}
    </div>
  ) : null

  if (step === 'form') return (
    <div className="main page-pad">
      <div className="page-inner">
        <button className="btn btn-ghost btn-sm mb2" onClick={() => navigate('/dashboard')}><ArrowLeft size={14}/> Back</button>
        <div className="mb3">
          <h1 className="h1">Schedule a Ride 📅</h1>
          <p className="sub">Book in advance — admin assigns your driver</p>
        </div>
        <div className="two-col-layout">
          <div>
            <div className="card fu">
              <form onSubmit={handleSearch} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

                {/* PICKUP */}
                <div className="fg">
                  <label className="label">📍 Pickup Location</label>
                  <div style={{ position:'relative' }}>
                    <div className="input-wrap">
                      <Search size={15} className="ico"/>
                      <input ref={pickupRef} className="input" type="text" name="pickup" autoComplete="off"
                        placeholder="Where should we pick you up?" value={pickup}
                        onChange={handlePickupInput}
                        onFocus={() => setShowSugs(true)}
                        onBlur={() => setTimeout(() => setShowSugs(false), 180)}
                        required/>
                      {pickup && <button type="button" onClick={() => { setPickup(''); setSugs([]); setUserPos(null); setFarePreview(null); pickupRef.current?.focus() }}
                        style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}><X size={14}/></button>}
                    </div>
                    <SugList sugs={sugs} loading={sugLoad} onSelect={selectPickup} show={showSugs} header="📍 Nearby Locations"/>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" style={{ marginTop:'.5rem', alignSelf:'flex-start' }} onClick={detectGPS} disabled={locating}>
                    {locating ? <span className="spinner" style={{ width:13,height:13 }}/> : <Navigation size={13}/>}
                    {locating ? 'Detecting…' : 'Use My Location'}
                  </button>
                  {userPos && <p style={{ fontSize:'.73rem', color:'var(--green)', display:'flex', alignItems:'center', gap:4, marginTop:'.35rem' }}><CheckCircle size={11}/> Pickup pinned</p>}
                </div>

                {/* DROP — fully searchable */}
                <div className="fg">
                  <label className="label">🏁 Drop Location</label>
                  <div style={{ position:'relative' }}>
                    <div className="input-wrap">
                      <MapPin size={15} className="ico"/>
                      <input ref={dropRef} className="input" type="text" name="drop" autoComplete="off"
                        placeholder="Hotel, airport, hospital, campus…" value={drop}
                        onChange={handleDropInput}
                        onFocus={() => setShowDropSugs(true)}
                        onBlur={() => setTimeout(() => setShowDropSugs(false), 180)}
                        required/>
                      {drop && <button type="button" onClick={() => { setDrop(''); setDropSugs([]); setDropPos(null); setFarePreview(null); dropRef.current?.focus() }}
                        style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}><X size={14}/></button>}
                    </div>
                    <SugList sugs={dropSugs} loading={dropSugLoad} onSelect={selectDrop} show={showDropSugs} header="🏁 Popular Destinations"/>
                  </div>
                  {dropPos && <p style={{ fontSize:'.73rem', color:'var(--green)', display:'flex', alignItems:'center', gap:4, marginTop:'.35rem' }}><CheckCircle size={11}/> Drop pinned — {drop}</p>}
                </div>

                {/* Schedule */}
                <div className="fg">
                  <label className="label"><Calendar size={12} style={{ display:'inline', marginRight:4, verticalAlign:'middle' }}/>Pickup Date & Time *</label>
                  <input className="input" type="datetime-local" min={minTime()} value={schedTime} onChange={e => setSchedTime(e.target.value)} required/>
                  <p className="hint">Minimum {MIN_ADVANCE_HOURS} hour in advance</p>
                </div>

                {/* Notes */}
                <div className="fg">
                  <label className="label">Notes for Admin (optional)</label>
                  <textarea className="input" placeholder="e.g. heavy luggage, 7-seater needed…" value={notes} onChange={e => setNotes(e.target.value)} rows={2}/>
                </div>

                {/* Fare preview */}
                {farePreview && (
                  <div style={{ background:'rgba(245,166,35,.07)', border:'1px solid rgba(245,166,35,.18)', borderRadius:'var(--rs)', padding:'.9rem 1rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:'.72rem', color:'var(--ts)', textTransform:'uppercase', letterSpacing:'.07em' }}>Estimated Fare</div>
                        {farePreview.discount > 0 && <div style={{ fontSize:'.73rem', color:'var(--green)', marginTop:2 }}>₹{farePreview.discount} concession applied</div>}
                        {routeInfo?.source === 'ors' && <div style={{ fontSize:'.72rem', color:'var(--ts)', marginTop:1 }}>🛣️ Real road distance</div>}
                      </div>
                      <div style={{ fontFamily:'var(--fd)', fontSize:'1.65rem', fontWeight:900, color:'var(--gold)' }}>₹{farePreview.final}</div>
                    </div>
                  </div>
                )}

                {concession > 0 && <div className="good-box"><Zap size={13} style={{ flexShrink:0 }}/> ₹{concession} concession per ride from your deposit</div>}

                <button type="submit" className="btn btn-primary btn-blk btn-lg">
                  <Calendar size={15}/> Check Fare & Continue
                </button>
              </form>
            </div>
          </div>

          <LiveMap userPos={userPos} dropPos={dropPos ? { ...dropPos } : null} routeGeo={routeGeo} height={460}/>
        </div>
      </div>
    </div>
  )

  if (step === 'confirm') return (
    <div className="main page-pad">
      <div className="two-col-layout page-inner">
        <div>
          <button className="btn btn-ghost btn-sm mb2" onClick={() => setStep('form')}><ArrowLeft size={14}/> Change</button>
          <h2 className="h2 mb3">Confirm Booking</h2>
          <div className="good-box mb2"><Calendar size={14} style={{ flexShrink:0 }}/><span><strong>Scheduled:</strong> {new Date(schedTime).toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>
          <div className="info-box mb3" style={{ fontSize:'.82rem' }}>Admin will assign a driver. You'll see the booking in your dashboard once confirmed.</div>
          <div className="card mb2">
            <h3 className="h4 mb2" style={{ color:'var(--ts)' }}>Fare Breakdown</h3>
            {[['Distance',`${routeInfo?.distKm} km`],['Rate',`₹${fareRate.rate_per_km}/km`],['Base Fare',`₹${fare?.base}`],
              ...(fare?.discount > 0 ? [['Concession',`−₹${fare.discount}`,'var(--green)']] : [])
            ].map(([l,v,col]) => (
              <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ color:col||'var(--tp)', fontWeight:600 }}>{v}</span></div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'.7rem', marginTop:'.25rem', borderTop:'1px solid var(--b2)' }}>
              <span style={{ fontFamily:'var(--fd)', fontWeight:700 }}>Total</span>
              <span style={{ fontFamily:'var(--fd)', fontSize:'1.65rem', fontWeight:900, color:'var(--gold)' }}>₹{fare?.final}</span>
            </div>
          </div>
          <div className="card mb3">
            {[['Pickup',pickup],['Drop',drop],['Distance',`${routeInfo?.distKm} km`],['Est. trip',`~${routeInfo?.tripMins} mins`]].map(([l,v]) => (
              <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ fontWeight:600, maxWidth:'60%', textAlign:'right', fontSize:'.86rem' }}>{v}</span></div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'.85rem' }}>
            <button className="btn btn-outline w100" onClick={() => setStep('form')}>← Back</button>
            <button className="btn btn-primary w100 btn-lg" onClick={handleSubmit}>📤 Submit to Admin</button>
          </div>
        </div>
        <LiveMap userPos={userPos} dropPos={dropPos ? { ...dropPos, label: drop } : null} routeGeo={routeGeo} height={440}/>
      </div>
    </div>
  )

  if (step === 'submitting') return (
    <div className="main" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:'1.25rem' }}>
      <div className="spinner" style={{ width:48, height:48 }}/><p className="sub">Submitting…</p>
    </div>
  )

  return (
    <div className="main page-pad">
      <div style={{ maxWidth:480, margin:'0 auto', textAlign:'center' }}>
        <div style={{ width:84, height:84, background:'rgba(245,166,35,.1)', border:'2px solid rgba(245,166,35,.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', fontSize:'2.5rem' }}>📋</div>
        <h1 className="h2 mb2">Booking Submitted!</h1>
        <p style={{ color:'var(--ts)', lineHeight:1.75, marginBottom:'2rem' }}>Admin will review and assign a driver. Check your dashboard for updates.</p>
        <div className="card mb3" style={{ textAlign:'left' }}>
          {[['Pickup',pickup],['Drop',drop],['Scheduled',new Date(schedTime).toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})],['Fare',`₹${fare?.final}${fare?.discount>0?` (−₹${fare?.discount} concession)`:''}`],['Status','⏳ Pending Admin Approval']].map(([l,v])=>(
            <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ fontWeight:600, color:l==='Status'?'var(--gold)':'var(--tp)', maxWidth:'55%', textAlign:'right', fontSize:'.86rem' }}>{v}</span></div>
          ))}
        </div>
        <button className="btn btn-primary btn-blk btn-lg" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    </div>
  )
}
