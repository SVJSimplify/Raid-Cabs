import React, { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { OPS_PATH } from '../config'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, q } from '../lib/supabase'
import LiveMap from '../components/LiveMap'
import { LogOut, RefreshCw, Plus, Pencil, Trash2, Check, X, CheckCircle, XCircle, AlertTriangle, BarChart2, Car, CreditCard, Package, Users, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

function PendingRidesPanel({ drivers, load }) {
  const [rides,      setRides]   = React.useState([])
  const [loading,    setLoading] = React.useState(true)
  const [selRide,    setSelRide] = React.useState(null)
  const [selDrv,     setSelDrv]  = React.useState('')
  const [assigning,  setAsg]     = React.useState(false)
  const [mapRide,    setMapRide] = React.useState(null)
  const [driverPos,  setDrvPos]  = React.useState(null)

  const loadRides = React.useCallback(() => {
    setLoading(true)
    q(() => supabase.from('bookings')
      // Fix: explicit :user_id hint to avoid PGRST201 ambiguity
      .select('*,profiles:user_id(full_name,phone,balance,total_deposited,ride_code,emergency_contact_name,emergency_contact_phone),drivers:driver_id(name,photo_url,vehicle_number,vehicle_model,phone,rating)')
      .in('status', ['pending_admin','confirmed','en_route','in_progress'])
      .order('scheduled_at', { ascending:true })
    ).then(({ data }) => { setRides(data||[]); setLoading(false) })
  }, [])

  useEffect(() => { loadRides() }, [loadRides])

  useEffect(() => {
    const ch = supabase.channel('admin-bookings')
      .on('postgres_changes', { event:'*', schema:'public', table:'bookings' }, () => loadRides())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadRides])

  // Live driver GPS for map modal
  useEffect(() => {
    if (!mapRide?.driver_id) { setDrvPos(null); return }
    let alive = true
    const poll = async () => {
      const { data } = await supabase.from('drivers').select('current_lat,current_lng').eq('id', mapRide.driver_id).maybeSingle()
      if (alive && data?.current_lat) setDrvPos({ lat: parseFloat(data.current_lat), lng: parseFloat(data.current_lng) })
    }
    poll()
    const iv = setInterval(poll, 5000)
    return () => { alive = false; clearInterval(iv) }
  }, [mapRide?.driver_id])

  const availDrvs = (drivers||[]).filter(d => d.status==='available' && d.is_approved)

  const assignDriver = async () => {
    if (!selDrv || !selRide) return
    setAsg(true)
    const driver = (drivers||[]).find(d => d.id === selDrv)
    await q(() => supabase.from('bookings').update({
      driver_id: selDrv, status: 'confirmed',
      assigned_at: new Date().toISOString(),
      eta_pickup: `${Math.ceil(4 + Math.random()*8)} mins`,
    }).eq('id', selRide.id))
    await q(() => supabase.from('drivers').update({ status:'busy' }).eq('id', selDrv))
    toast.success(`Driver ${driver?.name} assigned!`)
    setSelRide(null); setSelDrv(''); setAsg(false)
    setRides(r => r.map(b => b.id===selRide.id ? {...b, status:'confirmed', driver_id:selDrv} : b))
    load()
  }

  const statusCol = { pending_admin:'var(--gold)', confirmed:'var(--green)', en_route:'#3b82f6', in_progress:'#8b5cf6', cancelled:'var(--red)' }

  return (
    <div className="ops-card">
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        📋 Pending & Active Ride Requests
        <span style={{background:'rgba(245,166,35,.12)',color:'var(--gold)',border:'1px solid rgba(245,166,35,.22)',borderRadius:99,padding:'2px 8px',fontSize:'.72rem',fontWeight:700}}>
          {rides.filter(r=>r.status==='pending_admin').length} pending
        </span>
        <button onClick={loadRides} style={{marginLeft:'auto',background:'rgba(255,255,255,.04)',border:'1px solid var(--b1)',color:'var(--ts)',borderRadius:6,padding:'3px 10px',fontSize:'.75rem',cursor:'pointer',fontFamily:"'Nunito',sans-serif",display:'flex',alignItems:'center',gap:4}} disabled={loading}>
          {loading ? '...' : '↻'} Refresh
        </button>
      </div>

      {loading && <div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>Loading…</div>}
      {!loading && rides.length===0 && <div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>No pending bookings</div>}

      {rides.map(b => {
        const user = b.profiles
        const isPending = b.status === 'pending_admin'
        return (
          <div key={b.id} style={{background:'rgba(255,255,255,.02)',border:`1px solid ${isPending?'rgba(245,166,35,.22)':'rgba(255,255,255,.07)'}`,borderRadius:12,padding:'1rem',marginBottom:'.75rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.5rem'}}>
                  <div style={{width:34,height:34,borderRadius:'50%',background:'rgba(245,166,35,.1)',border:'1px solid rgba(245,166,35,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'var(--gold)',fontSize:'.85rem',flexShrink:0}}>
                    {user?.full_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:'.9rem'}}>{user?.full_name||'Unknown'}</div>
                    <div style={{fontSize:'.75rem',color:'#504c74'}}>{user?.phone||'—'}</div>
                  </div>
                  <span style={{marginLeft:'auto',padding:'.2rem .65rem',borderRadius:99,fontSize:'.65rem',fontWeight:800,textTransform:'uppercase',background:`${statusCol[b.status]||'#504c74'}18`,color:statusCol[b.status]||'#504c74',border:`1px solid ${statusCol[b.status]||'#504c74'}33`,whiteSpace:'nowrap'}}>
                    {b.status.replace(/_/g,' ')}
                  </span>
                </div>
                <div style={{fontSize:'.82rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.25rem .5rem',marginBottom:'.5rem'}}>
                  <span style={{color:'#504c74'}}>📍 {b.pickup_address?.split(',')[0]||'—'}</span>
                  <span style={{color:'#504c74'}}>📏 {b.distance_km} km</span>
                  <span style={{color:'#ffb347',fontWeight:700}}>💰 ₹{b.final_fare}{b.discount_amount>0?` (−₹${b.discount_amount})`:''}</span>
                  <span style={{color:'#504c74'}}>🕐 {b.scheduled_at?new Date(b.scheduled_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</span>
                </div>
                <div style={{fontSize:'.75rem',color:'#504c74',display:'flex',flexWrap:'wrap',gap:'.35rem'}}>
                  <span>💳 Balance: ₹{Number(user?.balance||0).toLocaleString()}</span>
                  <span>🆔 Code: <strong style={{color:'#ede8d8'}}>{user?.ride_code||'—'}</strong></span>
                  {user?.emergency_contact_name&&<span>🆘 {user.emergency_contact_name} · {user.emergency_contact_phone}</span>}
                </div>
                {b.admin_notes&&<div style={{marginTop:'.4rem',fontSize:'.78rem',color:'#ffb347'}}>📝 {b.admin_notes}</div>}
                {b.drivers && (
                  <div style={{marginTop:'.6rem',display:'flex',alignItems:'center',gap:'.6rem',background:'rgba(34,197,94,.06)',border:'1px solid rgba(34,197,94,.18)',borderRadius:8,padding:'.5rem .75rem'}}>
                    <div style={{fontSize:'.8rem',fontWeight:700,color:'#22c55e'}}>{b.drivers.name}</div>
                    <div style={{fontSize:'.72rem',color:'#504c74'}}>{b.drivers.vehicle_model} · {b.drivers.vehicle_number}</div>
                    <div style={{fontSize:'.75rem',color:'#ffb347',marginLeft:'auto'}}>⭐ {Number(b.drivers.rating||5).toFixed(1)}</div>
                  </div>
                )}
              </div>
              <div style={{display:'flex',gap:'.5rem',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                {b.pickup_lat && (
                  <button onClick={()=>{setMapRide(b);setDrvPos(null)}}
                    style={{background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.25)',color:'#60a5fa',borderRadius:6,padding:'4px 10px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',fontFamily:"'Nunito',sans-serif"}}>
                    🗺 Map
                  </button>
                )}
                {isPending && (
                  <button className="ops-btn ops-btn-g" onClick={()=>{setSelRide(b);setSelDrv('')}}>Assign Driver</button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Live Map Modal */}
      {mapRide && (
        <div className="overlay" onClick={()=>setMapRide(null)}>
          <div style={{background:'#0e0e20',border:'1px solid rgba(255,255,255,.1)',borderRadius:20,padding:'1.5rem',maxWidth:680,width:'100%',maxHeight:'90vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:'1rem',color:'#ede8d8'}}>
                Live Map — {mapRide.profiles?.full_name||'Passenger'}
              </div>
              <button onClick={()=>setMapRide(null)} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',color:'#9890c2',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:'1.1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <LiveMap
              adminMode
              userPos={mapRide.pickup_lat ? { lat:parseFloat(mapRide.pickup_lat), lng:parseFloat(mapRide.pickup_lng) } : null}
              driverPos={driverPos}
              dropPos={mapRide.drop_lat ? { lat:parseFloat(mapRide.drop_lat), lng:parseFloat(mapRide.drop_lng), label:mapRide.drop_address||'Destination' } : null}
              height={380}
              liveLabel={driverPos ? '🟢 Driver GPS live' : null}
            />
          </div>
        </div>
      )}

      {/* Assign Driver Modal */}
      {selRide && (
        <div className="overlay">
          <div className="modal" style={{maxWidth:440}}>
            <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:'1.15rem',marginBottom:'.5rem'}}>Assign Driver</h3>
            <p style={{color:'#9890c2',fontSize:'.83rem',marginBottom:'1.25rem'}}>
              Booking for <strong style={{color:'#ede8d8'}}>{selRide.profiles?.full_name}</strong><br/>
              {selRide.scheduled_at && new Date(selRide.scheduled_at).toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
            </p>
            {availDrvs.length === 0
              ? <div className="warn-box mb3">No available approved drivers right now.</div>
              : (
                <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1.25rem'}}>
                  {availDrvs.map(d => (
                    <button key={d.id} onClick={()=>setSelDrv(d.id)}
                      style={{display:'flex',alignItems:'center',gap:'.75rem',padding:'.85rem 1rem',borderRadius:10,border:`1px solid ${selDrv===d.id?'rgba(245,166,35,.5)':'rgba(255,255,255,.08)'}`,background:selDrv===d.id?'rgba(245,166,35,.08)':'rgba(255,255,255,.02)',cursor:'pointer',fontFamily:"'Nunito',sans-serif"}}>
                      <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'rgba(255,179,71,.1)',border:'1px solid rgba(255,179,71,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#ffb347'}}>
                        {d.photo_url?<img src={d.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:d.name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{flex:1,textAlign:'left'}}>
                        <div style={{fontWeight:700,color:'#ede8d8',fontSize:'.9rem'}}>{d.name}</div>
                        <div style={{fontSize:'.75rem',color:'#504c74'}}>{d.vehicle_model} · {d.vehicle_number}</div>
                      </div>
                      <div style={{fontSize:'.8rem',color:'#ffb347'}}>⭐ {Number(d.rating||5).toFixed(1)}</div>
                    </button>
                  ))}
                </div>
              )
            }
            <div style={{display:'flex',gap:'.75rem'}}>
              <button className="ops-btn ops-btn-g" onClick={assignDriver} disabled={!selDrv||assigning} style={{flex:1,opacity:!selDrv?0.5:1}}>
                {assigning?'Assigning…':'✓ Confirm Assignment'}
              </button>
              <button onClick={()=>{setSelRide(null);setSelDrv('')}} style={{padding:'.72rem 1rem',background:'transparent',border:'1px solid rgba(255,255,255,.1)',color:'#9890c2',borderRadius:10,cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontWeight:700}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RevenuePanel({ bookings }) {
  const done = bookings.filter(b=>b.status==='completed')
  const total = done.reduce((s,b)=>s+(b.final_fare||0),0)
  const avgFare = done.length ? Math.round(total/done.length) : 0
  const now = new Date()
  const chartData = Array.from({length:7},(_,i)=>{
    const d = new Date(now); d.setDate(d.getDate()-6+i)
    const key = d.toISOString().slice(0,10)
    const label = d.toLocaleDateString('en-IN',{weekday:'short'})
    const dayTrips = done.filter(t=>t.created_at?.slice(0,10)===key)
    return { label, revenue:dayTrips.reduce((s,t)=>s+(t.final_fare||0),0), trips:dayTrips.length }
  })
  const CustomTip = ({active,payload,label}) => {
    if (!active||!payload?.length) return null
    return <div style={{background:'#0e0e20',border:'1px solid rgba(255,165,40,.2)',borderRadius:8,padding:'.6rem .85rem',fontSize:'.8rem'}}>
      <div style={{color:'#504c74'}}>{label}</div>
      <div style={{color:'#ffb347',fontWeight:700}}>₹{payload[0]?.value?.toLocaleString()}</div>
    </div>
  }
  return (
    <div className="ops-card">
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>Revenue Analytics</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginBottom:'1.5rem'}}>
        {[[`₹${total.toLocaleString()}`,'Total Revenue','#ffb347'],[done.length,'Completed Trips','#2ecc71'],[`₹${avgFare}`,'Avg Fare','#3498db']].map(([v,l,c])=>(
          <div key={l} style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:12,padding:'1rem',textAlign:'center'}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.6rem',fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:'.7rem',color:'#504c74',textTransform:'uppercase',letterSpacing:'.07em',marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{top:5,right:5,left:-15,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false}/>
          <Tooltip content={<CustomTip/>}/>
          <Bar dataKey="revenue" fill="#ffb347" radius={[6,6,0,0]} maxBarSize={40}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FareSettingsPanel({ profile }) {
  const [settings, setSettings] = React.useState({ rate_per_km:12, minimum_fare:80, surge_enabled:false, surge_multiplier:1.0 })
  const [saving, setSaving] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  useEffect(()=>{
    q(()=>supabase.from('fare_settings').select('*').limit(1).maybeSingle())
      .then(({data})=>{if(data)setSettings(data);setLoaded(true)})
  },[])
  const save = async () => {
    setSaving(true)
    const { data: existing } = await q(()=>supabase.from('fare_settings').select('id').limit(1).maybeSingle())
    if (existing?.id) await q(()=>supabase.from('fare_settings').update({...settings,updated_at:new Date().toISOString(),updated_by:profile?.id}).eq('id',existing.id))
    else await q(()=>supabase.from('fare_settings').insert({...settings,updated_by:profile?.id}))
    toast.success('Fare settings updated!')
    setSaving(false)
  }
  if (!loaded) return <div className="ops-card"><div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>Loading…</div></div>
  const previewFare = (km) => {
    const base = Math.max(settings.minimum_fare, Math.round(km * settings.rate_per_km))
    return settings.surge_enabled ? Math.round(base * settings.surge_multiplier) : base
  }
  return (
    <div className="ops-card">
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.5rem'}}>Fare Settings</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.5rem'}}>
        {[['Rate per KM (₹)','rate_per_km',1,100],['Minimum Fare (₹)','minimum_fare',10,500]].map(([label,key,min,max])=>(
          <div key={key}>
            <label style={{fontSize:'.74rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#9890c2',display:'block',marginBottom:'.42rem'}}>{label}</label>
            <input type="number" min={min} max={max} value={settings[key]} onChange={e=>setSettings(s=>({...s,[key]:Number(e.target.value)}))}
              style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,165,40,.2)',borderRadius:8,padding:'.78rem 1rem',color:'#ede8d8',fontSize:'1.1rem',fontWeight:700,width:'100%',outline:'none',fontFamily:"'Nunito',sans-serif"}}/>
          </div>
        ))}
      </div>
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontWeight:600,fontSize:'.85rem',color:'#9890c2',marginBottom:'.65rem'}}>Fare Preview</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
          <thead><tr>{['Distance','Base Fare'].map(h=><th key={h} style={{textAlign:'left',padding:'.5rem .75rem',fontSize:'.68rem',textTransform:'uppercase',color:'#504c74',borderBottom:'1px solid rgba(255,165,40,.1)'}}>{h}</th>)}</tr></thead>
          <tbody>
            {[2,5,10,15,20].map(km=>(
              <tr key={km}>
                <td style={{padding:'.5rem .75rem',color:'#9890c2'}}>{km} km</td>
                <td style={{padding:'.5rem .75rem',color:'#ede8d8',fontWeight:600}}>₹{Math.max(settings.minimum_fare,Math.round(km*settings.rate_per_km))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={save} disabled={saving}
        style={{width:'100%',padding:'.82rem',background:'linear-gradient(135deg,#ffb347,#ff6b35)',color:'#05050e',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'.95rem',opacity:saving?0.6:1}}>
        {saving?'Saving…':'✓ Save Fare Settings'}
      </button>
    </div>
  )
}

function SosBadge() {
  const [n, setN] = React.useState(0)
  useEffect(() => {
    q(() => supabase.from('sos_alerts').select('id',{count:'exact'}).eq('resolved',false))
      .then(({count}) => setN(count||0))
  }, [])
  if (!n) return null
  return <span className="ops-badge-n" style={{background:'#e74c3c',color:'#fff'}}>{n}</span>
}

function SosAlertsPanel() {
  const [alerts, setAlerts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  useEffect(() => {
    q(() => supabase.from('sos_alerts')
      .select('*,profiles:user_id(full_name,phone,emergency_contact_name,emergency_contact_phone),drivers:driver_id(name,phone,vehicle_number)')
      .order('created_at',{ascending:false}).limit(30))
      .then(({data}) => { setAlerts(data||[]); setLoading(false) })
  }, [])
  const resolve = async id => {
    await q(() => supabase.from('sos_alerts').update({resolved:true,resolved_at:new Date().toISOString()}).eq('id',id))
    setAlerts(a => a.map(x => x.id===id ? {...x,resolved:true} : x))
    toast.success('SOS resolved')
  }
  return (
    <div className="ops-card">
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem',color:'#e74c3c',display:'flex',alignItems:'center',gap:8}}>
        🆘 SOS Alerts
      </div>
      {loading && <div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>Loading…</div>}
      {!loading && alerts.length===0 && <div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>✅ No SOS alerts</div>}
      {alerts.map(a => (
        <div key={a.id} style={{background:a.resolved?'rgba(255,255,255,.02)':'rgba(231,76,60,.06)',border:`1px solid ${a.resolved?'rgba(255,255,255,.07)':'rgba(231,76,60,.25)'}`,borderRadius:12,padding:'1rem',marginBottom:'.75rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'.5rem'}}>
            <span style={{fontWeight:700,color:a.resolved?'#504c74':'#e74c3c'}}>{a.resolved?'✅ Resolved':'🆘 ACTIVE SOS'}</span>
            {!a.resolved && <button className="ops-btn ops-btn-g" onClick={()=>resolve(a.id)}>✓ Resolve</button>}
          </div>
          <div style={{fontSize:'.83rem',display:'flex',flexDirection:'column',gap:3}}>
            <span>👤 <strong style={{color:'#ede8d8'}}>{a.profiles?.full_name||'Unknown'}</strong> · {a.profiles?.phone||'—'}</span>
            <span>🚗 <strong style={{color:'#ede8d8'}}>{a.drivers?.name||'—'}</strong> · {a.drivers?.phone||'—'}</span>
            {a.location_lat && <a href={`https://maps.google.com/?q=${a.location_lat},${a.location_lng}`} target="_blank" rel="noreferrer" style={{color:'#3498db',fontSize:'.8rem'}}>📍 View on Google Maps →</a>}
          </div>
        </div>
      ))}
    </div>
  )
}

const TABS = [['overview','Overview',BarChart2],['bookings-queue','Pending Rides',Package],['analytics','Revenue',BarChart2],['fares','Fare Settings',CreditCard],['sos','SOS Alerts',AlertTriangle],['pending','Pending Drivers',Car],['discounts','Discounts',CreditCard],['deposits','Deposits',Package],['drivers','Drivers',Car],['bookings','Bookings',Settings],['users','Users',Users]]
const SC = { confirmed:'#2ecc71', en_route:'#3b82f6', in_progress:'#ffb347', completed:'#3498db', cancelled:'#e74c3c', pending_admin:'#f5a623' }

const II = ({ value, onChange, type='text', placeholder='', w=90 }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,165,40,.18)', borderRadius:6, padding:'.35rem .55rem', color:'#ede8d8', fontSize:'.8rem', width:w, fontFamily:"'Nunito',sans-serif", outline:'none' }}/>
)

export default function OpsDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [showAddDriver, setShowAddDriver] = useState(false)
  const [newDriver,    setNewDriver]     = useState({ name:'', phone:'', vehicle_model:'', vehicle_number:'', login_pin:'' })
  const [addingDriver, setAddingDriver]  = useState(false)
  const [tab,    setTab]  = useState('overview')
  const [data,   setData] = useState({ tiers:[], drivers:[], pendingDrivers:[], bookings:[], deposits:[], users:[] })
  const [editTier, setET] = useState(null)
  const [newTier,  setNT] = useState({ min_amount:'', max_amount:'', discount_percent:'', label:'' })
  const [loading,  setLd] = useState(false)

  const load = useCallback(async () => {
    const [t,d,pd,b,dep,u] = await Promise.all([
      q(() => supabase.from('discount_tiers').select('*').order('sort_order')),
      q(() => supabase.from('drivers').select('*').eq('is_approved',true).order('created_at',{ascending:false})),
      q(() => supabase.from('drivers').select('*').eq('is_approved',false).order('created_at',{ascending:false})),
      // Fix: use profiles:user_id to avoid PGRST201 ambiguity
      q(() => supabase.from('bookings').select('id,pickup_address,final_fare,status,created_at,user_id,driver_id,profiles:user_id(full_name),drivers:driver_id(name)').order('created_at',{ascending:false}).limit(100)),
      // Fix: no profiles join on deposits, look up from users array
      q(() => supabase.from('deposits').select('id,amount,discount_applied,payment_ref,status,created_at,user_id').order('created_at',{ascending:false}).limit(60)),
      q(() => supabase.from('profiles').select('*').order('created_at',{ascending:false})),
    ])
    setData({ tiers:t.data||[], drivers:d.data||[], pendingDrivers:pd.data||[], bookings:b.data||[], deposits:dep.data||[], users:u.data||[] })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel('ops-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'bookings'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'deposits'},load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  const { tiers, drivers, pendingDrivers=[], bookings, deposits, users } = data
  const pendingDep = deposits.filter(d=>d.status==='pending').length
  const revenue    = bookings.filter(b=>b.status==='completed').reduce((s,b)=>s+(b.final_fare||0),0)

  const saveTier = async () => {
    setLd(true)
    const d = editTier?.id ? editTier : { ...newTier, sort_order: tiers.length+1 }
    if (!d.min_amount || !d.discount_percent || !d.label) { toast.error('Fill all fields'); setLd(false); return }
    const { error } = editTier?.id
      ? await q(() => supabase.from('discount_tiers').update(d).eq('id',d.id))
      : await q(() => supabase.from('discount_tiers').insert(d))
    if (error) toast.error(error.message)
    else { toast.success(editTier?.id ? 'Updated' : 'Added'); setET(null); setNT({min_amount:'',max_amount:'',discount_percent:'',label:''}) }
    setLd(false); load()
  }

  const approveDeposit = async dep => {
    setLd(true)
    const tier = tiers.filter(t=>dep.amount>=t.min_amount&&(!t.max_amount||dep.amount<=t.max_amount)).sort((a,b)=>b.min_amount-a.min_amount)[0]
    await q(() => supabase.from('deposits').update({ status:'confirmed', approved_by:profile?.id, approved_at:new Date().toISOString() }).eq('id',dep.id))
    if (tier) await q(() => supabase.from('profiles').update({ balance:dep.amount, discount_percent:tier.discount_percent }).eq('id',dep.user_id))
    toast.success(`Approved${tier?` · ${tier.discount_percent}% off applied`:''}`)
    setLd(false); load()
  }

  const rejectDeposit = async id => {
    await q(() => supabase.from('deposits').update({ status:'rejected', rejected_at:new Date().toISOString() }).eq('id',id))
    toast.success('Rejected'); load()
  }

  const updateBooking = async (id, status) => {
    const up = { status, ...(status==='completed'?{completed_at:new Date().toISOString()}:{}), ...(status==='cancelled'?{cancelled_at:new Date().toISOString(),cancellation_reason:'Admin cancelled'}:{}) }
    await q(() => supabase.from('bookings').update(up).eq('id',id))
    if (['completed','cancelled'].includes(status)) {
      const bk = bookings.find(b=>b.id===id)
      if (bk?.driver_id) await q(() => supabase.from('drivers').update({status:'available'}).eq('id',bk.driver_id))
    }
    toast.success(`Booking ${status}`); load()
  }

  const assignDriverToBooking = async (bookingId, driverId) => {
    await q(() => supabase.from('bookings').update({driver_id:driverId,status:'confirmed'}).eq('id',bookingId))
    await q(() => supabase.from('drivers').update({status:'busy'}).eq('id',driverId))
    toast.success('Driver assigned'); load()
  }

  return (
    <div style={{ minHeight:'100vh', background:'#03030a', fontFamily:"'Nunito',sans-serif", color:'#ede8d8', display:'flex', flexDirection:'column' }}>
      <style>{`
        .ops-nav { height:60px; background:rgba(3,3,10,.95); border-bottom:1px solid rgba(255,165,40,.12); display:flex; align-items:center; justify-content:space-between; padding:0 2rem; position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); }
        .ops-tab { display:flex; align-items:center; gap:6px; padding:.55rem 1rem; background:transparent; border:none; border-bottom:2.5px solid transparent; color:#504c74; cursor:pointer; font-family:'Nunito',sans-serif; font-weight:700; font-size:.83rem; transition:all .22s; white-space:nowrap; }
        .ops-tab.on { color:#ffb347; border-bottom-color:#ffb347; background:rgba(255,179,71,.05); }
        .ops-tab:hover:not(.on) { color:#ede8d8; }
        .ops-tabs { display:flex; border-bottom:1px solid rgba(255,165,40,.12); overflow-x:auto; scrollbar-width:none; }
        .ops-tabs::-webkit-scrollbar { display:none; }
        .ops-card { background:#0e0e20; border:1px solid rgba(255,165,40,.12); border-radius:14px; padding:1.5rem; }
        .ops-tbl { width:100%; border-collapse:collapse; }
        .ops-tbl th { text-align:left; padding:.6rem .9rem; font-size:.69rem; text-transform:uppercase; letter-spacing:.09em; color:#504c74; border-bottom:1px solid rgba(255,165,40,.1); font-weight:700; white-space:nowrap; }
        .ops-tbl td { padding:.82rem .9rem; font-size:.84rem; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
        .ops-tbl tbody tr:last-child td { border-bottom:none; }
        .ops-badge { display:inline-flex; align-items:center; gap:4px; padding:.22rem .6rem; border-radius:99px; font-size:.67rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
        .ops-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:.4rem .82rem; border-radius:8px; font-family:'Nunito',sans-serif; font-weight:700; font-size:.78rem; cursor:pointer; border:none; transition:all .2s; white-space:nowrap; }
        .ops-btn-p { background:linear-gradient(135deg,#ffb347,#ff6b35); color:#03030a; }
        .ops-btn-g { background:rgba(46,204,113,.12); color:#2ecc71; border:1px solid rgba(46,204,113,.25); }
        .ops-btn-r { background:rgba(231,76,60,.12); color:#e74c3c; border:1px solid rgba(231,76,60,.25); }
        .ops-btn-o { background:transparent; color:#ffb347; border:1px solid rgba(255,179,71,.28); }
        .ops-btn-ghost { background:transparent; color:#9890c2; border:1px solid transparent; }
        .ops-btn-ghost:hover { background:rgba(255,255,255,.04); }
        .ops-input-s { background:rgba(255,255,255,.04); border:1px solid rgba(255,165,40,.15); border-radius:6px; padding:.32rem .5rem; color:#ede8d8; font-size:.78rem; font-family:'Nunito',sans-serif; outline:none; }
        .ops-stat { background:#0e0e20; border:1px solid rgba(255,165,40,.12); border-radius:12px; padding:1.15rem; text-align:center; }
        .ops-stat-v { font-family:'Playfair Display',serif; font-size:1.8rem; font-weight:700; }
        .ops-stat-l { font-size:.69rem; color:#504c74; text-transform:uppercase; letter-spacing:.07em; margin-top:.22rem; }
        .ops-badge-n { background:rgba(231,76,60,.15); color:#e74c3c; border:1px solid rgba(231,76,60,.28); display:inline-flex; align-items:center; padding:1px 5px; border-radius:99px; font-size:.58rem; font-weight:800; margin-left:3px; }
        @media(max-width:768px){.ops-stat-grid{grid-template-columns:1fr 1fr!important;}}
      `}</style>

      {/* Nav */}
      <div className="ops-nav">
        <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
          <img src="/logo.png" alt="" style={{width:28,height:28,objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:'1rem',background:'linear-gradient(135deg,#ffb347,#ff6b35)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>Raid Cabs</div>
            <div style={{fontSize:'.64rem',color:'#504c74',textTransform:'uppercase'}}>Ops Centre</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
          <span style={{color:'#504c74',fontSize:'.82rem'}}>{profile?.full_name||'Admin'}</span>
          <button className="ops-btn ops-btn-ghost" onClick={load}><RefreshCw size={13}/></button>
          <button className="ops-btn ops-btn-ghost" onClick={()=>setShowAddDriver(true)}><Plus size={13}/> Driver</button>
          <button className="ops-btn ops-btn-r" onClick={()=>navigate('/emergency-driver')}><AlertTriangle size={13}/></button>
          <button className="ops-btn ops-btn-ghost" onClick={async()=>{await signOut();navigate('/ops')}}><LogOut size={13}/> Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ops-tabs">
        {TABS.map(([id,label,Icon]) => (
          <button key={id} className={`ops-tab ${tab===id?'on':''}`} onClick={()=>setTab(id)}>
            <Icon size={13}/> {label}
            {id==='deposits'&&pendingDep>0&&<span className="ops-badge-n">{pendingDep}</span>}
            {id==='sos'&&<SosBadge/>}
            {id==='pending'&&pendingDrivers.length>0&&<span className="ops-badge-n">{pendingDrivers.length}</span>}
          </button>
        ))}
      </div>

      <div style={{flex:1,padding:'1.75rem 2rem',overflowX:'auto'}}>

        {tab==='overview' && (
          <>
            <div className="ops-stat-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem',marginBottom:'1.75rem'}}>
              {[
                [drivers.filter(d=>d.status==='available').length,'Available Drivers','#2ecc71'],
                [bookings.filter(b=>['confirmed','en_route','in_progress'].includes(b.status)).length,'Active Rides','#3498db'],
                [pendingDep,'Pending Deposits','#e74c3c'],
                [`₹${revenue.toLocaleString()}`,'Total Revenue','#ffb347'],
                [drivers.length,'Total Drivers','#ffb347'],
                [bookings.length,'All Bookings','#9890c2'],
                [bookings.filter(b=>b.status==='completed').length,'Completed','#2ecc71'],
                [users.length,'Total Users','#9b59b6'],
              ].map(([v,l,c]) => (
                <div key={l} className="ops-stat">
                  <div className="ops-stat-v" style={{color:c}}>{v}</div>
                  <div className="ops-stat-l">{l}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
              <div className="ops-card">
                <div style={{fontWeight:700,fontSize:'.9rem',marginBottom:'1rem',color:'#9890c2'}}>Recent Bookings</div>
                {bookings.slice(0,8).map(b => {
                  const userName = b.profiles?.full_name || users.find(u=>u.id===b.user_id)?.full_name || '—'
                  return (
                    <div key={b.id} style={{display:'flex',justifyContent:'space-between',padding:'.5rem 0',borderBottom:'1px solid rgba(255,255,255,.04)',fontSize:'.8rem'}}>
                      <span style={{fontWeight:600}}>{userName}</span>
                      <div style={{display:'flex',gap:'.4rem',alignItems:'center'}}>
                        <span style={{color:'#ffb347',fontWeight:700}}>₹{b.final_fare}</span>
                        <span className="ops-badge" style={{background:`${SC[b.status]||'#504c74'}18`,color:SC[b.status]||'#504c74',border:`1px solid ${SC[b.status]||'#504c74'}33`}}>{b.status.replace(/_/g,' ')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="ops-card">
                <div style={{fontWeight:700,fontSize:'.9rem',marginBottom:'1.1rem',color:'#9890c2'}}>Fleet Status</div>
                {[['available','#2ecc71'],['busy','#ffb347'],['offline','#504c74']].map(([s,c]) => {
                  const n = drivers.filter(d=>d.status===s).length
                  const pct = drivers.length ? Math.round(n/drivers.length*100) : 0
                  return (
                    <div key={s} style={{marginBottom:'.85rem'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'.8rem',marginBottom:'.25rem'}}>
                        <span style={{color:'#9890c2',textTransform:'capitalize'}}>{s}</span>
                        <span style={{color:c,fontWeight:700}}>{n}</span>
                      </div>
                      <div style={{height:6,background:'rgba(255,255,255,.06)',borderRadius:99,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:c,borderRadius:99,transition:'width .5s'}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {tab==='pending' && (
          <div className="ops-card">
            <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>
              Pending Driver Applications
              {pendingDrivers.length>0&&<span className="ops-badge-n" style={{padding:'2px 8px',fontSize:'.72rem',marginLeft:8}}>{pendingDrivers.length} waiting</span>}
            </div>
            {pendingDrivers.length===0 ? (
              <div style={{textAlign:'center',padding:'3rem',color:'#504c74'}}><div style={{fontSize:'2.5rem',marginBottom:'1rem'}}>✅</div><p>No pending applications</p></div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table className="ops-tbl" style={{minWidth:600}}>
                  <thead><tr><th>Name</th><th>Phone</th><th>Vehicle No.</th><th>Model</th><th>Applied</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pendingDrivers.map(d => (
                      <tr key={d.id}>
                        <td style={{fontWeight:700}}>{d.name}</td>
                        <td style={{color:'#9890c2',fontSize:'.83rem'}}>{d.phone}</td>
                        <td style={{fontFamily:'monospace',color:'#ffb347',fontWeight:700}}>{d.vehicle_number}</td>
                        <td style={{color:'#9890c2',fontSize:'.83rem'}}>{d.vehicle_model}</td>
                        <td style={{color:'#504c74',fontSize:'.76rem'}}>{new Date(d.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</td>
                        <td>
                          <div style={{display:'flex',gap:4}}>
                            <button className="ops-btn ops-btn-g" onClick={async()=>{
                              const pin=prompt('Set 4-digit PIN for '+d.name+':')
                              if(!pin||pin.replace(/\D/g,'').length<4){alert('PIN must be 4+ digits');return}
                              await q(()=>supabase.from('drivers').update({is_approved:true,login_pin:pin.replace(/\D/g,'')}).eq('id',d.id))
                              toast.success(d.name+' approved — PIN: '+pin.replace(/[^0-9]/g,''));load()
                            }}><CheckCircle size={11}/> Approve</button>
                            <button className="ops-btn ops-btn-r" onClick={async()=>{
                              await q(()=>supabase.from('drivers').delete().eq('id',d.id))
                              toast.success('Rejected');load()
                            }}><XCircle size={11}/> Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab==='sos'          && <SosAlertsPanel/>}
        {tab==='bookings-queue'&&<PendingRidesPanel drivers={drivers} load={load}/>}
        {tab==='analytics'    && <RevenuePanel bookings={bookings}/>}
        {tab==='fares'        && <FareSettingsPanel profile={profile}/>}

        {tab==='discounts' && (
          <div className="ops-card">
            <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>Discount Tiers</div>
            <div style={{overflowX:'auto'}}>
              <table className="ops-tbl" style={{minWidth:520}}>
                <thead><tr><th>Min (₹)</th><th>Max (₹)</th><th>Discount</th><th>Label</th><th>Actions</th></tr></thead>
                <tbody>
                  {tiers.map(t => (
                    <tr key={t.id}>
                      {editTier?.id===t.id ? (
                        <>
                          <td><II value={editTier.min_amount} type="number" onChange={e=>setET(p=>({...p,min_amount:e.target.value}))}/></td>
                          <td><II value={editTier.max_amount||''} type="number" placeholder="∞" onChange={e=>setET(p=>({...p,max_amount:e.target.value}))}/></td>
                          <td><II value={editTier.discount_percent} type="number" onChange={e=>setET(p=>({...p,discount_percent:e.target.value}))}/></td>
                          <td><II value={editTier.label} w={160} placeholder="Label" onChange={e=>setET(p=>({...p,label:e.target.value}))}/></td>
                          <td style={{display:'flex',gap:4,paddingTop:'1rem'}}>
                            <button className="ops-btn ops-btn-p" onClick={saveTier} disabled={loading}><Check size={11}/></button>
                            <button className="ops-btn ops-btn-ghost" onClick={()=>setET(null)}><X size={11}/></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{color:'#ffb347',fontWeight:700}}>₹{Number(t.min_amount).toLocaleString()}</td>
                          <td style={{color:'#9890c2'}}>{t.max_amount?`₹${Number(t.max_amount).toLocaleString()}`:'∞'}</td>
                          <td><span className="ops-badge" style={{background:'rgba(255,179,71,.13)',color:'#ffb347',border:'1px solid rgba(255,179,71,.26)'}}>{t.discount_percent}%</span></td>
                          <td style={{color:'#9890c2'}}>{t.label}</td>
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              <button className="ops-btn ops-btn-ghost" onClick={()=>setET({...t})}><Pencil size={11}/></button>
                              <button className="ops-btn ops-btn-r" onClick={async()=>{await q(()=>supabase.from('discount_tiers').delete().eq('id',t.id));load();toast.success('Deleted')}}><Trash2 size={11}/></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr style={{background:'rgba(255,179,71,.02)'}}>
                    <td><II value={newTier.min_amount} type="number" placeholder="5000" onChange={e=>setNT(p=>({...p,min_amount:e.target.value}))}/></td>
                    <td><II value={newTier.max_amount} type="number" placeholder="9999" onChange={e=>setNT(p=>({...p,max_amount:e.target.value}))}/></td>
                    <td><II value={newTier.discount_percent} type="number" placeholder="10" onChange={e=>setNT(p=>({...p,discount_percent:e.target.value}))}/></td>
                    <td><II value={newTier.label} w={160} placeholder="Silver — 10% off" onChange={e=>setNT(p=>({...p,label:e.target.value}))}/></td>
                    <td><button className="ops-btn ops-btn-p" onClick={saveTier} disabled={loading}><Plus size={11}/> Add</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='deposits' && (
          <div className="ops-card">
            <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>Deposit Requests</div>
            <div style={{overflowX:'auto'}}>
              <table className="ops-tbl" style={{minWidth:700}}>
                <thead><tr><th>User</th><th>Phone</th><th>Amount</th><th>Tier</th><th>Ref</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {deposits.map(d => {
                    const u = users.find(u=>u.id===d.user_id)
                    return (
                      <tr key={d.id}>
                        <td style={{fontWeight:600}}>{u?.full_name||'—'}</td>
                        <td style={{color:'#9890c2',fontSize:'.8rem'}}>{u?.phone||'—'}</td>
                        <td style={{color:'#ffb347',fontWeight:700}}>₹{Number(d.amount).toLocaleString()}</td>
                        <td><span className="ops-badge" style={{background:'rgba(255,179,71,.12)',color:'#ffb347',border:'1px solid rgba(255,179,71,.25)'}}>{d.discount_applied||0}%</span></td>
                        <td style={{color:'#504c74',fontSize:'.76rem',fontFamily:'monospace'}}>{d.payment_ref||'—'}</td>
                        <td><span className="ops-badge" style={{background:`rgba(${d.status==='confirmed'?'46,204,113':d.status==='rejected'?'231,76,60':'255,179,71'},.12)`,color:d.status==='confirmed'?'#2ecc71':d.status==='rejected'?'#e74c3c':'#ffb347',border:`1px solid rgba(${d.status==='confirmed'?'46,204,113':d.status==='rejected'?'231,76,60':'255,179,71'},.25)`}}>{d.status}</span></td>
                        <td style={{color:'#504c74',fontSize:'.76rem'}}>{new Date(d.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                        <td>
                          {d.status==='pending'&&(
                            <div style={{display:'flex',gap:4}}>
                              <button className="ops-btn ops-btn-g" onClick={()=>approveDeposit(d)} disabled={loading}><CheckCircle size={11}/> Approve</button>
                              <button className="ops-btn ops-btn-r" onClick={()=>rejectDeposit(d.id)}><XCircle size={11}/></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {deposits.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#504c74',padding:'2rem'}}>No deposits yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='drivers' && (
          <div className="ops-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
              <div style={{fontWeight:700,fontSize:'1rem'}}>Drivers</div>
              <div style={{display:'flex',gap:'.5rem'}}>
                <button className="ops-btn ops-btn-o" onClick={()=>setShowAddDriver(true)}><Plus size={12}/> Add Driver</button>
                <button className="ops-btn ops-btn-r" onClick={()=>navigate('/emergency-driver')}><AlertTriangle size={12}/> Emergency</button>
              </div>
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="ops-tbl" style={{minWidth:640}}>
                <thead><tr><th>Name</th><th>Phone</th><th>Rating</th><th>Vehicle</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {drivers.map(d => (
                    <tr key={d.id}>
                      <td style={{fontWeight:700}}>
                        <div style={{display:'flex',alignItems:'center',gap:'.6rem'}}>
                          <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,179,71,.1)',border:'1px solid rgba(255,179,71,.2)',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#ffb347',fontSize:'.8rem'}}>
                            {d.photo_url?<img src={d.photo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:d.name?.[0]?.toUpperCase()}
                          </div>
                          <span>{d.name}</span>
                        </div>
                      </td>
                      <td style={{color:'#9890c2',fontSize:'.83rem'}}>{d.phone}</td>
                      <td><span style={{color:'#ffb347',fontWeight:700}}>★ {Number(d.rating||5).toFixed(1)}</span> <span style={{color:'#504c74',fontSize:'.73rem'}}>({d.total_ratings||0})</span></td>
                      <td style={{fontSize:'.83rem',color:'#9890c2'}}>{d.vehicle_model}{d.vehicle_number&&<><br/><span style={{fontFamily:'monospace',fontSize:'.76rem',color:'#504c74'}}>{d.vehicle_number}</span></>}</td>
                      <td><span className="ops-badge" style={{background:`rgba(${d.status==='available'?'46,204,113':d.status==='busy'?'255,179,71':'80,76,116'},.12)`,color:d.status==='available'?'#2ecc71':d.status==='busy'?'#ffb347':'#504c74',border:`1px solid rgba(${d.status==='available'?'46,204,113':d.status==='busy'?'255,179,71':'80,76,116'},.25)`}}>{d.status}</span></td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          <select className="ops-input-s" value={d.status} onChange={e=>q(()=>supabase.from('drivers').update({status:e.target.value}).eq('id',d.id)).then(load)}>
                            <option value="available">Available</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                          </select>
                          <button className="ops-btn ops-btn-r" onClick={async()=>{await q(()=>supabase.from('drivers').delete().eq('id',d.id));load();toast.success('Removed')}}><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {drivers.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'#504c74',padding:'2rem'}}>No drivers yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='bookings' && (
          <div className="ops-card">
            <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>All Bookings</div>
            <div style={{overflowX:'auto'}}>
              <table className="ops-tbl" style={{minWidth:780}}>
                <thead><tr><th>User</th><th>Pickup</th><th>Fare</th><th>Driver</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {bookings.map(b => {
                    const userName = b.profiles?.full_name || users.find(u=>u.id===b.user_id)?.full_name || '—'
                    return (
                      <tr key={b.id}>
                        <td style={{fontWeight:600}}>{userName}</td>
                        <td style={{color:'#9890c2',fontSize:'.8rem',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.pickup_address}</td>
                        <td style={{color:'#ffb347',fontWeight:700}}>₹{b.final_fare}</td>
                        <td style={{color:'#9890c2',fontSize:'.83rem'}}>{b.drivers?.name||<span style={{color:'#e74c3c'}}>None</span>}</td>
                        <td><span className="ops-badge" style={{background:`${SC[b.status]||'#504c74'}18`,color:SC[b.status]||'#504c74',border:`1px solid ${SC[b.status]||'#504c74'}33`}}>{b.status.replace(/_/g,' ')}</span></td>
                        <td>
                          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                            {b.status==='confirmed'&&<>
                              <button className="ops-btn ops-btn-g" onClick={()=>updateBooking(b.id,'completed')}><CheckCircle size={11}/></button>
                              <button className="ops-btn ops-btn-r" onClick={()=>updateBooking(b.id,'cancelled')}><XCircle size={11}/></button>
                            </>}
                            {b.status==='pending_admin'&&(
                              <select className="ops-input-s" defaultValue="" onChange={e=>e.target.value&&assignDriverToBooking(b.id,e.target.value)}>
                                <option value="">Assign…</option>
                                {drivers.filter(d=>d.status==='available').map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {bookings.length===0&&<tr><td colSpan={6} style={{textAlign:'center',color:'#504c74',padding:'2rem'}}>No bookings yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==='users' && (
          <div className="ops-card">
            <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>All Users</div>
            <div style={{overflowX:'auto'}}>
              <table className="ops-tbl" style={{minWidth:580}}>
                <thead><tr><th>Name</th><th>Phone</th><th>Balance</th><th>Discount</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{fontWeight:600}}>{u.full_name||'—'}</td>
                      <td style={{color:'#9890c2',fontSize:'.83rem'}}>{u.phone||'—'}</td>
                      <td style={{color:'#ffb347',fontWeight:700}}>₹{Number(u.balance||0).toLocaleString()}</td>
                      <td><span className="ops-badge" style={{background:'rgba(255,179,71,.12)',color:'#ffb347',border:'1px solid rgba(255,179,71,.25)'}}>{u.discount_percent||0}%</span></td>
                      <td><span className="ops-badge" style={{background:`rgba(${u.role==='admin'?'231,76,60':'52,152,219'},.12)`,color:u.role==='admin'?'#e74c3c':'#3498db',border:`1px solid rgba(${u.role==='admin'?'231,76,60':'52,152,219'},.25)`}}>{u.role}</span></td>
                      <td style={{color:'#504c74',fontSize:'.76rem'}}>{new Date(u.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</td>
                      <td>
                        <select className="ops-input-s" value={u.role||'user'} onChange={e=>q(()=>supabase.from('profiles').update({role:e.target.value}).eq('id',u.id)).then(()=>{load();toast.success('Role updated')})}>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Driver Modal */}
      {showAddDriver && (
        <div className="overlay" onClick={()=>setShowAddDriver(false)}>
          <div style={{background:'#0e0e20',border:'1px solid rgba(255,255,255,.1)',borderRadius:20,padding:'1.75rem',maxWidth:480,width:'100%',maxHeight:'90vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
              <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:'1.1rem'}}>Add New Driver</div>
              <button onClick={()=>setShowAddDriver(false)} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',color:'#9890c2',borderRadius:8,width:32,height:32,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              {[
                ['Full Name','name','text','e.g. Ravi Kumar', v=>v.replace(/[^a-zA-Z\s]/g,''), null],
                ['Phone','phone','tel','10-digit number', v=>v.replace(/[^0-9]/g,''), 10],
                ['Vehicle Model','vehicle_model','text','e.g. Maruti Swift Dzire', v=>v, null],
                ['Vehicle Number','vehicle_number','text','TS 09 AB 1234', v=>v.toUpperCase().replace(/[^A-Z0-9\s]/g,''), 13],
                ['Login PIN','login_pin','password','4 digits only', v=>v.replace(/[^0-9]/g,''), 4],
              ].map(([label,field,type,ph,sanitize,maxLen])=>(
                <div key={field}>
                  <label style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:'#8b87b0',display:'block',marginBottom:'.3rem'}}>{label}</label>
                  <input
                    type={type}
                    placeholder={ph}
                    value={newDriver[field]}
                    onChange={e => setNewDriver(p => ({...p, [field]: sanitize(maxLen ? e.target.value.slice(0, maxLen) : e.target.value)}))}
                    maxLength={maxLen||undefined}
                    inputMode={field==='phone'||field==='login_pin'?'numeric':undefined}
                    style={{width:'100%',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,padding:'.72rem 1rem',color:'#f0eefc',fontFamily:"'Nunito',sans-serif",fontSize:'.9rem',outline:'none'}}
                  />
                  {field==='phone'&&newDriver.phone.length>0&&newDriver.phone.length!==10&&<p style={{fontSize:'.7rem',color:'#e74c3c',marginTop:'.2rem'}}>Must be 10 digits</p>}
                  {field==='login_pin'&&newDriver.login_pin.length>0&&newDriver.login_pin.length!==4&&<p style={{fontSize:'.7rem',color:'#e74c3c',marginTop:'.2rem'}}>Must be exactly 4 digits</p>}
                  {field==='vehicle_number'&&newDriver.vehicle_number.length>0&&<p style={{fontSize:'.7rem',color:'#8b87b0',marginTop:'.2rem'}}>Format: TS 09 AB 1234</p>}
                </div>
              ))}
              <div style={{background:'rgba(245,166,35,.07)',border:'1px solid rgba(245,166,35,.15)',borderRadius:10,padding:'.75rem 1rem',fontSize:'.8rem',color:'#ffb347'}}>
                ℹ️ Driver will be created immediately. They log in at /driver with their phone and PIN.
              </div>
              <button onClick={async()=>{
                const{name,phone,vehicle_model,vehicle_number,login_pin}=newDriver
                if(!name||!phone||!vehicle_model||!vehicle_number||!login_pin){toast.error('Fill all fields');return}
                if(login_pin.length!==4){toast.error('PIN must be 4 digits');return}
                setAddingDriver(true)
                const{error}=await q(()=>supabase.from('drivers').insert({name:name.trim(),phone:phone.replace(/[^0-9]/g,'').slice(-10),vehicle_model:vehicle_model.trim(),vehicle_number:vehicle_number.toUpperCase().trim(),login_pin,is_approved:true,status:'offline',rating:5.0,total_ratings:0}))
                setAddingDriver(false)
                if(error){
                  if(error.code==='23505'||error.message?.includes('duplicate')||error.message?.includes('unique')){
                    toast.error('A driver with this phone number already exists')
                  } else {
                    toast.error(error.message)
                  }
                  return
                }
                setShowAddDriver(false);setNewDriver({name:'',phone:'',vehicle_model:'',vehicle_number:'',login_pin:''});load();toast.success('Driver added! ✅')
              }} disabled={addingDriver} style={{background:'linear-gradient(135deg,#f5a623,#ff6b2b)',color:'#0a0a0f',border:'none',borderRadius:12,padding:'.85rem',fontWeight:700,fontSize:'.95rem',cursor:'pointer',fontFamily:"'Nunito',sans-serif",opacity:addingDriver?0.5:1}}>
                {addingDriver?'Creating…':'✅ Create Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
