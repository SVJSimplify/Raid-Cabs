import React, { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { OPS_PATH } from '../config'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, q } from '../lib/supabase'
import LiveMap from '../components/LiveMap'
import { LogOut, RefreshCw, Plus, Pencil, Trash2, Check, X, CheckCircle, XCircle, AlertTriangle, BarChart2, Car, CreditCard, Package, Users, Settings, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'



function ApproveDriverBtn({ driver: d, onDone }) {
  const [showModal, setShowModal] = React.useState(false)
  const [pin, setPin]             = React.useState('')
  const [saving, setSaving]       = React.useState(false)

  const handleApprove = async () => {
    const cleanPin = pin.replace(/[^0-9]/g, '')
    if (cleanPin.length < 4) { toast.error('PIN must be at least 4 digits'); return }
    setSaving(true)
    const { error } = await q(() =>
      supabase.from('drivers')
        .update({ is_approved: true, login_pin: cleanPin })
        .eq('id', d.id)
    )
    if (error) {
      toast.error('Failed: ' + error.message)
    } else {
      toast.success(d.name + ' approved! PIN: ' + cleanPin)
      setShowModal(false)
      setPin('')
      onDone()
    }
    setSaving(false)
  }

  return (
    <>
      <button className="ops-btn ops-btn-g" onClick={() => setShowModal(true)}>
        <CheckCircle size={11}/> Approve
      </button>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', backdropFilter:'blur(8px)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
          <div style={{ background:'#0e0e20', border:'1px solid rgba(255,179,71,.2)', borderRadius:16, padding:'2rem', maxWidth:380, width:'100%', boxShadow:'0 24px 70px rgba(0,0,0,.7)' }}>
            <h3 style={{ fontFamily:"'Playfair Display',serif", color:'#ede8d8', fontSize:'1.2rem', marginBottom:'.5rem' }}>
              Approve {d.name}
            </h3>
            <p style={{ color:'#9890c2', fontSize:'.83rem', marginBottom:'1.25rem', lineHeight:1.6 }}>
              Set a PIN the driver will use to log in. Tell them this number.
            </p>
            <label style={{ fontSize:'.74rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'#9890c2', display:'block', marginBottom:'.4rem' }}>
              Driver PIN (4–6 digits)
            </label>
            <input
              type="number"
              placeholder="e.g. 1234"
              value={pin}
              onChange={e => setPin(e.target.value.slice(0, 6))}
              autoFocus
              style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,179,71,.2)', borderRadius:8, padding:'.8rem 1rem', color:'#ede8d8', fontSize:'1.4rem', letterSpacing:'.2em', width:'100%', outline:'none', fontFamily:"'Nunito',sans-serif", marginBottom:'1.25rem' }}
              onKeyDown={e => e.key === 'Enter' && handleApprove()}
            />
            <div style={{ background:'rgba(255,179,71,.07)', border:'1px solid rgba(255,179,71,.18)', borderRadius:8, padding:'.75rem 1rem', fontSize:'.79rem', color:'#ffb347', marginBottom:'1.25rem' }}>
              ⚠ Write this down — tell <strong>{d.name}</strong> their PIN: <strong style={{ fontSize:'1.1rem' }}>{pin || '????'}</strong>
            </div>
            <div style={{ display:'flex', gap:'.75rem' }}>
              <button
                onClick={handleApprove}
                disabled={saving || pin.replace(/[^0-9]/g,'').length < 4}
                style={{ flex:1, padding:'.78rem', background:'linear-gradient(135deg,#2ecc71,#27ae60)', color:'#05050e', border:'none', borderRadius:10, fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif", fontSize:'.9rem', opacity: saving || pin.replace(/[^0-9]/g,'').length < 4 ? .5 : 1 }}>
                {saving ? '...' : 'Approve & Save PIN'}
              </button>
              <button
                onClick={() => { setShowModal(false); setPin('') }}
                style={{ padding:'.78rem 1.2rem', background:'transparent', border:'1px solid rgba(255,255,255,.1)', color:'#9890c2', borderRadius:10, fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}



function PendingRidesPanel({ drivers, load }) {
  const [rides,      setRides]   = React.useState([])
  const [loading,    setLoading] = React.useState(true)
  const [selRide,    setSelRide] = React.useState(null)
  const [selDrv,     setSelDrv]  = React.useState('')
  const [assigning,  setAsg]     = React.useState(false)
  const [mapRide,    setMapRide] = React.useState(null)   // booking shown in map modal
  const [driverPos,  setDrvPos]  = React.useState(null)

  const loadRides = React.useCallback(() => {
    setLoading(true)
    q(() => supabase.from('bookings')
      .select('*,profiles:user_id(full_name,phone,balance,total_deposited,ride_code,emergency_contact_name,emergency_contact_phone)')
      .in('status', ['pending_admin','confirmed','in_progress'])
      .order('scheduled_at', { ascending:true })
    ).then(({ data }) => { setRides(data||[]); setLoading(false) })
  }, [])

  useEffect(() => { loadRides() }, [loadRides])

  useEffect(() => {
    const ch = supabase.channel('admin-bookings')
      .on('postgres_changes', { event:'*', schema:'public', table:'bookings' },
        () => loadRides()).subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadRides])

  // Live driver GPS tracking for map modal
  useEffect(() => {
    if (!mapRide?.driver_id) { setDrvPos(null); return }
    let alive = true
    const poll = async () => {
      const { data } = await supabase.from('drivers')
        .select('current_lat,current_lng').eq('id', mapRide.driver_id).maybeSingle()
      if (alive && data?.current_lat) setDrvPos({ lat: parseFloat(data.current_lat), lng: parseFloat(data.current_lng) })
    }
    poll()
    const iv = setInterval(poll, 5000)
    const ch = supabase.channel(`admin-drv-${mapRide.driver_id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'drivers', filter:`id=eq.${mapRide.driver_id}` },
        ({ new:d }) => { if (alive && d.current_lat) setDrvPos({ lat:parseFloat(d.current_lat), lng:parseFloat(d.current_lng) }) })
      .subscribe()
    return () => { alive=false; clearInterval(iv); supabase.removeChannel(ch) }
  }, [mapRide?.driver_id])

  const availDrvs = (drivers||[]).filter(d => d.status==='available' && d.is_approved)

  const assignDriver = async () => {
    if (!selDrv || !selRide) return
    setAsg(true)
    const driver = (drivers||[]).find(d => d.id === selDrv)
    await q(() => supabase.from('bookings').update({
      driver_id: selDrv,
      status: 'confirmed',
      assigned_at: new Date().toISOString(),
      eta_pickup: `${Math.ceil(4 + Math.random()*8)} mins`,
    }).eq('id', selRide.id))
    await q(() => supabase.from('drivers').update({ status:'busy' }).eq('id', selDrv))
    toast.success(`Driver ${driver?.name} assigned to ${selRide.profiles?.full_name}!`)
    setSelRide(null); setSelDrv(''); setAsg(false)
    setRides(r => r.map(b => b.id===selRide.id ? {...b, status:'confirmed', driver_id:selDrv} : b))
    load()
  }

  const statusCol = { pending_admin:'var(--gold)', confirmed:'var(--green)', in_progress:'#3b82f6', cancelled:'var(--red)' }

  return (
    <div className="ops-card">
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        📋 Pending & Active Ride Requests
        <span style={{background:'rgba(245,166,35,.12)',color:'var(--gold)',border:'1px solid rgba(245,166,35,.22)',borderRadius:99,padding:'2px 8px',fontSize:'.72rem',fontWeight:700}}>
          {rides.filter(r=>r.status==='pending_admin').length} pending
        </span>
        <button onClick={loadRides} style={{marginLeft:'auto',background:'rgba(255,255,255,.04)',border:'1px solid var(--b1)',color:'var(--ts)',borderRadius:6,padding:'3px 10px',fontSize:'.75rem',cursor:'pointer',fontFamily:"'Nunito',sans-serif",display:'flex',alignItems:'center',gap:4}} disabled={loading}>
          {loading?<span style={{width:10,height:10,border:'1.5px solid rgba(255,255,255,.2)',borderTopColor:'var(--gold)',borderRadius:'50%',animation:'spin .65s linear infinite',display:'inline-block'}}/>:'↻'} Refresh
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
                {/* User Details */}
                <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.5rem'}}>
                  <div style={{width:34,height:34,borderRadius:'50%',background:'rgba(245,166,35,.1)',border:'1px solid rgba(245,166,35,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'var(--gold)',fontSize:'.85rem',flexShrink:0}}>
                    {user?.full_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:'.9rem'}}>{user?.full_name||'Unknown'}</div>
                    <div style={{fontSize:'.75rem',color:'#504c74'}}>{user?.phone||user?.email||'—'}</div>
                  </div>
                  <span style={{marginLeft:'auto',padding:'.2rem .65rem',borderRadius:99,fontSize:'.65rem',fontWeight:800,textTransform:'uppercase',background:`${statusCol[b.status]||'#504c74'}18`,color:statusCol[b.status]||'#504c74',border:`1px solid ${statusCol[b.status]||'#504c74'}33`,whiteSpace:'nowrap'}}>
                    {b.status.replace('_',' ')}
                  </span>
                </div>

                {/* Trip info */}
                <div style={{fontSize:'.82rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.25rem .5rem',marginBottom:'.5rem'}}>
                  <span style={{color:'#504c74'}}>📍 {b.pickup_address?.split(',')[0]||'—'}</span>
                  <span style={{color:'#504c74'}}>📏 {b.distance_km} km</span>
                  <span style={{color:'#ffb347',fontWeight:700}}>💰 ₹{b.final_fare}{b.discount_amount>0?` (−₹${b.discount_amount})`:''}</span>
                  <span style={{color:'#504c74'}}>🕐 {b.scheduled_at?new Date(b.scheduled_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</span>
                </div>

                {/* User extra info */}
                <div style={{fontSize:'.75rem',color:'#504c74',display:'flex',flexWrap:'wrap',gap:'.35rem'}}>
                  <span>💳 Balance: ₹{Number(user?.balance||0).toLocaleString()}</span>
                  <span>🎁 Concession: ₹{Math.floor((user?.total_deposited||0)/1000)*10}/ride</span>
                  <span>🆔 Ride Code: <strong style={{color:'#ede8d8'}}>{user?.ride_code||'—'}</strong></span>
                  {user?.emergency_contact_name&&<span>🆘 Emergency: {user.emergency_contact_name} · {user.emergency_contact_phone}</span>}
                </div>

                {b.admin_notes&&<div style={{marginTop:'.4rem',fontSize:'.78rem',color:'#ffb347'}}>📝 {b.admin_notes}</div>}
              </div>

              {/* Assign driver */}
              <div style={{display:'flex',gap:'.5rem',alignItems:'center',flexShrink:0,flexWrap:'wrap'}}>
                {b.pickup_lat && (
                  <button onClick={()=>{setMapRide(b);setDrvPos(null)}}
                    style={{background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.25)',color:'#60a5fa',borderRadius:6,padding:'4px 10px',fontSize:'.75rem',fontWeight:700,cursor:'pointer',fontFamily:"'Nunito',sans-serif"}}>
                    🗺 Live Map
                  </button>
                )}
                {isPending && (
                  <button className="ops-btn ops-btn-g" onClick={()=>{setSelRide(b);setSelDrv('')}}>
                    Assign Driver
                  </button>
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
              <div>
                <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:'1rem',color:'#ede8d8'}}>
                  Live Map — {users.find(u=>u.id===mapRide.user_id)?.full_name||'Passenger'}
                </div>
                <div style={{fontSize:'.78rem',color:'#504c74',marginTop:2}}>
                  {mapRide.pickup_address?.split(',')[0]} → {mapRide.drop_address?.split(',')[0]}
                  {driverPos && <span style={{color:'var(--green)',marginLeft:8}}>● Driver GPS live</span>}
                </div>
              </div>
              <button onClick={()=>setMapRide(null)} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',color:'#9890c2',borderRadius:8,width:32,height:32,cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'1.1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <LiveMap
              adminMode
              userPos={mapRide.pickup_lat ? { lat:parseFloat(mapRide.pickup_lat), lng:parseFloat(mapRide.pickup_lng) } : null}
              driverPos={driverPos}
              dropPos={mapRide.drop_lat ? { lat:parseFloat(mapRide.drop_lat), lng:parseFloat(mapRide.drop_lng), label:mapRide.drop_address||'Destination' } : null}
              height={380}
              liveLabel={driverPos ? '🟢 Driver GPS live' : null}
            />
            <div style={{display:'flex',gap:'1rem',marginTop:'1rem',fontSize:'.8rem',color:'#504c74',flexWrap:'wrap'}}>
              <span>📍 Pickup: {mapRide.pickup_address}</span>
              <span>🏁 Drop: {mapRide.drop_address}</span>
              {!driverPos && mapRide.driver_id && <span style={{color:'var(--gold)'}}>⏳ Waiting for driver to go online…</span>}
              {!mapRide.driver_id && <span style={{color:'var(--gold)'}}>⚠ No driver assigned yet</span>}
            </div>
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
              {new Date(selRide.scheduled_at).toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
            </p>

            {availDrvs.length === 0
              ? <div className="warn-box mb3">No available approved drivers right now.</div>
              : (
                <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1.25rem'}}>
                  {availDrvs.map(d => (
                    <button key={d.id} onClick={()=>setSelDrv(d.id)}
                      style={{display:'flex',alignItems:'center',gap:'.75rem',padding:'.85rem 1rem',borderRadius:10,border:`1px solid ${selDrv===d.id?'rgba(245,166,35,.5)':'rgba(255,255,255,.08)'}`,background:selDrv===d.id?'rgba(245,166,35,.08)':'rgba(255,255,255,.02)',cursor:'pointer',fontFamily:"'Nunito',sans-serif",transition:'all .15s'}}>
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
              <button className="ops-btn ops-btn-g" onClick={assignDriver} disabled={!selDrv||assigning} style={{flex:1,opacity:!selDrv?.5:1}}>
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

  // Last 7 days chart
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
      <div style={{color:'#9890c2'}}>{payload[1]?.value} trips</div>
    </div>
  }

  return (
    <div className="ops-card">
      <div style={{fontWeight:700,fontSize:'1rem',marginBottom:'1.25rem'}}>Revenue Analytics</div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginBottom:'1.5rem'}}>
        {[
          [`₹${total.toLocaleString()}`, 'Total Revenue',    '#ffb347'],
          [done.length,                  'Completed Trips',  '#2ecc71'],
          [`₹${avgFare}`,               'Avg Fare',          '#3498db'],
        ].map(([v,l,c])=>(
          <div key={l} style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:12,padding:'1rem',textAlign:'center'}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.6rem',fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:'.7rem',color:'#504c74',textTransform:'uppercase',letterSpacing:'.07em',marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{fontWeight:600,fontSize:'.88rem',color:'#9890c2',marginBottom:'.75rem'}}>Last 7 Days</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{top:5,right:5,left:-15,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false}/>
          <XAxis dataKey="label" tick={{fill:'#504c74',fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:'#504c74',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v}`}/>
          <Tooltip content={<CustomTip/>}/>
          <Bar dataKey="revenue" fill="#ffb347" radius={[6,6,0,0]} maxBarSize={40}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FareSettingsPanel({ profile }) {
  const [settings, setSettings] = React.useState({ rate_per_km:12, minimum_fare:80, surge_enabled:false, surge_multiplier:1.0 })
  const [saving,   setSaving]   = React.useState(false)
  const [loaded,   setLoaded]   = React.useState(false)

  useEffect(()=>{
    q(()=>supabase.from('fare_settings').select('*').limit(1).maybeSingle())
      .then(({data})=>{if(data){setSettings(data);}setLoaded(true)})
  },[])

  const save = async () => {
    setSaving(true)
    // Upsert (update if exists, insert if not)
    const { data: existing } = await q(()=>supabase.from('fare_settings').select('id').limit(1).maybeSingle())
    if (existing?.id) {
      await q(()=>supabase.from('fare_settings').update({...settings,updated_at:new Date().toISOString(),updated_by:profile?.id}).eq('id',existing.id))
    } else {
      await q(()=>supabase.from('fare_settings').insert({...settings,updated_by:profile?.id}))
    }
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
        <div>
          <label style={{fontSize:'.74rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#9890c2',display:'block',marginBottom:'.42rem'}}>Rate per KM (₹)</label>
          <input type="number" min={1} max={100} value={settings.rate_per_km}
            onChange={e=>setSettings(s=>({...s,rate_per_km:Number(e.target.value)}))}
            style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,165,40,.2)',borderRadius:8,padding:'.78rem 1rem',color:'#ede8d8',fontSize:'1.1rem',fontWeight:700,width:'100%',outline:'none',fontFamily:"'Nunito',sans-serif"}}/>
          <p style={{fontSize:'.72rem',color:'#504c74',marginTop:'.25rem'}}>Current: ₹{settings.rate_per_km}/km</p>
        </div>
        <div>
          <label style={{fontSize:'.74rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#9890c2',display:'block',marginBottom:'.42rem'}}>Minimum Fare (₹)</label>
          <input type="number" min={10} max={500} value={settings.minimum_fare}
            onChange={e=>setSettings(s=>({...s,minimum_fare:Number(e.target.value)}))}
            style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,165,40,.2)',borderRadius:8,padding:'.78rem 1rem',color:'#ede8d8',fontSize:'1.1rem',fontWeight:700,width:'100%',outline:'none',fontFamily:"'Nunito',sans-serif"}}/>
          <p style={{fontSize:'.72rem',color:'#504c74',marginTop:'.25rem'}}>Min charge per ride</p>
        </div>
      </div>

      {/* Surge pricing */}
      <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:12,padding:'1rem',marginBottom:'1.25rem'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:settings.surge_enabled?'.85rem':0}}>
          <div>
            <div style={{fontWeight:700,fontSize:'.9rem'}}>Surge Pricing</div>
            <div style={{fontSize:'.75rem',color:'#504c74',marginTop:1}}>Multiply fares during peak demand</div>
          </div>
          <label style={{position:'relative',cursor:'pointer'}}>
            <input type="checkbox" checked={settings.surge_enabled} onChange={e=>setSettings(s=>({...s,surge_enabled:e.target.checked}))} style={{opacity:0,position:'absolute',width:0,height:0}}/>
            <div style={{width:40,height:22,background:settings.surge_enabled?'#ffb347':'rgba(255,255,255,.1)',borderRadius:99,transition:'background .2s',position:'relative'}}>
              <div style={{position:'absolute',top:3,left:settings.surge_enabled?19:3,width:16,height:16,background:'#fff',borderRadius:'50%',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.3)'}}/>
            </div>
          </label>
        </div>
        {settings.surge_enabled && (
          <div>
            <label style={{fontSize:'.74rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'#9890c2',display:'block',marginBottom:'.4rem'}}>Multiplier</label>
            <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
              {[1.2,1.5,1.75,2.0,2.5].map(m=>(
                <button key={m} onClick={()=>setSettings(s=>({...s,surge_multiplier:m}))}
                  style={{padding:'.45rem .9rem',borderRadius:8,border:`1px solid ${settings.surge_multiplier===m?'rgba(255,165,40,.5)':'rgba(255,255,255,.1)'}`,background:settings.surge_multiplier===m?'rgba(255,165,40,.12)':'transparent',color:settings.surge_multiplier===m?'#ffb347':'#9890c2',fontWeight:700,cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'.85rem'}}>
                  {m}×
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fare preview table */}
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontWeight:600,fontSize:'.85rem',color:'#9890c2',marginBottom:'.65rem'}}>Fare Preview</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
          <thead><tr>{['Distance','Base','With Surge'].map(h=><th key={h} style={{textAlign:'left',padding:'.5rem .75rem',fontSize:'.68rem',textTransform:'uppercase',letterSpacing:'.08em',color:'#504c74',borderBottom:'1px solid rgba(255,165,40,.1)'}}>{h}</th>)}</tr></thead>
          <tbody>
            {[2,5,10,15,20].map(km=>(
              <tr key={km}>
                <td style={{padding:'.5rem .75rem',color:'#9890c2'}}>{km} km</td>
                <td style={{padding:'.5rem .75rem',color:'#ede8d8',fontWeight:600}}>₹{Math.max(settings.minimum_fare,Math.round(km*settings.rate_per_km))}</td>
                <td style={{padding:'.5rem .75rem',color:settings.surge_enabled?'#ffb347':'#504c74',fontWeight:settings.surge_enabled?700:400}}>
                  {settings.surge_enabled ? `₹${previewFare(km)} (${settings.surge_multiplier}×)` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={save} disabled={saving}
        style={{width:'100%',padding:'.82rem',background:'linear-gradient(135deg,#ffb347,#ff6b35)',color:'#05050e',border:'none',borderRadius:10,fontWeight:700,cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontSize:'.95rem',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:saving?.6:1}}>
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
    q(() => supabase.from('sos_alerts').select('*,profiles:user_id(full_name,phone,emergency_contact_name,emergency_contact_phone),drivers:driver_id(name,phone,vehicle_number)').order('created_at',{ascending:false}).limit(30))
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
        <span>🆘</span> SOS Alerts
      </div>
      {loading && <div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>Loading…</div>}
      {!loading && alerts.length===0 && <div style={{color:'#504c74',textAlign:'center',padding:'2rem'}}>✅ No SOS alerts — all clear</div>}
      {alerts.map(a => (
        <div key={a.id} style={{background:a.resolved?'rgba(255,255,255,.02)':'rgba(231,76,60,.06)',border:`1px solid ${a.resolved?'rgba(255,255,255,.07)':'rgba(231,76,60,.25)'}`,borderRadius:12,padding:'1rem',marginBottom:'.75rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'.5rem'}}>
            <div>
              <span style={{fontWeight:700,color:a.resolved?'#504c74':'#e74c3c',fontSize:'.9rem'}}>{a.resolved?'✅ Resolved':'🆘 ACTIVE SOS'}</span>
              <span style={{color:'#504c74',fontSize:'.75rem',marginLeft:8}}>{new Date(a.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            {!a.resolved && <button className="ops-btn ops-btn-g" onClick={()=>resolve(a.id)}>✓ Resolve</button>}
          </div>
          <div style={{fontSize:'.83rem',display:'flex',flexDirection:'column',gap:3}}>
            <span>👤 Passenger: <strong style={{color:'#ede8d8'}}>{a.profiles?.full_name||'Unknown'}</strong> · {a.profiles?.phone||'—'}</span>
            <span>🚗 Driver: <strong style={{color:'#ede8d8'}}>{a.drivers?.name||'—'}</strong> · {a.drivers?.phone||'—'} · {a.drivers?.vehicle_number||'—'}</span>
            {a.profiles?.emergency_contact_phone && <span>📞 Emergency contact: {a.profiles.emergency_contact_name} · {a.profiles.emergency_contact_phone}</span>}
            {a.location_lat && <a href={`https://maps.google.com/?q=${a.location_lat},${a.location_lng}`} target="_blank" rel="noreferrer" style={{color:'#3498db',fontSize:'.8rem'}}>📍 View location on Google Maps →</a>}
          </div>
        </div>
      ))}
    </div>
  )
}

const TABS = [['overview','Overview',BarChart2],['bookings-queue','Pending Rides',Package],['analytics','Revenue',BarChart2],['fares','Fare Settings',CreditCard],['sos','SOS Alerts',AlertTriangle],['pending','Pending Drivers',Car],['discounts','Discounts',CreditCard],['deposits','Deposits',Package],['drivers','Drivers',Car],['bookings','Bookings',Settings],['users','Users',Users]]
const SC = { confirmed:'#2ecc71', in_progress:'#ffb347', completed:'#3498db', cancelled:'#e74c3c', pending:'#504c74' }

const II = ({ value, onChange, type='text', placeholder='', w=90 }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,165,40,.18)', borderRadius:6, padding:'.35rem .55rem', color:'#ede8d8', fontSize:'.8rem', width:w, fontFamily:"'Nunito',sans-serif", outline:'none' }}
    onFocus={e=>e.target.style.borderColor='#ffb347'} onBlur={e=>e.target.style.borderColor='rgba(255,165,40,.18)'}/>
)

export default function OpsDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]   = useState('overview')
  const [data, setData] = useState({ tiers:[], drivers:[], pendingDrivers:[], bookings:[], deposits:[], users:[] })
  const [editTier, setET]= useState(null)
  const [newTier, setNT] = useState({ min_amount:'', max_amount:'', discount_percent:'', label:'' })
  const [loading, setLd] = useState(false)

  const load = useCallback(async () => {
    const [t,d,pd,b,dep,u] = await Promise.all([
      q(() => supabase.from('discount_tiers').select('*').order('sort_order')),
      q(() => supabase.from('drivers').select('*').eq('is_approved',true).order('created_at',{ascending:false})),
      q(() => supabase.from('drivers').select('*').eq('is_approved',false).order('created_at',{ascending:false})),
      q(() => supabase.from('bookings').select('id,receipt_number,pickup_address,drop_address,final_fare,discount_amount,status,created_at,scheduled_at,user_id,driver_id,drivers(name,vehicle_number)').order('created_at',{ascending:false}).limit(60)),
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

  const { tiers, drivers, pendingDrivers = [], bookings, deposits, users } = data
  const pendingDep = deposits.filter(d=>d.status==='pending').length
  const pendingBk  = bookings.filter(b=>b.status==='pending').length
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
    toast.success(`Approved${tier?` · ${tier.discount_percent}% discount applied`:''}`)
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

  const assignDriver = async (bookingId, driverId) => {
    await q(() => supabase.from('bookings').update({driver_id:driverId,status:'confirmed'}).eq('id',bookingId))
    await q(() => supabase.from('drivers').update({status:'busy'}).eq('id',driverId))
    toast.success('Driver assigned'); load()
  }

  const s = (c,sz=14) => ({ color:c, width:sz, height:sz, flexShrink:0 })

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
        .ops-tbl tbody tr:hover td { background:rgba(255,255,255,.016); }
        .ops-tbl tbody tr:last-child td { border-bottom:none; }
        .ops-badge { display:inline-flex; align-items:center; gap:4px; padding:.22rem .6rem; border-radius:99px; font-size:.67rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
        .ops-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:.4rem .82rem; border-radius:8px; font-family:'Nunito',sans-serif; font-weight:700; font-size:.78rem; cursor:pointer; border:none; transition:all .2s; white-space:nowrap; }
        .ops-btn-p { background:linear-gradient(135deg,#ffb347,#ff6b35); color:#03030a; }
        .ops-btn-p:hover { transform:translateY(-1px); }
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
        @media(max-width:768px) { .ops-stat-grid{grid-template-columns:1fr 1fr!important;} }
      `}</style>

      {/* Top nav */}
      <div className="ops-nav">
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
          <div style={{ width:32, height:32, background:'rgba(255,179,71,.15)', border:'1px solid rgba(255,179,71,.3)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img src="/logo.png" alt="" style={{ width:22, height:22, objectFit:'contain', filter:'drop-shadow(0 0 6px rgba(255,179,71,.4))' }} onError={e=>e.target.style.display='none'}/>
          </div>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:'1rem', background:'linear-gradient(135deg,#ffb347,#ff6b35)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Raid Cabs</div>
            <div style={{ fontSize:'.64rem', color:'#504c74', letterSpacing:'.06em', textTransform:'uppercase', lineHeight:1 }}>Ops Centre</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          <span style={{ color:'#504c74', fontSize:'.82rem' }}>{profile?.full_name || 'Admin'}</span>
          <button className="ops-btn ops-btn-ghost" onClick={load}><RefreshCw size={13}/></button>
          <button className="ops-btn ops-btn-ghost" onClick={() => navigate('/driver-signup')}><Plus size={13}/> Driver</button>
          <button className="ops-btn ops-btn-r" onClick={() => navigate('/emergency-driver')}><AlertTriangle size={13}/></button>
          <button className="ops-btn ops-btn-ghost" onClick={async()=>{ await signOut(); navigate('/ops') }}>
            <LogOut size={13}/> Sign Out
          </button>
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
            {id==='bookings'&&pendingBk>0&&<span className="ops-badge-n">{pendingBk}</span>}
          </button>
        ))}
      </div>

      <div style={{ flex:1, padding:'1.75rem 2rem', overflowX:'auto' }}>

        {/* OVERVIEW */}
        {tab==='overview' && (
          <>
            <div className="ops-stat-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.75rem' }}>
              {[
                [drivers.filter(d=>d.status==='available').length, 'Available Drivers', '#2ecc71'],
                [bookings.filter(b=>b.status==='confirmed').length, 'Active Rides', '#3498db'],
                [pendingDep, 'Pending Deposits', '#e74c3c'],
                [`₹${revenue.toLocaleString()}`, 'Total Revenue', '#ffb347'],
                [drivers.length, 'Total Drivers', '#ffb347'],
                [bookings.length, 'All Bookings', '#9890c2'],
                [bookings.filter(b=>b.status==='completed').length, 'Completed', '#2ecc71'],
                [users.length, 'Total Users', '#9b59b6'],
              ].map(([v,l,c]) => (
                <div key={l} className="ops-stat">
                  <div className="ops-stat-v" style={{ color:c }}>{v}</div>
                  <div className="ops-stat-l">{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
              <div className="ops-card">
                <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:'1rem', color:'#9890c2' }}>Recent Bookings</div>
                {bookings.slice(0,8).map(b => (
                  <div key={b.id} style={{ display:'flex', justifyContent:'space-between', padding:'.5rem 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:'.8rem' }}>
                    <div style={{ minWidth:0, flex:1 }}>
                      <span style={{ fontWeight:600 }}>{b.profiles?.full_name||'—'}</span>
                      <span style={{ color:'#504c74', marginLeft:6 }}>{b.pickup_address?.slice(0,20)}…</span>
                    </div>
                    <div style={{ display:'flex', gap:'.4rem', alignItems:'center', flexShrink:0 }}>
                      <span style={{ color:'#ffb347', fontWeight:700 }}>₹{b.final_fare}</span>
                      <span className="ops-badge" style={{ background:`${SC[b.status]||'#504c74'}18`, color:SC[b.status]||'#504c74', border:`1px solid ${SC[b.status]||'#504c74'}33` }}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="ops-card">
                <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:'1.1rem', color:'#9890c2' }}>Fleet Status</div>
                {[['available','#2ecc71'],['busy','#ffb347'],['offline','#504c74']].map(([s,c]) => {
                  const n = drivers.filter(d=>d.status===s).length
                  const pct = drivers.length ? Math.round(n/drivers.length*100) : 0
                  return (
                    <div key={s} style={{ marginBottom:'.85rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.8rem', marginBottom:'.25rem' }}>
                        <span style={{ color:'#9890c2', textTransform:'capitalize' }}>{s}</span>
                        <span style={{ color:c, fontWeight:700 }}>{n}</span>
                      </div>
                      <div style={{ height:6, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:99, transition:'width .5s' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}


        {/* PENDING DRIVERS */}
        {tab==='pending' && (
          <div className="ops-card">
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'.75rem' }}>
              Pending Driver Applications
              {pendingDrivers.length > 0 && (
                <span className="ops-badge-n" style={{ padding:'2px 8px', fontSize:'.72rem' }}>{pendingDrivers.length} waiting</span>
              )}
            </div>
            {pendingDrivers.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'#504c74' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>✅</div>
                <p>No pending applications</p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="ops-tbl" style={{ minWidth:600 }}>
                  <thead><tr><th>Name</th><th>Phone</th><th>Vehicle No.</th><th>Model</th><th>Applied</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pendingDrivers.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight:700 }}>{d.name}</td>
                        <td style={{ color:'#9890c2', fontSize:'.83rem' }}>{d.phone}</td>
                        <td style={{ fontFamily:'monospace', color:'#ffb347', fontWeight:700, letterSpacing:'.04em' }}>{d.vehicle_number}</td>
                        <td style={{ color:'#9890c2', fontSize:'.83rem' }}>{d.vehicle_model}</td>
                        <td style={{ color:'#504c74', fontSize:'.76rem' }}>{new Date(d.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</td>
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="ops-btn ops-btn-g"
                              onClick={async()=>{
                                const pin = prompt('Set a 4-6 digit PIN for ' + d.name + ' (they use this to log in):')
                                if (!pin || pin.replace(/\D/g,'').length < 4) { alert('PIN must be 4-6 digits'); return }
                                await q(()=>supabase.from('drivers').update({is_approved:true, login_pin: pin.replace(/\D/g,'')}).eq('id',d.id))
                                toast.success(d.name + ' approved - PIN: ' + pin.replace(/[^0-9]/g,''))
                                load()
                              }}>
                              <CheckCircle size={11}/> Approve
                            </button>
                            <button className="ops-btn ops-btn-r"
                              onClick={async()=>{
                                await q(()=>supabase.from('drivers').delete().eq('id',d.id))
                                toast.success('Application rejected')
                                load()
                              }}>
                              <XCircle size={11}/> Reject
                            </button>
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


        {/* SOS ALERTS */}
        {tab==='sos' && (
          <SosAlertsPanel/>
        )}


        {/* PENDING RIDES */}
        {tab==='bookings-queue' && <PendingRidesPanel drivers={drivers} load={load}/>}

        {/* ANALYTICS */}
        {tab==='analytics' && <RevenuePanel bookings={bookings}/>}

        {/* FARE SETTINGS */}
        {tab==='fares' && <FareSettingsPanel profile={profile}/>}

        {/* DISCOUNTS */}
        {tab==='discounts' && (
          <div className="ops-card">
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1.25rem' }}>Discount Tiers</div>
            <div style={{ overflowX:'auto' }}>
              <table className="ops-tbl" style={{ minWidth:520 }}>
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
                          <td style={{ display:'flex', gap:4, paddingTop:'1rem' }}>
                            <button className="ops-btn ops-btn-p" onClick={saveTier} disabled={loading}><Check size={11}/></button>
                            <button className="ops-btn ops-btn-ghost" onClick={()=>setET(null)}><X size={11}/></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ color:'#ffb347', fontWeight:700 }}>₹{Number(t.min_amount).toLocaleString()}</td>
                          <td style={{ color:'#9890c2' }}>{t.max_amount?`₹${Number(t.max_amount).toLocaleString()}`:'∞'}</td>
                          <td><span className="ops-badge" style={{ background:'rgba(255,179,71,.13)', color:'#ffb347', border:'1px solid rgba(255,179,71,.26)' }}>{t.discount_percent}%</span></td>
                          <td style={{ color:'#9890c2' }}>{t.label}</td>
                          <td>
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="ops-btn ops-btn-ghost" onClick={()=>setET({...t})}><Pencil size={11}/></button>
                              <button className="ops-btn ops-btn-r" onClick={async()=>{ await q(()=>supabase.from('discount_tiers').delete().eq('id',t.id)); load(); toast.success('Deleted') }}><Trash2 size={11}/></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr style={{ background:'rgba(255,179,71,.02)' }}>
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

        {/* DEPOSITS */}
        {tab==='deposits' && (
          <div className="ops-card">
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1.25rem' }}>Deposit Requests</div>
            <div style={{ overflowX:'auto' }}>
              <table className="ops-tbl" style={{ minWidth:700 }}>
                <thead><tr><th>User</th><th>Phone</th><th>Amount</th><th>Tier</th><th>Ref</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {deposits.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight:600 }}>{users.find(u=>u.id===d.user_id)?.full_name||'—'}</td>
                      <td style={{ color:'#9890c2', fontSize:'.8rem' }}>{users.find(u=>u.id===d.user_id)?.phone||'—'}</td>
                      <td style={{ color:'#ffb347', fontWeight:700 }}>₹{Number(d.amount).toLocaleString()}</td>
                      <td><span className="ops-badge" style={{ background:'rgba(255,179,71,.12)', color:'#ffb347', border:'1px solid rgba(255,179,71,.25)' }}>{d.discount_applied||0}%</span></td>
                      <td style={{ color:'#504c74', fontSize:'.76rem', fontFamily:'monospace' }}>{d.payment_ref||'—'}</td>
                      <td><span className="ops-badge" style={{ background:`rgba(${d.status==='confirmed'?'46,204,113':d.status==='rejected'?'231,76,60':'255,179,71'},.12)`, color:d.status==='confirmed'?'#2ecc71':d.status==='rejected'?'#e74c3c':'#ffb347', border:`1px solid rgba(${d.status==='confirmed'?'46,204,113':d.status==='rejected'?'231,76,60':'255,179,71'},.25)` }}>{d.status}</span></td>
                      <td style={{ color:'#504c74', fontSize:'.76rem' }}>{new Date(d.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                      <td>
                        {d.status==='pending' && (
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="ops-btn ops-btn-g" onClick={()=>approveDeposit(d)} disabled={loading}><CheckCircle size={11}/> Approve</button>
                            <button className="ops-btn ops-btn-r" onClick={()=>rejectDeposit(d.id)}><XCircle size={11}/></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {deposits.length===0&&<tr><td colSpan={8} style={{ textAlign:'center', color:'#504c74', padding:'2rem' }}>No deposits yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DRIVERS */}
        {tab==='drivers' && (
          <div className="ops-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <div style={{ fontWeight:700, fontSize:'1rem' }}>Drivers</div>
              <div style={{ display:'flex', gap:'.5rem' }}>
                <button className="ops-btn ops-btn-o" onClick={()=>navigate('/driver-signup')}><Plus size={12}/> Add</button>
                <button className="ops-btn ops-btn-r" onClick={()=>navigate('/emergency-driver')}><AlertTriangle size={12}/> Emergency</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="ops-tbl" style={{ minWidth:640 }}>
                <thead><tr><th>Name</th><th>Phone</th><th>Rating</th><th>Vehicle</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {drivers.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight:700 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,179,71,.1)', border:'1px solid rgba(255,179,71,.2)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#ffb347', fontSize:'.8rem' }}>
                            {d.photo_url
                              ? <img src={d.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                              : d.name?.[0]?.toUpperCase()
                            }
                          </div>
                          <span>{d.name}</span>
                        </div>
                        {d.is_emergency&&<span className="ops-badge" style={{ marginLeft:5, background:'rgba(231,76,60,.12)', color:'#e74c3c', border:'1px solid rgba(231,76,60,.25)', fontSize:'.6rem' }}>EMG</span>}
                      </td>
                      <td style={{ color:'#9890c2', fontSize:'.83rem' }}>{d.phone}</td>
                      <td><span style={{ color:'#ffb347', fontWeight:700 }}>★ {Number(d.rating).toFixed(1)}</span> <span style={{ color:'#504c74', fontSize:'.73rem' }}>({d.total_ratings})</span></td>
                      <td style={{ fontSize:'.83rem', color:'#9890c2' }}>{d.vehicle_model}{d.vehicle_number&&<><br/><span style={{ fontFamily:'monospace', fontSize:'.76rem', color:'#504c74' }}>{d.vehicle_number}</span></>}</td>
                      <td>
                        <span className="ops-badge" style={{ background:`rgba(${d.status==='available'?'46,204,113':d.status==='busy'?'255,179,71':'80,76,116'},.12)`, color:d.status==='available'?'#2ecc71':d.status==='busy'?'#ffb347':'#504c74', border:`1px solid rgba(${d.status==='available'?'46,204,113':d.status==='busy'?'255,179,71':'80,76,116'},.25)` }}>{d.status}</span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <select className="ops-input-s" value={d.status} onChange={e=>{q(()=>supabase.from('drivers').update({status:e.target.value}).eq('id',d.id)).then(load)}}>
                            <option value="available">Available</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                          </select>
                          <button className="ops-btn ops-btn-r" onClick={async()=>{await q(()=>supabase.from('drivers').delete().eq('id',d.id));load();toast.success('Removed')}}><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {drivers.length===0&&<tr><td colSpan={6} style={{ textAlign:'center', color:'#504c74', padding:'2rem' }}>No drivers yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab==='bookings' && (
          <div className="ops-card">
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1.25rem' }}>All Bookings</div>
            <div style={{ overflowX:'auto' }}>
              <table className="ops-tbl" style={{ minWidth:780 }}>
                <thead><tr><th>Receipt</th><th>User</th><th>Pickup</th><th>Fare</th><th>Driver</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontFamily:'monospace', fontSize:'.76rem', color:'#9890c2' }}>{b.receipt_number||'—'}</td>
                      <td style={{ fontWeight:600 }}>{users.find(u=>u.id===b.user_id)?.full_name||'—'}</td>
                      <td style={{ color:'#9890c2', fontSize:'.8rem', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.pickup_address}</td>
                      <td style={{ color:'#ffb347', fontWeight:700 }}>₹{b.final_fare}</td>
                      <td style={{ color:'#9890c2', fontSize:'.83rem' }}>{b.drivers?.name||<span style={{ color:'#e74c3c' }}>None</span>}</td>
                      <td><span className="ops-badge" style={{ background:`${SC[b.status]||'#504c74'}18`, color:SC[b.status]||'#504c74', border:`1px solid ${SC[b.status]||'#504c74'}33` }}>{b.status}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {b.status==='confirmed'&&<>
                            <button className="ops-btn ops-btn-g" onClick={()=>updateBooking(b.id,'completed')}><CheckCircle size={11}/></button>
                            <button className="ops-btn ops-btn-r" onClick={()=>updateBooking(b.id,'cancelled')}><XCircle size={11}/></button>
                          </>}
                          {b.status==='pending'&&(
                            <select className="ops-input-s" defaultValue="" onChange={e=>e.target.value&&assignDriver(b.id,e.target.value)}>
                              <option value="">Assign…</option>
                              {drivers.filter(d=>d.status==='available').map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length===0&&<tr><td colSpan={7} style={{ textAlign:'center', color:'#504c74', padding:'2rem' }}>No bookings yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS */}
        {tab==='users' && (
          <div className="ops-card">
            <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:'1.25rem' }}>All Users</div>
            <div style={{ overflowX:'auto' }}>
              <table className="ops-tbl" style={{ minWidth:580 }}>
                <thead><tr><th>Name</th><th>Phone</th><th>Balance</th><th>Discount</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight:600 }}>{u.full_name||'—'}</td>
                      <td style={{ color:'#9890c2', fontSize:'.83rem' }}>{u.phone||'—'}</td>
                      <td style={{ color:'#ffb347', fontWeight:700 }}>₹{Number(u.balance||0).toLocaleString()}</td>
                      <td><span className="ops-badge" style={{ background:'rgba(255,179,71,.12)', color:'#ffb347', border:'1px solid rgba(255,179,71,.25)' }}>{u.discount_percent||0}%</span></td>
                      <td><span className="ops-badge" style={{ background:`rgba(${u.role==='admin'?'231,76,60':'52,152,219'},.12)`, color:u.role==='admin'?'#e74c3c':'#3498db', border:`1px solid rgba(${u.role==='admin'?'231,76,60':'52,152,219'},.25)` }}>{u.role}</span></td>
                      <td style={{ color:'#504c74', fontSize:'.76rem' }}>{new Date(u.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</td>
                      <td>
                        <select className="ops-input-s" value={u.role||'user'} onChange={e=>{q(()=>supabase.from('profiles').update({role:e.target.value}).eq('id',u.id)).then(()=>{load();toast.success('Role updated')})}}>
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
    </div>
  )
}
