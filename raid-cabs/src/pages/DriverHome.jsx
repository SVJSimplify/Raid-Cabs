import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDriver } from '../contexts/DriverContext'
import { supabase, q } from '../lib/supabase'
import DriverMap from '../components/DriverMap'
import {
  Phone, History, LogOut, CheckCircle, XCircle,
  Clock, Zap, AlertTriangle, Navigation, MapPin, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

function Stars({ v }) {
  return (
    <span style={{ display:'inline-flex', gap:1, alignItems:'center' }}>
      {[1,2,3,4,5].map(i => (
        <span key={`star-${i}`} style={{ fontSize:'.82rem', color: i<=Math.round(v)?'#ffb347':'#504c74' }}>★</span>
      ))}
      <span style={{ marginLeft:4, fontSize:'.78rem', color:'#9890c2' }}>{Number(v).toFixed(1)}</span>
    </span>
  )
}

export default function DriverHome() {
  const { signOut } = useAuth()
  const { driver, currentBooking, updateBookingStatus, setOnlineStatus } = useDriver()
  const navigate = useNavigate()

  // Driver's own GPS position — updates every 8 seconds
  const [driverPos,     setDriverPos]     = useState(null)
  const [gpsError,      setGpsError]      = useState(false)
  const [actionLoading, setActionLoad]    = useState(false)
  const [todayStats,    setTodayStats]    = useState({ trips:0, earnings:0 })
  const [showSos,       setShowSos]       = useState(false)
  const [mapExpanded,   setMapExpanded]   = useState(false)
  const watchRef = useRef(null)

  // ── Live GPS watch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError(true); return }

    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsError(false)
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  // ── Today's stats ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!driver) return
    const today = new Date().toISOString().slice(0, 10)
    q(() => supabase.from('bookings')
      .select('final_fare')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`)
    ).then(({ data }) => setTodayStats({
      trips:    data?.length || 0,
      earnings: data?.reduce((s,b) => s+(b.final_fare||0), 0) || 0,
    }))
  }, [driver, currentBooking])

  const doAction = async (status, label) => {
    setActionLoad(true)
    const { error } = await updateBookingStatus(currentBooking.id, status)
    if (error) toast.error(error.message)
    else toast.success(label)
    setActionLoad(false)
  }

  const toggleOnline = async () => {
    const goOnline = driver.status === 'offline'
    await setOnlineStatus(goOnline)
    toast.success(goOnline ? 'You are now online 🟢' : 'You are offline')
  }

  const isOnline = driver?.status !== 'offline'
  const hasBooking = !!currentBooking
  const customerPos = hasBooking && currentBooking.pickup_lat && currentBooking.pickup_lng
    ? { lat: currentBooking.pickup_lat, lng: currentBooking.pickup_lng }
    : null

  // Distance from driver to customer in km (rough)
  const distToCustomer = driverPos && customerPos
    ? (() => {
        const R = 6371
        const dLat = (customerPos.lat - driverPos.lat) * Math.PI / 180
        const dLon = (customerPos.lng - driverPos.lng) * Math.PI / 180
        const a = Math.sin(dLat/2)**2 + Math.cos(driverPos.lat*Math.PI/180)*Math.cos(customerPos.lat*Math.PI/180)*Math.sin(dLon/2)**2
        return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1)
      })()
    : null

  return (
    <div style={{ minHeight:'100vh', background:'#05050e', fontFamily:"'Nunito',sans-serif", color:'#ede8d8' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap');
        .dh-nav { height:58px; background:rgba(5,5,14,.92); border-bottom:1px solid rgba(46,204,113,.15); display:flex; align-items:center; justify-content:space-between; padding:0 1.25rem; position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); }
        .dh-card { background:#0e0e20; border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:1.25rem; margin-bottom:.9rem; }
        .dh-card-green { border-color:rgba(46,204,113,.25); }
        .dh-card-orange { border-color:rgba(255,179,71,.3); }
        .dh-btn { display:flex; align-items:center; justify-content:center; gap:7px; padding:.82rem 1.5rem; border-radius:10px; font-family:'Nunito',sans-serif; font-weight:700; font-size:.93rem; cursor:pointer; border:none; transition:all .22s; width:100%; }
        .dh-btn-g { background:linear-gradient(135deg,#2ecc71,#27ae60); color:#05050e; box-shadow:0 4px 18px rgba(46,204,113,.28); }
        .dh-btn-g:hover:not(:disabled){ transform:translateY(-2px); }
        .dh-btn-o { background:linear-gradient(135deg,#ffb347,#ff6b35); color:#05050e; box-shadow:0 4px 18px rgba(255,179,71,.28); }
        .dh-btn-o:hover:not(:disabled){ transform:translateY(-2px); }
        .dh-btn-r { background:rgba(231,76,60,.13); color:#e74c3c; border:1px solid rgba(231,76,60,.28); }
        .dh-btn-ghost { background:transparent; border:1px solid rgba(255,255,255,.1); color:#9890c2; }
        .dh-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .dh-row { display:flex; justify-content:space-between; align-items:flex-start; padding:.58rem 0; border-bottom:1px solid rgba(255,255,255,.05); font-size:.87rem; }
        .dh-row:last-child { border-bottom:none; }
        .dh-spinner { width:18px; height:18px; border:2.5px solid rgba(5,5,14,.3); border-top-color:#05050e; border-radius:50%; animation:dsp .7s linear infinite; }
        @keyframes dsp { to { transform:rotate(360deg); } }
        .dh-stat { text-align:center; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:.95rem .75rem; flex:1; }
        .dh-stat-v { font-family:'Playfair Display',serif; font-size:1.45rem; font-weight:700; }
        .dh-stat-l { font-size:.68rem; color:#504c74; text-transform:uppercase; letter-spacing:.06em; margin-top:.2rem; }
        .sos-overlay { position:fixed; inset:0; background:rgba(0,0,0,.8); backdrop-filter:blur(10px); z-index:500; display:flex; align-items:center; justify-content:center; padding:2rem; animation:fadeIn .2s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .sos-box { background:#0e0e20; border:2px solid rgba(231,76,60,.4); border-radius:18px; padding:2rem; max-width:360px; width:100%; text-align:center; }
        .map-toggle { display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding:.5rem 0; user-select:none; }
        .pulse-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#2ecc71; box-shadow:0 0 0 0 rgba(46,204,113,.5); animation:pulse 1.6s infinite; }
        @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(46,204,113,.5);}70%{box-shadow:0 0 0 8px rgba(46,204,113,0);}100%{box-shadow:0 0 0 0 rgba(46,204,113,0);} }
        .dist-chip { display:inline-flex; align-items:center; gap:5px; background:rgba(52,152,219,.12); border:1px solid rgba(52,152,219,.25); border-radius:99px; padding:.3rem .85rem; font-size:.78rem; color:#3498db; font-weight:700; }
      `}</style>

      {/* Navbar */}
      <nav className="dh-nav">
        <div style={{ display:'flex', alignItems:'center', gap:'.7rem' }}>
          <img src="/logo.png" alt="" style={{ width:28, height:28, objectFit:'contain', filter:'drop-shadow(0 0 6px rgba(46,204,113,.4))' }} onError={e=>e.target.style.display='none'}/>
          <div>
            <div style={{ fontWeight:700, fontSize:'.88rem', color:'#2ecc71' }}>{driver?.name}</div>
            <div style={{ fontSize:'.68rem', color:'#504c74' }}>{driver?.vehicle_number}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          {driverPos && <div className="dist-chip"><Navigation size={11}/> GPS Live</div>}
          {gpsError  && <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(231,76,60,.1)', border:'1px solid rgba(231,76,60,.25)', borderRadius:99, padding:'.3rem .75rem', fontSize:'.72rem', color:'#e74c3c' }}>⚠ GPS off</div>}
          <button onClick={()=>navigate('/driver/history')}
            style={{ background:'transparent', border:'1px solid rgba(255,255,255,.1)', color:'#9890c2', borderRadius:8, padding:'.38rem .75rem', cursor:'pointer', fontSize:'.76rem', fontFamily:"'Nunito',sans-serif", display:'flex', alignItems:'center', gap:4 }}>
            <History size={12}/> Trips
          </button>
          <button onClick={async()=>{await signOut();navigate('/driver')}}
            style={{ background:'transparent', border:'none', color:'#504c74', cursor:'pointer', display:'flex', padding:4 }}>
            <LogOut size={15}/>
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'1.25rem 1rem 3rem' }}>

        {/* Online toggle */}
        <div className={`dh-card ${isOnline?'dh-card-green':''}`} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.9rem' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:'.93rem', display:'flex', alignItems:'center', gap:7 }}>
              {isOnline
                ? <><span className="pulse-dot"/> Online</>
                : <><span style={{ width:8, height:8, borderRadius:'50%', background:'#504c74', display:'inline-block' }}/> Offline</>
              }
            </div>
            <div style={{ fontSize:'.76rem', color:'#504c74', marginTop:2 }}>
              {isOnline ? 'Ready to receive rides' : 'You will not receive rides'}
            </div>
          </div>
          <button onClick={toggleOnline}
            style={{ background: isOnline?'rgba(231,76,60,.12)':'rgba(46,204,113,.12)', border:`1px solid ${isOnline?'rgba(231,76,60,.3)':'rgba(46,204,113,.3)'}`, color: isOnline?'#e74c3c':'#2ecc71', borderRadius:99, padding:'.42rem .95rem', cursor:'pointer', fontSize:'.8rem', fontWeight:700, fontFamily:"'Nunito',sans-serif" }}>
            Go {isOnline?'Offline':'Online'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:'.75rem', marginBottom:'.9rem' }}>
          {[
            [`₹${todayStats.earnings.toLocaleString()}`, "Today's Earnings", '#ffb347'],
            [todayStats.trips, 'Trips Today', '#2ecc71'],
          ].map(([v,l,c]) => (
            <div key={l} className="dh-stat">
              <div className="dh-stat-v" style={{ color:c }}>{v}</div>
              <div className="dh-stat-l">{l}</div>
            </div>
          ))}
          <div className="dh-stat">
            <div className="dh-stat-v"><Stars v={driver?.rating||5}/></div>
            <div className="dh-stat-l">Rating</div>
          </div>
        </div>

        {/* No booking state */}
        {!hasBooking && (
          <div className="dh-card" style={{ textAlign:'center', padding:'2.5rem 1.5rem' }}>
            <div style={{ fontSize:'2.8rem', marginBottom:'.85rem' }}>⏳</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.05rem', fontWeight:700, marginBottom:'.5rem' }}>
              {isOnline ? 'Waiting for a ride…' : 'You are offline'}
            </div>
            <p style={{ color:'#504c74', fontSize:'.84rem', lineHeight:1.65 }}>
              {isOnline
                ? 'Admin will assign a ride to you. It will appear here instantly with live map.'
                : 'Go online to start receiving ride assignments.'}
            </p>
            {isOnline && <div style={{ marginTop:'1rem', display:'flex', justifyContent:'center' }}><span className="pulse-dot"/></div>}

            {/* Map showing driver's own position when no booking */}
            {driverPos && (
              <div style={{ marginTop:'1.25rem' }}>
                <DriverMap booking={null} driverPos={driverPos} height={200}/>
              </div>
            )}
          </div>
        )}

        {/* Active booking */}
        {hasBooking && (
          <>
            {/* ── Live Map ── */}
            <div className="dh-card" style={{ padding:'1rem' }}>
              <div className="map-toggle" onClick={()=>setMapExpanded(v=>!v)}>
                <div style={{ fontWeight:700, fontSize:'.88rem', display:'flex', alignItems:'center', gap:7 }}>
                  <span className="pulse-dot" style={{ background: currentBooking.status==='in_progress'?'#ffb347':'#2ecc71' }}/>
                  Live Map
                  {distToCustomer && (
                    <span className="dist-chip"><MapPin size={10}/> {distToCustomer} km away</span>
                  )}
                </div>
                <ChevronDown size={16} style={{ color:'#504c74', transform: mapExpanded?'rotate(180deg)':'none', transition:'transform .2s' }}/>
              </div>

              <div style={{ marginTop: mapExpanded ? '.85rem' : 0, overflow:'hidden', transition:'all .3s', height: mapExpanded ? (driverPos ? 340 : 280) : 220, }}>
                <DriverMap
                  booking={currentBooking}
                  driverPos={driverPos}
                  height={mapExpanded ? (driverPos ? 340 : 280) : 220}
                />
              </div>

              {gpsError && (
                <p style={{ fontSize:'.76rem', color:'#e74c3c', marginTop:'.6rem', textAlign:'center' }}>
                  ⚠ Enable GPS for live tracking — allow location in your browser
                </p>
              )}

              {/* Route legend */}
              <div style={{ display:'flex', gap:'1rem', justifyContent:'center', marginTop:'.7rem', flexWrap:'wrap' }}>
                {[['#2ecc71','🚗 You'],['#3498db','📍 Pickup'],['#ffb347','🎓 IIT']].map(([c,l])=>(
                  <div key={l} style={{ fontSize:'.72rem', color: c, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:20, height:3, background:c, display:'inline-block', borderRadius:2 }}/>
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Booking details ── */}
            <div className={`dh-card ${currentBooking.status==='in_progress'?'dh-card-orange':'dh-card-green'}`}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:'1.1rem' }}>
                <span className="pulse-dot" style={{ background: currentBooking.status==='in_progress'?'#ffb347':'#2ecc71' }}/>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700 }}>
                  {currentBooking.status === 'in_progress' ? '🚗 Trip in Progress' : '📋 New Ride Assigned'}
                </div>
                <span style={{ marginLeft:'auto', background: currentBooking.status==='in_progress'?'rgba(255,179,71,.12)':'rgba(46,204,113,.12)', color: currentBooking.status==='in_progress'?'#ffb347':'#2ecc71', border:`1px solid ${currentBooking.status==='in_progress'?'rgba(255,179,71,.3)':'rgba(46,204,113,.3)'}`, borderRadius:99, padding:'.2rem .6rem', fontSize:'.68rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em' }}>
                  {currentBooking.status.replace('_',' ')}
                </span>
              </div>

              {[
                [<MapPin size={13} color="#2ecc71"/>,     'Pickup',   currentBooking.pickup_address],
                [<Navigation size={13} color="#ffb347"/>, 'Drop',     currentBooking.drop_address],
                [<Clock size={13} color="#9890c2"/>,      'Timings',  `Driver: ${currentBooking.eta_pickup||'—'} · Trip: ${currentBooking.eta_drop||'—'}`],
              ].map(([icon,l,v]) => (
                <div key={l} className="dh-row">
                  <span style={{ color:'#504c74', display:'flex', alignItems:'center', gap:6, fontSize:'.83rem', flexShrink:0 }}>{icon} {l}</span>
                  <span style={{ fontWeight:600, textAlign:'right', maxWidth:'62%', fontSize:'.84rem', lineHeight:1.4 }}>{v}</span>
                </div>
              ))}

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'.7rem', marginTop:'.2rem', borderTop:'1px solid rgba(255,255,255,.07)' }}>
                <span style={{ color:'#504c74', fontSize:'.83rem' }}>Fare</span>
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.45rem', fontWeight:800, color:'#ffb347' }}>₹{currentBooking.final_fare}</span>
              </div>
              {currentBooking.receipt_number && (
                <div style={{ fontSize:'.7rem', color:'#504c74', textAlign:'right', fontFamily:'monospace' }}>{currentBooking.receipt_number}</div>
              )}
            </div>

            {/* ── Action buttons ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'.65rem', marginBottom:'.9rem' }}>
              {currentBooking.status === 'confirmed' && (
                <>
                  <button className="dh-btn dh-btn-o" onClick={()=>doAction('in_progress','🚗 Trip started!')} disabled={actionLoading}>
                    {actionLoading?<div className="dh-spinner"/>:<><Zap size={16}/> Start Trip — Passenger Picked Up</>}
                  </button>
                  <button className="dh-btn dh-btn-r" onClick={()=>doAction('cancelled','Booking cancelled')} disabled={actionLoading}>
                    <XCircle size={14}/> Cancel Booking
                  </button>
                </>
              )}
              {currentBooking.status === 'in_progress' && (
                <>
                  <button className="dh-btn dh-btn-g" onClick={()=>doAction('completed','✅ Trip completed!')} disabled={actionLoading}>
                    {actionLoading?<div className="dh-spinner"/>:<><CheckCircle size={16}/> Complete Trip — Arrived at IIT</>}
                  </button>
                  <button className="dh-btn dh-btn-ghost" onClick={()=>setShowSos(true)}>
                    <AlertTriangle size={14}/> SOS Emergency
                  </button>
                </>
              )}
            </div>

            {/* ── Passenger contact ── */}
            <div className="dh-card" style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(52,152,219,.12)', border:'1px solid rgba(52,152,219,.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1.15rem' }}>👤</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'.87rem' }}>Passenger</div>
                <div style={{ fontSize:'.74rem', color:'#504c74', marginTop:1 }}>Call if you can't find them</div>
              </div>
              <a href={`tel:${currentBooking.user_phone||''}`}
                style={{ background:'rgba(52,152,219,.12)', border:'1px solid rgba(52,152,219,.25)', color:'#3498db', borderRadius:8, padding:'.48rem .95rem', fontWeight:700, fontSize:'.82rem', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>
                <Phone size={13}/> Call
              </a>
            </div>
          </>
        )}
      </div>

      {/* SOS Modal */}
      {showSos && (
        <div className="sos-overlay" onClick={()=>setShowSos(false)}>
          <div className="sos-box" onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>🆘</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.15rem', color:'#ede8d8', marginBottom:'.65rem' }}>SOS Emergency</h3>
            <p style={{ color:'#9890c2', fontSize:'.84rem', lineHeight:1.65, marginBottom:'1.5rem' }}>
              This will immediately alert the admin and log an emergency for this trip.
            </p>
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button style={{ flex:1, padding:'.75rem', background:'rgba(231,76,60,.13)', border:'1px solid rgba(231,76,60,.3)', color:'#e74c3c', borderRadius:10, fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                onClick={()=>{toast.error('🆘 SOS sent! Admin notified.',{duration:6000,icon:'🆘'});setShowSos(false)}}>
                <AlertTriangle size={14}/> Send SOS
              </button>
              <button style={{ flex:1, padding:'.75rem', background:'transparent', border:'1px solid rgba(255,255,255,.1)', color:'#9890c2', borderRadius:10, fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif" }}
                onClick={()=>setShowSos(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
