import { useState, useEffect, useCallback } from 'react'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Settings, Users, Car, CreditCard, Package, Pencil, Trash2, Check, X, Plus, AlertTriangle, Shield, RefreshCw, CheckCircle, XCircle, BarChart2, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  ['overview',   'Overview',    BarChart2],
  ['discounts',  'Discounts',   CreditCard],
  ['deposits',   'Deposits',    Package],
  ['drivers',    'Drivers',     Car],
  ['bookings',   'Bookings',    Settings],
  ['users',      'Users',       Users],
]

const STATUS_COLOR = {
  confirmed:'var(--green)', in_progress:'var(--gold)',
  completed:'var(--blue)',  cancelled:'var(--red)', pending:'var(--tm)',
}

export default function Admin() {
  const { profile } = useAuth()
  const navigate     = useNavigate()
  const [tab, setTab]   = useState('overview')
  const [data, setData] = useState({ tiers:[], drivers:[], bookings:[], deposits:[], users:[] })
  const [editTier, setET]= useState(null)
  const [newTier, setNT] = useState({ min_amount:'', max_amount:'', discount_percent:'', label:'' })
  const [loading, setLd] = useState(false)

  const loadAll = useCallback(async () => {
    const [t, d, b, dep, u] = await Promise.all([
      q(() => supabase.from('discount_tiers').select('*').order('sort_order')),
      q(() => supabase.from('drivers').select('*').order('created_at', { ascending:false })),
      q(() => supabase.from('bookings')
        .select('id,receipt_number,pickup_address,final_fare,base_fare,discount_amount,distance_km,status,created_at,user_id,driver_id,profiles(full_name,phone),drivers(name)')
        .order('created_at', { ascending:false }).limit(50)
      ),
      q(() => supabase.from('deposits')
        .select('id,amount,discount_applied,payment_ref,status,created_at,user_id,profiles(full_name,phone)')
        .order('created_at', { ascending:false }).limit(50)
      ),
      q(() => supabase.from('profiles').select('*').order('created_at', { ascending:false })),
    ])
    setData({
      tiers:   t.data   || [],
      drivers: d.data   || [],
      bookings:b.data   || [],
      deposits:dep.data || [],
      users:   u.data   || [],
    })
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Real-time bookings channel
  useEffect(() => {
    const ch = supabase.channel('admin-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'bookings' }, loadAll)
      .on('postgres_changes', { event:'*', schema:'public', table:'deposits' }, loadAll)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadAll])

  const { tiers, drivers, bookings, deposits, users } = data
  const pendingDep = deposits.filter(d => d.status === 'pending').length
  const pendingBk  = bookings.filter(b => b.status === 'pending').length
  const revenue    = bookings.filter(b => b.status === 'completed').reduce((s,b) => s+(b.final_fare||0), 0)

  // ── Tier CRUD ────────────────────────────────────────────────────────────
  const saveTier = async () => {
    setLd(true)
    const d = editTier?.id ? editTier : { ...newTier, sort_order: tiers.length + 1 }
    if (!d.min_amount || !d.discount_percent || !d.label) {
      toast.error('Fill all required fields'); setLd(false); return
    }
    const { error } = editTier?.id
      ? await q(() => supabase.from('discount_tiers').update(d).eq('id', d.id))
      : await q(() => supabase.from('discount_tiers').insert(d))
    if (error) toast.error(error.message)
    else {
      toast.success(editTier?.id ? 'Tier updated' : 'Tier added')
      setET(null)
      setNT({ min_amount:'', max_amount:'', discount_percent:'', label:'' })
    }
    setLd(false); loadAll()
  }

  const deleteTier = async id => {
    const { error } = await q(() => supabase.from('discount_tiers').delete().eq('id', id))
    if (error) toast.error(error.message)
    else { toast.success('Tier deleted'); loadAll() }
  }

  // ── Deposit approval ─────────────────────────────────────────────────────
  const approveDeposit = async dep => {
    setLd(true)
    const tier = tiers
      .filter(t => dep.amount >= t.min_amount && (!t.max_amount || dep.amount <= t.max_amount))
      .sort((a,b) => b.min_amount - a.min_amount)[0]

    const { error: e1 } = await q(() => supabase.from('deposits').update({
      status:      'confirmed',
      approved_by: profile?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', dep.id))

    if (e1) { toast.error(e1.message); setLd(false); return }

    if (tier) {
      await q(() => supabase.from('profiles').update({
        balance:          dep.amount,
        discount_percent: tier.discount_percent,
        updated_at:       new Date().toISOString(),
      }).eq('id', dep.user_id))
    }
    toast.success(`Deposit approved${tier ? ` · ${tier.discount_percent}% discount applied` : ''}`)
    setLd(false); loadAll()
  }

  const rejectDeposit = async id => {
    await q(() => supabase.from('deposits').update({ status:'rejected', rejected_at: new Date().toISOString() }).eq('id', id))
    toast.success('Deposit rejected'); loadAll()
  }

  // ── Booking management ────────────────────────────────────────────────────
  const updateBooking = async (id, status, driverId) => {
    const up = { status }
    if (status === 'completed') up.completed_at = new Date().toISOString()
    if (status === 'cancelled') { up.cancelled_at = new Date().toISOString(); up.cancellation_reason = 'Admin cancelled' }
    await q(() => supabase.from('bookings').update(up).eq('id', id))
    if (status === 'completed' || status === 'cancelled') {
      const bk = bookings.find(b => b.id === id)
      if (bk?.driver_id) await q(() => supabase.from('drivers').update({ status:'available' }).eq('id', bk.driver_id))
    }
    toast.success(`Booking marked ${status}`); loadAll()
  }

  const assignDriver = async (bookingId, driverId) => {
    await q(() => supabase.from('bookings').update({ driver_id:driverId, status:'confirmed' }).eq('id', bookingId))
    await q(() => supabase.from('drivers').update({ status:'busy' }).eq('id', driverId))
    toast.success('Driver assigned'); loadAll()
  }

  // ── Driver management ────────────────────────────────────────────────────
  const setDriverStatus = async (id, status) => {
    await q(() => supabase.from('drivers').update({ status }).eq('id', id))
    loadAll()
  }

  const deleteDriver = async id => {
    const { error } = await q(() => supabase.from('drivers').delete().eq('id', id))
    if (error) toast.error(error.message)
    else { toast.success('Driver removed'); loadAll() }
  }

  // ── User role ────────────────────────────────────────────────────────────
  const setUserRole = async (id, role) => {
    await q(() => supabase.from('profiles').update({ role }).eq('id', id))
    toast.success('Role updated'); loadAll()
  }

  const InlineInput = ({ value, onChange, type='text', placeholder='', width=90 }) => (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ background:'rgba(255,255,255,.05)', border:'1px solid var(--b1)', borderRadius:6, padding:'.36rem .58rem', color:'var(--tp)', fontSize:'.82rem', width, fontFamily:'var(--fb)', outline:'none' }}
      onFocus={e => e.target.style.borderColor='var(--gold)'}
      onBlur={e => e.target.style.borderColor='var(--b1)'}
    />
  )

  return (
    <div className="main" style={{ padding:'2rem' }}>
      <style>{`
        .ar{display:flex;gap:.4rem;align-items:center;}
        .ov-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem;}
        .ov-card{background:var(--card);border:1px solid var(--b1);border-radius:var(--r);padding:1.3rem;text-align:center;}
        .ov-v{font-family:var(--fd);font-size:1.9rem;font-weight:700;}
        .ov-l{font-size:.71rem;color:var(--tm);text-transform:uppercase;letter-spacing:.08em;margin-top:.25rem;}
        @media(max-width:768px){.ov-grid{grid-template-columns:1fr 1fr;}}
      `}</style>

      <div style={{ maxWidth:1160, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'.85rem', marginBottom:'1.75rem', flexWrap:'wrap' }}>
          <div style={{ width:44, height:44, background:'rgba(255,179,71,.12)', border:'1px solid var(--b2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gold)' }}>
            <Shield size={20}/>
          </div>
          <div style={{ flex:1 }}>
            <h1 className="h2">Admin Panel</h1>
            <p className="sub">Raid Cabs Operations Centre</p>
          </div>
          <div style={{ display:'flex', gap:'.6rem', flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={loadAll}><RefreshCw size={13}/> Refresh</button>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/driver-signup')}><Plus size={13}/> Add Driver</button>
            <button className="btn btn-danger btn-sm" onClick={() => navigate('/emergency-driver')}><AlertTriangle size={13}/> Emergency</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs mb3">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} className={`tab ${tab===id?'on':''}`} onClick={() => setTab(id)}>
              <Icon size={14}/> {label}
              {id==='deposits' && pendingDep > 0 && <span className="badge b-red" style={{ fontSize:'.6rem', padding:'1px 5px', marginLeft:2 }}>{pendingDep}</span>}
              {id==='bookings' && pendingBk  > 0 && <span className="badge b-gold" style={{ fontSize:'.6rem', padding:'1px 5px', marginLeft:2 }}>{pendingBk}</span>}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            <div className="ov-grid">
              {[
                [drivers.length,              'Total Drivers',     'var(--gold)'],
                [drivers.filter(d=>d.status==='available').length, 'Available Now', 'var(--green)'],
                [bookings.filter(b=>b.status==='confirmed').length,'Active Rides',   'var(--blue)'],
                [pendingDep,                  'Pending Deposits',  'var(--red)'],
                [bookings.length,             'All Bookings',     'var(--gold)'],
                [bookings.filter(b=>b.status==='completed').length,'Completed',      'var(--green)'],
                [`₹${revenue.toLocaleString()}`,'Total Revenue',  'var(--gold)'],
                [users.length,                'Total Users',      'var(--purple)'],
              ].map(([v, l, c]) => (
                <div key={l} className="ov-card">
                  <div className="ov-v" style={{ color:c }}>{v}</div>
                  <div className="ov-l">{l}</div>
                </div>
              ))}
            </div>

            <div className="g2">
              {/* Recent bookings */}
              <div className="card">
                <h3 style={{ fontWeight:700, marginBottom:'1rem', fontSize:'.95rem' }}>🕐 Recent Bookings</h3>
                {bookings.slice(0,7).map(b => (
                  <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.52rem 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:'.82rem' }}>
                    <div style={{ minWidth:0, flex:1, marginRight:8 }}>
                      <span style={{ fontWeight:600 }}>{b.profiles?.full_name || '—'}</span>
                      <span style={{ color:'var(--tm)', marginLeft:6 }}>{b.pickup_address?.slice(0,20)}…</span>
                    </div>
                    <div style={{ display:'flex', gap:'.4rem', alignItems:'center', flexShrink:0 }}>
                      <span style={{ color:'var(--gold)', fontWeight:700 }}>₹{b.final_fare}</span>
                      <span className="badge" style={{ fontSize:'.6rem', background:'rgba(255,255,255,.04)', color:STATUS_COLOR[b.status]||'var(--tm)', border:`1px solid ${STATUS_COLOR[b.status]||'var(--tm)'}33` }}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Driver status bars */}
              <div className="card">
                <h3 style={{ fontWeight:700, marginBottom:'1.25rem', fontSize:'.95rem' }}>🚦 Fleet Status</h3>
                {[['available','var(--green)'],['busy','var(--gold)'],['offline','var(--tm)']].map(([s, c]) => {
                  const n = drivers.filter(d => d.status === s).length
                  const pct = drivers.length ? Math.round(n/drivers.length*100) : 0
                  return (
                    <div key={s} style={{ marginBottom:'.9rem' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.83rem', marginBottom:'.28rem' }}>
                        <span style={{ color:'var(--ts)', textTransform:'capitalize' }}>{s}</span>
                        <span style={{ color:c, fontWeight:700 }}>{n} driver{n!==1?'s':''}</span>
                      </div>
                      <div style={{ height:7, background:'rgba(255,255,255,.06)', borderRadius:99, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:99, transition:'width .5s var(--ease)' }}/>
                      </div>
                    </div>
                  )
                })}
                <div style={{ marginTop:'1.1rem', paddingTop:'1rem', borderTop:'1px solid var(--b1)' }}>
                  <div style={{ fontSize:'.82rem', color:'var(--ts)', fontWeight:700, marginBottom:'.6rem' }}>Active Discount Tiers</div>
                  {tiers.map(t => (
                    <div key={t.id} style={{ display:'flex', justifyContent:'space-between', padding:'.3rem 0', fontSize:'.79rem', color:'var(--tm)' }}>
                      <span>{t.label}</span>
                      <span style={{ color:'var(--gold)' }}>{t.discount_percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── DISCOUNTS ──────────────────────────────────────────────────── */}
        {tab === 'discounts' && (
          <div className="card">
            <h2 className="h3 mb3">Discount Tiers</h2>
            <div style={{ overflowX:'auto' }}>
              <table className="tbl" style={{ minWidth:580 }}>
                <thead><tr><th>Min (₹)</th><th>Max (₹)</th><th>Discount %</th><th>Label</th><th>Actions</th></tr></thead>
                <tbody>
                  {tiers.map(t => (
                    <tr key={t.id}>
                      {editTier?.id === t.id ? (
                        <>
                          <td><InlineInput value={editTier.min_amount} type="number" onChange={e=>setET(p=>({...p,min_amount:e.target.value}))}/></td>
                          <td><InlineInput value={editTier.max_amount||''} type="number" placeholder="∞" onChange={e=>setET(p=>({...p,max_amount:e.target.value}))}/></td>
                          <td><InlineInput value={editTier.discount_percent} type="number" onChange={e=>setET(p=>({...p,discount_percent:e.target.value}))}/></td>
                          <td><InlineInput value={editTier.label} width={165} placeholder="e.g. Gold — 15% off" onChange={e=>setET(p=>({...p,label:e.target.value}))}/></td>
                          <td><div className="ar"><button className="btn btn-primary btn-sm" onClick={saveTier} disabled={loading}><Check size={12}/></button><button className="btn btn-ghost btn-sm" onClick={()=>setET(null)}><X size={12}/></button></div></td>
                        </>
                      ) : (
                        <>
                          <td style={{ color:'var(--gold)', fontWeight:700 }}>₹{Number(t.min_amount).toLocaleString()}</td>
                          <td style={{ color:'var(--ts)' }}>{t.max_amount ? `₹${Number(t.max_amount).toLocaleString()}` : '∞'}</td>
                          <td><span className="badge b-gold">{t.discount_percent}%</span></td>
                          <td style={{ color:'var(--ts)', fontSize:'.85rem' }}>{t.label}</td>
                          <td><div className="ar"><button className="btn btn-ghost btn-sm" onClick={()=>setET({...t})}><Pencil size={12}/></button><button className="btn btn-danger btn-sm" onClick={()=>deleteTier(t.id)}><Trash2 size={12}/></button></div></td>
                        </>
                      )}
                    </tr>
                  ))}
                  {/* Add row */}
                  <tr style={{ background:'rgba(255,179,71,.03)' }}>
                    <td><InlineInput value={newTier.min_amount} type="number" placeholder="5000" onChange={e=>setNT(p=>({...p,min_amount:e.target.value}))}/></td>
                    <td><InlineInput value={newTier.max_amount} type="number" placeholder="9999" onChange={e=>setNT(p=>({...p,max_amount:e.target.value}))}/></td>
                    <td><InlineInput value={newTier.discount_percent} type="number" placeholder="10" onChange={e=>setNT(p=>({...p,discount_percent:e.target.value}))}/></td>
                    <td><InlineInput value={newTier.label} width={165} placeholder="Silver — 10% off" onChange={e=>setNT(p=>({...p,label:e.target.value}))}/></td>
                    <td><button className="btn btn-primary btn-sm" onClick={saveTier} disabled={loading}><Plus size={12}/> Add</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DEPOSITS ───────────────────────────────────────────────────── */}
        {tab === 'deposits' && (
          <div className="card">
            <h2 className="h3 mb3">Deposit Requests</h2>
            <div style={{ overflowX:'auto' }}>
              <table className="tbl" style={{ minWidth:680 }}>
                <thead><tr><th>User</th><th>Phone</th><th>Amount</th><th>Tier</th><th>Ref</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {deposits.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight:600 }}>{d.profiles?.full_name || '—'}</td>
                      <td style={{ color:'var(--ts)', fontSize:'.83rem' }}>{d.profiles?.phone || '—'}</td>
                      <td style={{ color:'var(--gold)', fontWeight:700 }}>₹{Number(d.amount).toLocaleString()}</td>
                      <td><span className="badge b-gold">{d.discount_applied || 0}%</span></td>
                      <td style={{ color:'var(--tm)', fontSize:'.79rem', fontFamily:'monospace' }}>{d.payment_ref || '—'}</td>
                      <td><span className={`badge ${d.status==='confirmed'?'b-green':d.status==='rejected'?'b-red':'b-gold'}`}>{d.status}</span></td>
                      <td style={{ color:'var(--tm)', fontSize:'.78rem' }}>{new Date(d.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</td>
                      <td>
                        {d.status === 'pending' && (
                          <div className="ar">
                            <button className="btn btn-primary btn-sm" onClick={() => approveDeposit(d)} disabled={loading}>
                              <CheckCircle size={12}/> Approve
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => rejectDeposit(d.id)}>
                              <XCircle size={12}/>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {deposits.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--tm)', padding:'2rem' }}>No deposits yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DRIVERS ────────────────────────────────────────────────────── */}
        {tab === 'drivers' && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h2 className="h3">Drivers</h2>
              <div style={{ display:'flex', gap:'.6rem' }}>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/driver-signup')}><Plus size={13}/> Add Regular</button>
                <button className="btn btn-danger btn-sm" onClick={() => navigate('/emergency-driver')}><AlertTriangle size={13}/> Emergency</button>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="tbl" style={{ minWidth:680 }}>
                <thead><tr><th>Name</th><th>Phone</th><th>Rating</th><th>Vehicle</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {drivers.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight:700 }}>
                        {d.name}
                        {d.is_emergency && <span className="badge b-red" style={{ marginLeft:6, fontSize:'.62rem' }}>EMG</span>}
                      </td>
                      <td style={{ color:'var(--ts)', fontSize:'.85rem' }}>{d.phone}</td>
                      <td>
                        <span style={{ color:'var(--gold)', fontWeight:700 }}>★ {Number(d.rating).toFixed(1)}</span>
                        <span style={{ color:'var(--tm)', fontSize:'.75rem', marginLeft:4 }}>({d.total_ratings})</span>
                      </td>
                      <td style={{ fontSize:'.85rem', color:'var(--ts)' }}>
                        {d.vehicle_model}
                        {d.vehicle_number && <><br/><span style={{ fontFamily:'monospace', fontSize:'.78rem', color:'var(--tm)' }}>{d.vehicle_number}</span></>}
                      </td>
                      <td>
                        <span className={`badge ${d.status==='available'?'b-green':d.status==='busy'?'b-gold':'b-red'}`}>{d.status}</span>
                      </td>
                      <td>
                        <div className="ar">
                          <select className="input" style={{ padding:'.32rem .5rem', fontSize:'.79rem', width:110 }}
                            value={d.status}
                            onChange={e => setDriverStatus(d.id, e.target.value)}>
                            <option value="available">Available</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                          </select>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteDriver(d.id)}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {drivers.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--tm)', padding:'2rem' }}>No drivers yet. <button className="btn btn-primary btn-sm" onClick={()=>navigate('/driver-signup')}>Add First Driver</button></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BOOKINGS ───────────────────────────────────────────────────── */}
        {tab === 'bookings' && (
          <div className="card">
            <h2 className="h3 mb3">All Bookings</h2>
            <div style={{ overflowX:'auto' }}>
              <table className="tbl" style={{ minWidth:780 }}>
                <thead><tr><th>Receipt</th><th>User</th><th>Pickup</th><th>Fare</th><th>Driver</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontFamily:'monospace', fontSize:'.78rem', color:'var(--ts)' }}>{b.receipt_number || '—'}</td>
                      <td style={{ fontWeight:600 }}>{b.profiles?.full_name || '—'}</td>
                      <td style={{ color:'var(--ts)', fontSize:'.83rem', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.pickup_address}</td>
                      <td style={{ color:'var(--gold)', fontWeight:700 }}>₹{b.final_fare}</td>
                      <td style={{ color:'var(--ts)', fontSize:'.85rem' }}>{b.drivers?.name || <span style={{ color:'var(--red)' }}>Unassigned</span>}</td>
                      <td><span className={`badge ${b.status==='confirmed'?'b-green':b.status==='completed'?'b-blue':b.status==='cancelled'?'b-red':'b-gold'}`}>{b.status}</span></td>
                      <td>
                        <div className="ar">
                          {b.status === 'confirmed' && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => updateBooking(b.id,'completed')}><CheckCircle size={11}/> Done</button>
                              <button className="btn btn-danger btn-sm"  onClick={() => updateBooking(b.id,'cancelled')}><XCircle size={11}/></button>
                            </>
                          )}
                          {b.status === 'pending' && (
                            <select className="input" style={{ padding:'.32rem .5rem', fontSize:'.79rem', width:135 }}
                              defaultValue=""
                              onChange={e => e.target.value && assignDriver(b.id, e.target.value)}>
                              <option value="">Assign driver…</option>
                              {drivers.filter(d => d.status==='available').map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--tm)', padding:'2rem' }}>No bookings yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ──────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="card">
            <h2 className="h3 mb3">All Users</h2>
            <div style={{ overflowX:'auto' }}>
              <table className="tbl" style={{ minWidth:600 }}>
                <thead><tr><th>Name</th><th>Phone</th><th>Balance</th><th>Discount</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight:600 }}>{u.full_name || '—'}</td>
                      <td style={{ color:'var(--ts)', fontSize:'.85rem' }}>{u.phone || '—'}</td>
                      <td style={{ color:'var(--gold)', fontWeight:700 }}>₹{Number(u.balance||0).toLocaleString()}</td>
                      <td><span className="badge b-gold">{u.discount_percent||0}%</span></td>
                      <td><span className={`badge ${u.role==='admin'?'b-red':'b-blue'}`}>{u.role}</span></td>
                      <td style={{ color:'var(--tm)', fontSize:'.78rem' }}>{new Date(u.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}</td>
                      <td>
                        <select className="input" style={{ padding:'.32rem .5rem', fontSize:'.79rem', width:100 }}
                          value={u.role || 'user'}
                          onChange={e => setUserRole(u.id, e.target.value)}>
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