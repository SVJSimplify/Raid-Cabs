import React, { useState, useEffect, useCallback } from 'react'
import { OPS_PATH } from '../config'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, q } from '../lib/supabase'
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
    q(() => supabase.from('sos_alerts').select('*,profiles(full_name,phone,emergency_contact_name,emergency_contact_phone),drivers(name,phone,vehicle_number)').order('created_at',{ascending:false}).limit(30))
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

const TABS = [['overview','Overview',BarChart2],['sos','SOS Alerts',AlertTriangle],['pending','Pending Drivers',Car],['discounts','Discounts',CreditCard],['deposits','Deposits',Package],['drivers','Drivers',Car],['bookings','Bookings',Settings],['users','Users',Users]]
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
      q(() => supabase.from('bookings').select('id,receipt_number,pickup_address,final_fare,status,created_at,user_id,driver_id,profiles!bookings_user_id_fkey(full_name),drivers(name)').order('created_at',{ascending:false}).limit(60)),
      q(() => supabase.from('deposits').select('id,amount,discount_applied,payment_ref,status,created_at,user_id,profiles!deposits_user_id_fkey(full_name,phone)').order('created_at',{ascending:false}).limit(60)),
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
                      <td style={{ fontWeight:600 }}>{d.profiles?.full_name||'—'}</td>
                      <td style={{ color:'#9890c2', fontSize:'.8rem' }}>{d.profiles?.phone||'—'}</td>
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
                        {d.name}
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
                      <td style={{ fontWeight:600 }}>{b.profiles?.full_name||'—'}</td>
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
