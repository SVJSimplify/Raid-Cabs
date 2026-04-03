import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getRouteInfo, searchPlaces, reverseGeocode, calcFare } from '../lib/location'
import LiveMap from '../components/LiveMap'
import SafetyPanel from '../components/SafetyPanel'
import ChatWidget from '../components/ChatWidget'
import { ArrowLeft, MapPin, Navigation, Phone, AlertCircle, CheckCircle, Car, Clock, Zap, X, Search, Shield, MessageSquare, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const IIT = { lat:17.5934, lng:78.1270, name:'IIT Hyderabad, Sangareddy' }

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
    <span style={{ display:'inline-flex', gap:1 }}>
      {[1,2,3,4,5].map(i=><span key={`s-${i}`} style={{ fontSize:'.8rem', color:i<=Math.round(v)?'var(--gold)':'var(--tm)' }}>★</span>)}
      <span style={{ marginLeft:4, fontSize:'.77rem', color:'var(--ts)' }}>{Number(v).toFixed(1)}</span>
    </span>
  )
}

export default function BookCab() {
  const { user, profile } = useAuth()
  const navigate          = useNavigate()

  // Form
  const [pickup,     setPickup]    = useState('')
  const [userPos,    setUserPos]   = useState(null)
  const [sugs,       setSugs]      = useState([])
  const [sugLoading, setSugLoad]   = useState(false)
  const [locating,   setLocating]  = useState(false)
  const [scheduled,  setScheduled] = useState(false)
  const [schedTime,  setSchedTime] = useState('')
  const [farePreview,setFarePreview]=useState(null)
  const [fareRate,   setFareRate]  = useState({ rate_per_km:12, minimum_fare:80 })

  // Booking flow
  const [step,       setStep]      = useState('form')
  const [drivers,    setDrivers]   = useState([])
  const [driver,     setDriver]    = useState(null)
  const [routeInfo,  setRoute]     = useState(null)
  const [fare,       setFare]      = useState(null)
  const [bookingId,  setBkId]      = useState(null)
  const [bookingData,setBookingData]=useState(null)
  const [countdown,  setCountdown] = useState(null)
  const [driverPos,  setDriverPos] = useState(null)
  const [cancelling, setCancelling]= useState(false)
  const [cancelModal,setCancelModal]=useState(false)
  const [cancelReason,setCancelR]  = useState('')
  const [liveStatus, setLiveStatus]= useState(null)
  const [chatOpen,   setChatOpen]  = useState(false)

  const sugTimer = useRef(null)

  // Fetch fare settings from admin
  useEffect(() => {
    q(() => supabase.from('fare_settings').select('*').limit(1).maybeSingle())
      .then(({ data }) => { if (data) setFareRate({ rate_per_km: data.rate_per_km, minimum_fare: data.minimum_fare }) })
  }, [])

  // Load drivers
  useEffect(() => {
    q(() => supabase.from('drivers').select('*').eq('status','available').eq('is_approved',true).order('rating',{ascending:false}))
      .then(({ data }) => setDrivers(data||[]))
  }, [])

  // Real-time booking status
  useEffect(() => {
    if (!bookingId) return
    const ch = supabase.channel(`bk-${bookingId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'bookings',filter:`id=eq.${bookingId}`},
        ({new:r})=>{
          setLiveStatus(r.status)
          if (r.status==='completed') toast.success('Trip completed! Please rate your driver ⭐')
          if (r.status==='cancelled') { toast.error('Booking cancelled'); navigate('/dashboard') }
        })
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[bookingId,navigate])

  // Countdown
  useEffect(()=>{
    if (!countdown||countdown<=0) return
    const t=setTimeout(()=>setCountdown(c=>c-1),1000)
    return ()=>clearTimeout(t)
  },[countdown])

  // Real driver location from Supabase realtime
  useEffect(()=>{
    if (step!=='confirmed'||!driver) return
    // Load initial position
    supabase.from('drivers').select('current_lat,current_lng').eq('id',driver.id).single()
      .then(({data})=>{ if(data?.current_lat) setDriverPos({lat:data.current_lat,lng:data.current_lng}) })
    // Subscribe to updates
    const ch = supabase.channel(`driver-loc-${driver.id}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'drivers',filter:`id=eq.${driver.id}`},
        ({new:d})=>{ if(d.current_lat) setDriverPos({lat:d.current_lat,lng:d.current_lng}) })
      .subscribe()
    return ()=>supabase.removeChannel(ch)
  },[step,driver])

  // Live fare preview as user types pickup
  useEffect(()=>{
    if (!userPos) { setFarePreview(null); return }
    getRouteInfo(userPos,IIT).then(info=>{
      setFarePreview(calcFare(info.distKm, profile?.discount_percent || 0, fareRate.rate_per_km, fareRate.minimum_fare))
    })
  },[userPos,fareRate,profile])

  const handlePickupInput = e => {
    const v = e.target.value; setPickup(v); setSugs([])
    if (sugTimer.current) clearTimeout(sugTimer.current)
    if (v.length >= 3) {
      setSugLoad(true)
      sugTimer.current=setTimeout(async()=>{const res=await searchPlaces(v);setSugs(res);setSugLoad(false)},420)
    } else setSugLoad(false)
  }

  const selectSug = sug => {
    setPickup(sug.address||sug.name)
    if (sug.lat&&sug.lng) setUserPos({lat:sug.lat,lng:sug.lng})
    setSugs([])
  }

  const detectGPS = () => {
    if (!navigator.geolocation){toast.error('GPS not available');return}
    setLocating(true)
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lng}=pos.coords
      setUserPos({lat,lng})
      const address=await reverseGeocode(lat,lng)
      setPickup(address)
      toast.success('📍 Location detected!')
      setLocating(false)
    },()=>{toast.error('Could not get location');setLocating(false)},{enableHighAccuracy:true,timeout:10000,maximumAge:0})
  }

  const handleSearch = async e => {
    e.preventDefault(); setSugs([])
    if (!pickup.trim()){toast.error('Enter pickup address');return}
    const pos=userPos||{lat:17.4065,lng:78.4772}
    setUserPos(pos); setStep('searching')
    const info=await getRouteInfo(pos,IIT)
    setRoute(info)
    setFare(calcFare(info.distKm, profile?.discount_percent || 0, fareRate.rate_per_km, fareRate.minimum_fare))
    setDriver(drivers[0]||null)
    setStep('confirm')
  }

  const handleBook = async () => {
    if (!driver){toast.error('No drivers available');return}
    setStep('confirming')
    const payload = {
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
      status:           scheduled ? 'pending' : 'confirmed',
      is_scheduled:     scheduled,
      scheduled_at:     scheduled && schedTime ? new Date(schedTime).toISOString() : null,
    }
    const {data,error} = await q(()=>supabase.from('bookings').insert(payload).select('*').single())
    if (error){toast.error('Booking failed: '+error.message);setStep('confirm');return}
    if (!scheduled) await q(()=>supabase.from('drivers').update({status:'busy'}).eq('id',driver.id))
    setBkId(data.id)
    setBookingData(data)
    setCountdown(scheduled?null:routeInfo.driverEta*60)
    setStep('confirmed')
    toast.success(scheduled?'⏰ Ride scheduled!':'🚗 Cab booked!')
    // Send booking confirmation email (silent fail)
    if (user?.email && !user.email.includes('@raidcabs.local')) {
      fetch('/api/send-email', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ type:'ride_booked', bookingId:data.id, email:user.email, data:{ rideCode:profile?.ride_code } })
      }).catch(()=>{})
    }
  }

  const handleCancel = async () => {
    if (!cancelReason){toast.error('Please select a reason');return}
    setCancelling(true)
    await Promise.all([
      bookingId ? q(()=>supabase.from('bookings').update({status:'cancelled',cancelled_at:new Date().toISOString(),cancel_reason_code:cancelReason,cancellation_reason:cancelReason}).eq('id',bookingId)) : null,
      driver    ? q(()=>supabase.from('drivers').update({status:'available'}).eq('id',driver.id))                                                                                                          : null,
    ])
    toast.success('Booking cancelled')
    setCancelling(false)
    setCancelModal(false)
    await new Promise(r=>setTimeout(r,600))
    navigate('/dashboard',{replace:true})
  }

  const fmtCD = s => s>0 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : null
  const minSchedule = () => { const d=new Date(); d.setMinutes(d.getMinutes()+30); return d.toISOString().slice(0,16) }

  // ── FORM ──────────────────────────────────────────────────────────────────
  if (step==='form') return (
    <div className="main" style={{padding:'1.75rem 1.5rem'}}>
      <div style={{maxWidth:1060,margin:'0 auto'}}>
        <button className="btn btn-ghost btn-sm mb2" onClick={()=>navigate('/dashboard')}><ArrowLeft size={15}/> Back</button>
        <div className="mb3">
          <h1 className="h1">Book a Cab 🚖</h1>
          <p className="sub">Drop is always <strong style={{color:'var(--gold)'}}>IIT Hyderabad</strong></p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'380px 1fr',gap:'1.75rem'}}>
          <div>
            <div className="card fu">
              <form onSubmit={handleSearch}>
                {/* Pickup */}
                <div className="fg mb2">
                  <label className="label">Pickup Location</label>
                  <div style={{position:'relative'}}>
                    <div className="input-wrap">
                      <Search size={15} className="ico"/>
                      <input className="input" type="text" placeholder="Where should we pick you up?" value={pickup} onChange={handlePickupInput} autoComplete="off" required/>
                      {pickup&&<button type="button" onClick={()=>{setPickup('');setSugs([]);setUserPos(null);setFarePreview(null)}} style={{position:'absolute',right:'.82rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--tm)',display:'flex',padding:0}}><X size={14}/></button>}
                    </div>
                    {(sugLoading||sugs.length>0)&&(
                      <div className="ac-list">
                        {sugLoading&&<div className="ac-item" style={{color:'var(--tm)',justifyContent:'center'}}><span className="spinner" style={{width:14,height:14}}/> Searching…</div>}
                        {sugs.map(s=>(
                          <div key={s.id} className="ac-item" onClick={()=>selectSug(s)}>
                            <MapPin size={13} style={{color:'var(--gold)',flexShrink:0}}/>
                            <div><div style={{fontWeight:600,fontSize:'.86rem'}}>{s.name}</div>{s.address!==s.name&&<div style={{fontSize:'.74rem',color:'var(--ts)',marginTop:1}}>{s.address}</div>}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button type="button" className="btn btn-outline btn-sm btn-blk mb2" onClick={detectGPS} disabled={locating}>
                  {locating?<span className="spinner" style={{width:13,height:13}}/>:<Navigation size={13}/>}
                  {locating?'Detecting…':'Use My Current Location'}
                </button>

                {userPos&&<p style={{fontSize:'.74rem',color:'var(--green)',textAlign:'center',marginBottom:'.75rem',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><CheckCircle size={11}/> Location pinned</p>}

                {/* Drop */}
                <div className="fg mb2">
                  <label className="label">Drop (Fixed)</label>
                  <div className="input-wrap"><Navigation size={15} className="ico"/><input className="input" value={IIT.name} readOnly/></div>
                </div>

                {/* Schedule toggle */}
                <div style={{display:'flex',alignItems:'center',gap:'.75rem',padding:'.85rem',background:'rgba(255,255,255,.03)',border:'1px solid var(--b1)',borderRadius:'var(--rs)',marginBottom:'1rem'}}>
                  <Calendar size={15} style={{color:'var(--ts)',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:'.87rem'}}>Schedule for later</div>
                    <div style={{fontSize:'.73rem',color:'var(--ts)'}}>Book now, ride later</div>
                  </div>
                  <label style={{position:'relative',cursor:'pointer'}}>
                    <input type="checkbox" checked={scheduled} onChange={e=>setScheduled(e.target.checked)} style={{opacity:0,width:0,height:0,position:'absolute'}}/>
                    <div style={{width:40,height:22,background:scheduled?'var(--green)':'rgba(255,255,255,.1)',borderRadius:99,transition:'background .2s',position:'relative'}}>
                      <div style={{position:'absolute',top:3,left:scheduled?19:3,width:16,height:16,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.3)'}}/>
                    </div>
                  </label>
                </div>

                {scheduled&&(
                  <div className="fg mb2">
                    <label className="label">When?</label>
                    <input className="input" type="datetime-local" min={minSchedule()} value={schedTime} onChange={e=>setSchedTime(e.target.value)} required={scheduled}/>
                    <p className="hint">Minimum 30 minutes from now</p>
                  </div>
                )}

                {/* Live fare preview */}
                {farePreview&&(
                  <div style={{background:'rgba(245,166,35,.07)',border:'1px solid rgba(245,166,35,.18)',borderRadius:'var(--rs)',padding:'.85rem 1rem',marginBottom:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:'.72rem',color:'var(--ts)',textTransform:'uppercase',letterSpacing:'.07em'}}>Estimated Fare</div>
                      {farePreview.discount>0&&<div style={{fontSize:'.73rem',color:'var(--green)',marginTop:2}}>Includes {profile?.discount_percent}% concession</div>}
                    </div>
                    <div style={{fontFamily:'var(--fd)',fontSize:'1.6rem',fontWeight:900,color:'var(--gold)'}}>
                      ₹{farePreview.final}
                    </div>
                  </div>
                )}

                {drivers.length===0&&<div className="warn-box mb2"><AlertCircle size={14} style={{flexShrink:0}}/> No drivers available right now.</div>}
                {(profile?.discount_percent||0)>0&&<div className="good-box mb2"><Zap size={13} style={{flexShrink:0}}/> {profile.discount_percent}% concession applied!</div>}

                <button type="submit" className="btn btn-primary btn-blk btn-lg">
                  {scheduled?<><Calendar size={15}/> Schedule Ride</>:<><Car size={15}/> Find Driver</>}
                </button>
              </form>
            </div>
          </div>
          <LiveMap userPos={userPos} height={430}/>
        </div>
      </div>
    </div>
  )

  if (step==='searching') return (
    <div className="main" style={{padding:'4rem 2rem',textAlign:'center'}}>
      <div className="spinner" style={{width:52,height:52,margin:'0 auto 1.5rem'}}/>
      <h2 className="h2">Calculating route…</h2>
      <p className="sub mt1">Finding the best path to IIT Hyderabad</p>
    </div>
  )

  if (step==='confirm') return (
    <div className="main" style={{padding:'1.75rem 1.5rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'380px 1fr',gap:'1.75rem',maxWidth:1060,margin:'0 auto'}}>
        <div>
          <button className="btn btn-ghost btn-sm mb2" onClick={()=>setStep('form')}><ArrowLeft size={14}/> Change</button>
          <h2 className="h2 mb3">Confirm Booking</h2>

          {scheduled&&schedTime&&(
            <div className="good-box mb2"><Calendar size={14} style={{flexShrink:0}}/> Scheduled for <strong>{new Date(schedTime).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</strong></div>
          )}

          {/* Fare */}
          <div className="card mb2">
            <h3 className="h4 mb2" style={{color:'var(--ts)'}}>Fare Breakdown</h3>
            {[['Distance',`${routeInfo.distKm} km`],['Rate',`₹${fareRate.rate_per_km}/km`],['Base Fare',`₹${fare.base}`],
              ...(fare.discount>0?[[`Concession (${profile?.discount_percent || 0}%)`,`−₹${fare.discount}`,'var(--green)']]:[])]
              .map(([l,v,c])=>(
                <div key={l} className="fare-r"><span style={{color:'var(--tm)'}}>{l}</span><span style={{color:c||'var(--tp)',fontWeight:600}}>{v}</span></div>
              ))}
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:'.7rem',marginTop:'.2rem',borderTop:'1px solid var(--b2)'}}>
              <span style={{fontFamily:'var(--fd)',fontWeight:700}}>Total</span>
              <span style={{fontFamily:'var(--fd)',fontSize:'1.6rem',fontWeight:900,color:'var(--gold)'}}>₹{fare.final}</span>
            </div>
          </div>

          {/* ETAs */}
          <div className="card mb2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem'}}>
            {[['🚗','Driver ETA',`${routeInfo.driverEta} mins`],['⏱','Trip',`${routeInfo.tripMins} mins`]].map(([em,l,v])=>(
              <div key={l} style={{textAlign:'center',background:'rgba(255,255,255,.03)',borderRadius:'var(--rs)',padding:'.85rem .5rem'}}>
                <div style={{fontSize:'1.3rem',marginBottom:'.3rem'}}>{em}</div>
                <div style={{fontSize:'.7rem',color:'var(--tm)',textTransform:'uppercase',letterSpacing:'.07em'}}>{l}</div>
                <div style={{fontFamily:'var(--fd)',fontSize:'1.35rem',fontWeight:700,color:'var(--gold)',marginTop:3}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Driver */}
          {driver&&(
            <div className="card mb3" style={{display:'flex',alignItems:'center',gap:'.9rem'}}>
              <div style={{width:50,height:50,borderRadius:'50%',background:'linear-gradient(135deg,var(--gold),var(--orange))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--fd)',fontWeight:700,color:'#0a0a0f',flexShrink:0,overflow:'hidden',border:'2px solid rgba(245,166,35,.3)'}}>
                {driver.photo_url?<img src={driver.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:driver.name?.[0]?.toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{driver.name}</div>
                <Stars v={driver.rating}/>
                <div style={{color:'var(--ts)',fontSize:'.8rem'}}>{driver.vehicle_model} · <strong style={{letterSpacing:'.04em'}}>{driver.vehicle_number}</strong></div>
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:'.9rem'}}>
            <button className="btn btn-outline w100" onClick={()=>setStep('form')}>← Back</button>
            <button className="btn btn-primary w100 btn-lg" onClick={handleBook}>
              {scheduled?'⏰ Schedule Ride':'🚀 Confirm'}
            </button>
          </div>
        </div>
        <LiveMap userPos={userPos} height={430}/>
      </div>
    </div>
  )

  if (step==='confirming') return (
    <div className="main" style={{padding:'4rem 2rem',textAlign:'center'}}>
      <div className="spinner" style={{width:52,height:52,margin:'0 auto 1.5rem'}}/>
      <h2 className="h2">Confirming your booking…</h2>
    </div>
  )

  // ── CONFIRMED ─────────────────────────────────────────────────────────────
  return (
    <div className="main" style={{padding:'1.75rem 1.5rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'380px 1fr',gap:'1.75rem',maxWidth:1060,margin:'0 auto'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:'.75rem',marginBottom:'1.75rem'}}>
            <CheckCircle size={24} style={{color:'var(--green)',flexShrink:0}}/>
            <div>
              <h1 className="h1">{scheduled?'Scheduled! ⏰':'Cab Booked! 🎉'}</h1>
              {liveStatus&&<span className="badge b-green" style={{marginTop:4}}>{liveStatus}</span>}
            </div>
          </div>

          {/* Countdown */}
          {countdown!==null&&countdown>0&&(
            <div className="card mb2" style={{textAlign:'center',borderColor:'rgba(0,200,150,.28)',background:'rgba(0,200,150,.05)'}}>
              <div style={{fontSize:'.73rem',color:'var(--tm)',textTransform:'uppercase',letterSpacing:'.08em'}}>Driver Arrives In</div>
              <div style={{fontFamily:'var(--fd)',fontSize:'3.2rem',fontWeight:900,color:'var(--green)',fontVariantNumeric:'tabular-nums'}}>{fmtCD(countdown)}</div>
              <div style={{display:'flex',justifyContent:'center',marginTop:'.5rem'}}><span className="dot"/></div>
            </div>
          )}
          {countdown===0&&<div className="good-box mb2" style={{justifyContent:'center'}}>🚗 Driver has arrived!</div>}

          {scheduled&&schedTime&&(
            <div className="good-box mb2"><Calendar size={13} style={{flexShrink:0}}/> Scheduled for <strong>{new Date(schedTime).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</strong></div>
          )}

          {/* Driver card */}
          {driver&&(
            <div className="card mb2">
              <div style={{display:'flex',alignItems:'center',gap:'.9rem'}}>
                <div style={{width:50,height:50,borderRadius:'50%',background:'linear-gradient(135deg,var(--gold),var(--orange))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--fd)',fontWeight:700,color:'#0a0a0f',flexShrink:0,overflow:'hidden',border:'2px solid rgba(245,166,35,.3)'}}>
                  {driver.photo_url?<img src={driver.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:driver.name?.[0]?.toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700}}>{driver.name}</div>
                  <Stars v={driver.rating}/>
                  <div style={{color:'var(--ts)',fontSize:'.8rem'}}>{driver.vehicle_model} · {driver.vehicle_number}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
                  <a href={`tel:${driver.phone}`} className="btn btn-primary btn-sm"><Phone size={12}/> Call</a>
                  <button className="btn btn-blue btn-sm" onClick={()=>setChatOpen(v=>!v)}><MessageSquare size={12}/> Chat</button>
                </div>
              </div>
            </div>
          )}

          {/* Trip details */}
          <div className="card mb2">
            {[['Pickup',pickup],['Drop',IIT.name,'var(--gold)'],['Distance',`${routeInfo?.distKm} km`],['Duration',`${routeInfo?.tripMins} mins`],['Fare',`₹${fare?.final}`,'var(--gold)']].map(([l,v,c])=>(
              <div key={l} className="fare-r"><span style={{color:'var(--tm)'}}>{l}</span><span style={{fontWeight:700,color:c||'var(--tp)',textAlign:'right',maxWidth:'60%',fontSize:'.87rem'}}>{v}</span></div>
            ))}
          </div>

          {/* Safety panel */}
          <div style={{marginBottom:'.85rem'}}>
            <SafetyPanel booking={bookingData} driver={driver} userPos={userPos} onArriveSafe={async()=>{if(bookingId)await q(()=>supabase.from('bookings').update({arrived_safe:true}).eq('id',bookingId));toast.success('Marked as arrived safe ✓')}}/>
          </div>

          <div style={{display:'flex',gap:'.75rem'}}>
            <button className="btn btn-outline w100" onClick={()=>navigate('/dashboard')}>Dashboard</button>
            <button className="btn btn-danger w100" onClick={()=>setCancelModal(true)}>✕ Cancel</button>
          </div>
        </div>

        <LiveMap userPos={userPos} driverPos={driverPos} height={480} liveLabel="Driver approaching…"/>
      </div>

      {/* Chat widget */}
      {chatOpen&&bookingId&&<ChatWidget bookingId={bookingId} open={chatOpen} onClose={()=>setChatOpen(false)}/>}

      {/* Cancel reason modal */}
      {cancelModal&&(
        <div className="overlay">
          <div className="modal" style={{maxWidth:400}}>
            <h3 style={{fontFamily:'var(--fd)',fontSize:'1.15rem',marginBottom:'1rem'}}>Why are you cancelling?</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1.25rem'}}>
              {CANCEL_REASONS.map(r=>(
                <button key={r} onClick={()=>setCancelR(r)}
                  style={{padding:'.72rem 1rem',borderRadius:'var(--rs)',border:`1px solid ${cancelReason===r?'rgba(245,166,35,.4)':'var(--b1)'}`,background:cancelReason===r?'rgba(245,166,35,.08)':'transparent',color:cancelReason===r?'var(--gold)':'var(--tp)',fontFamily:'var(--fb)',fontSize:'.87rem',textAlign:'left',cursor:'pointer',fontWeight:cancelReason===r?700:400,transition:'all .15s'}}>
                  {cancelReason===r?'✓ ':''}{r}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:'.75rem'}}>
              <button className="btn btn-ghost w100" onClick={()=>{setCancelModal(false);setCancelR('')}}>Keep Ride</button>
              <button className="btn btn-danger w100" onClick={handleCancel} disabled={!cancelReason||cancelling}>
                {cancelling?<span className="spinner"/>:'Cancel Ride'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
