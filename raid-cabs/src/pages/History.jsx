import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Phone, Download, Star } from 'lucide-react'
import Receipt from '../components/Receipt'
import RatingModal from '../components/RatingModal'

const SC = { confirmed:'var(--green)', in_progress:'var(--gold)', completed:'var(--blue)', cancelled:'var(--red)', pending:'var(--tm)' }
const SE = { confirmed:'🟢', in_progress:'🚗', completed:'✅', cancelled:'❌', pending:'⏳' }

export default function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBk] = useState([])
  const [loading, setLd]  = useState(true)
  const [filter, setFl]   = useState('all')
  const [sel, setSel]     = useState(null)
  const [receipt, setRec] = useState(null)
  const [rateTarget, setRate] = useState(null)

  const load = async () => {
    if(!user) return
    const {data} = await supabase.from('bookings')
      .select('*,drivers(name,phone,rating,vehicle_model,vehicle_number)')
      .eq('user_id', user.id)
      .order('created_at',{ascending:false})
    setBk(data||[]); setLd(false)
  }

  useEffect(()=>{ load() },[user])

  const filtered = filter==='all' ? bookings : bookings.filter(b=>b.status===filter)
  const totalSpent = bookings.filter(b=>b.status==='completed').reduce((s,b)=>s+(b.final_fare||0),0)
  const totalSaved = bookings.reduce((s,b)=>s+(b.discount_amount||0),0)
  const avgRating  = () => { const r=bookings.filter(b=>b.user_rating); return r.length ? (r.reduce((s,b)=>s+b.user_rating,0)/r.length).toFixed(1) : '—' }

  return (
    <div className="main page-pad">
      <style>{`
        .tr-row{display:flex;align-items:center;gap:.9rem;padding:.95rem 1.1rem;border-radius:var(--rs);cursor:pointer;transition:background var(--t);border:1px solid transparent;}
        .tr-row:hover{background:rgba(255,255,255,.04);border-color:var(--border);}
        .tr-row.sel{background:rgba(255,179,71,.05);border-color:var(--border2);}
      `}</style>

      <div style={{ maxWidth:1000,margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb2" onClick={()=>navigate('/dashboard')}><ArrowLeft size={15}/> Back</button>

        <div className="mb3">
          <h1 className="h1">🗂 My Trips</h1>
          <p style={{ color:'var(--ts)',marginTop:'.3rem' }}>Your complete ride history</p>
        </div>

        {/* Summary stats */}
        <div className="g4 mb3">
          {[
            [bookings.length,'Total Trips','var(--gold)'],
            [bookings.filter(b=>b.status==='completed').length,'Completed','var(--green)'],
            [`₹${totalSpent.toLocaleString()}`,'Total Spent','var(--gold)'],
            [`₹${totalSaved.toLocaleString()}`,'Total Saved','var(--green)'],
          ].map(([v,l,c])=>(
            <div key={l} className="card2" style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--fd)',fontSize:'1.55rem',fontWeight:700,color:c }}>{v}</div>
              <div style={{ fontSize:'.72rem',color:'var(--tm)',textTransform:'uppercase',letterSpacing:'.07em',marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="tabs mb3">
          {['all','confirmed','in_progress','completed','cancelled'].map(f=>(
            <button key={f} className={`tab ${filter===f?'on':''}`} onClick={()=>setFl(f)}>
              {f==='all'?'All':f.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
              <span style={{ marginLeft:3,fontSize:'.7rem',opacity:.65 }}>
                ({f==='all'?bookings.length:bookings.filter(b=>b.status===f).length})
              </span>
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:sel?'1fr 360px':'1fr', gap:'1.5rem' }}>
          {/* List */}
          <div className="card" style={{ padding:'.4rem .2rem' }}>
            {loading&&[1,2,3,4].map(i=><div key={i} className="skel" style={{ height:70,margin:'.5rem 1rem',borderRadius:'var(--rs)' }}/>)}

            {!loading&&filtered.length===0&&(
              <div style={{ textAlign:'center',padding:'3.5rem 2rem',color:'var(--tm)' }}>
                <div style={{ fontSize:'3rem',marginBottom:'1rem' }}>🚖</div>
                <p>{filter==='all'?'No trips yet — book your first cab!':` No ${filter.replace('_',' ')} trips.`}</p>
                {filter==='all'&&<button className="btn btn-primary mt3" onClick={()=>navigate('/book')}>Book Now</button>}
              </div>
            )}

            {!loading&&filtered.map(b=>(
              <div key={b.id} className={`tr-row ${sel?.id===b.id?'sel':''}`} onClick={()=>setSel(s=>s?.id===b.id?null:b)}>
                <div style={{ fontSize:'1.3rem',flexShrink:0 }}>{SE[b.status]||'📋'}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:'.88rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{b.pickup_address}</div>
                  <div style={{ fontSize:'.75rem',color:'var(--tm)',marginTop:1 }}>
                    → {b.drop_address} · {b.distance_km}km
                    {b.receipt_number&&<span style={{ marginLeft:6,color:'var(--ts)' }}>#{b.receipt_number}</span>}
                  </div>
                  <div style={{ fontSize:'.73rem',color:'var(--tm)',marginTop:1 }}>
                    {new Date(b.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
                <div style={{ textAlign:'right',flexShrink:0 }}>
                  <div style={{ fontWeight:800,color:'var(--gold)',fontSize:'.93rem' }}>₹{b.final_fare}</div>
                  {b.discount_amount>0&&<div style={{ fontSize:'.7rem',color:'var(--green)' }}>−₹{b.discount_amount}</div>}
                  {b.user_rating&&<div style={{ fontSize:'.75rem',color:'var(--gold)',marginTop:1 }}>{'★'.repeat(b.user_rating)}</div>}
                  <span className="badge mt1" style={{ fontSize:'.63rem',background:`rgba(255,255,255,.05)`,color:SC[b.status]||'var(--tm)',border:`1px solid ${SC[b.status]||'var(--tm)'}44` }}>
                    {b.status?.replace('_',' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {sel&&(
            <div className="card" style={{ alignSelf:'start',animation:'scaleIn .2s var(--ease)' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.1rem' }}>
                <h3 style={{ fontWeight:700,fontSize:'.97rem' }}>Trip Details</h3>
                <button className="btn btn-ghost btn-sm" onClick={()=>setSel(null)}>✕</button>
              </div>

              {[
                ['Pickup',sel.pickup_address],
                ['Drop',sel.drop_address],
                ['Distance',`${sel.distance_km} km`],
                ['Base Fare',`₹${sel.base_fare}`],
                sel.discount_amount>0&&['Discount',`−₹${sel.discount_amount}`],
                ['Total Paid',`₹${sel.final_fare}`],
                sel.eta_pickup&&['Driver ETA',sel.eta_pickup],
                sel.eta_drop&&['Trip Duration',sel.eta_drop],
                ['Status',sel.status?.replace('_',' ')],
                sel.receipt_number&&['Receipt No.',sel.receipt_number],
                ['Date',new Date(sel.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})],
              ].filter(Boolean).map(([l,v])=>(
                <div key={l} className="fare-r">
                  <span style={{ color:'var(--tm)' }}>{l}</span>
                  <span style={{ fontWeight:600,textAlign:'right',maxWidth:'62%',color:l==='Total Paid'?'var(--gold)':l==='Discount'?'var(--green)':'var(--tp)',fontSize:'.85rem' }}>{v}</span>
                </div>
              ))}

              {sel.drivers&&(
                <div style={{ marginTop:'.9rem',padding:'.9rem',background:'rgba(255,255,255,.025)',borderRadius:'var(--rs)',border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'.71rem',color:'var(--tm)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:'.5rem' }}>Driver</div>
                  <div style={{ fontWeight:700 }}>{sel.drivers.name}</div>
                  <div style={{ fontSize:'.78rem',color:'var(--ts)',marginTop:2 }}>{sel.drivers.vehicle_model} · {sel.drivers.vehicle_number}</div>
                  {sel.user_rating
                    ? <div style={{ fontSize:'.8rem',color:'var(--gold)',marginTop:5 }}>Your rating: {'★'.repeat(sel.user_rating)}{'☆'.repeat(5-sel.user_rating)}</div>
                    : sel.status==='completed'&&<button className="btn btn-outline btn-sm mt2" onClick={()=>setRate({...sel,driver_name:sel.drivers.name})}><Star size={12}/> Rate Driver</button>
                  }
                  {sel.drivers.phone&&<a href={`tel:${sel.drivers.phone}`} className="btn btn-ghost btn-sm mt1 w100"><Phone size={12}/> Call Driver</a>}
                </div>
              )}

              <div style={{ display:'flex',gap:'.6rem',marginTop:'1rem' }}>
                <button className="btn btn-outline btn-sm" style={{ flex:1 }} onClick={()=>setRec(sel)}>
                  <Download size={12}/> Receipt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {receipt&&<Receipt booking={receipt} driver={receipt.drivers} onClose={()=>setRec(null)}/>}
      {rateTarget&&<RatingModal booking={rateTarget} onClose={()=>setRate(null)} onDone={r=>{ setBk(bks=>bks.map(b=>b.id===rateTarget.id?{...b,user_rating:r}:b)); setRate(null); setSel(s=>s?.id===rateTarget.id?{...s,user_rating:r}:s) }}/>}
    </div>
  )
}
