import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { CreditCard, Navigation, Clock, Zap, TrendingUp, MapPin, History, ChevronRight, Car, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

const SC={confirmed:'var(--green)',in_progress:'var(--gold)',completed:'var(--blue)',cancelled:'var(--red)'}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [stats, setStats]   = useState({ trips:0, savings:0, active:0, spent:0 })
  const [recent, setRecent] = useState([])
  const [loading, setLd]    = useState(true)
  const [drivers, setDrivers] = useState(0)

  useEffect(()=>{
    if(!user) return
    Promise.all([
      supabase.from('bookings').select('id,discount_amount,status,pickup_address,created_at,final_fare,distance_km,user_rating').eq('user_id',user.id).order('created_at',{ascending:false}).limit(5),
      supabase.from('drivers').select('id',{count:'exact'}).eq('status','available'),
    ]).then(([{data:bk},{count}])=>{
      setRecent(bk||[])
      setStats({
        trips:bk?.length||0,
        savings:bk?.reduce((s,b)=>s+(b.discount_amount||0),0)||0,
        active:bk?.filter(b=>['confirmed','in_progress'].includes(b.status)).length||0,
        spent:bk?.filter(b=>b.status==='completed').reduce((s,b)=>s+(b.final_fare||0),0)||0,
      })
      setDrivers(count||0)
      setLd(false)
    })
  },[user, location.key])

  const h=new Date().getHours()
  const greeting=h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'

  const tier=()=>{
    const d=profile?.discount_percent||0
    if(d>=25) return {label:'💎 Diamond',color:'#a29bfe',next:null}
    if(d>=20) return {label:'🏆 Platinum',color:'#74b9ff',next:'💎 Diamond at ₹50k'}
    if(d>=15) return {label:'🥇 Gold',color:'var(--gold)',next:'🏆 Platinum at ₹25k'}
    if(d>=10) return {label:'🥈 Silver',color:'#b2bec3',next:'🥇 Gold at ₹10k'}
    return {label:'🌱 Basic',color:'var(--ts)',next:'🥈 Silver — deposit ₹5k'}
  }
  const t=tier()

  return (
    <div className="main" style={{ padding:'2.5rem 2rem' }}>
      <style>{`
        .ac-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.75rem;max-width:820px;margin:0 auto 2.5rem;}
        .ac{background:var(--card);border:1px solid var(--border);border-radius:22px;padding:2.1rem 1.85rem;cursor:pointer;text-align:center;transition:all .32s var(--ease);position:relative;overflow:hidden;}
        .ac::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .32s;border-radius:22px;}
        .ac.dep::before{background:radial-gradient(ellipse at center,rgba(255,179,71,.1) 0%,transparent 68%);}
        .ac.bk::before{background:radial-gradient(ellipse at center,rgba(46,204,113,.1) 0%,transparent 68%);}
        .ac:hover::before{opacity:1;}
        .ac:hover{transform:translateY(-8px);box-shadow:0 24px 60px rgba(0,0,0,.5);}
        .ac.dep:hover{border-color:rgba(255,179,71,.5);}
        .ac.bk:hover{border-color:rgba(46,204,113,.5);}
        .aic2{width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;}
        .aic2.d{background:rgba(255,179,71,.12);border:2px solid rgba(255,179,71,.3);color:var(--gold);}
        .aic2.b{background:rgba(46,204,113,.12);border:2px solid rgba(46,204,113,.3);color:var(--green);}
        .sbar{display:flex;justify-content:center;gap:1rem;margin:0 auto 2.1rem;flex-wrap:wrap;max-width:820px;}
        .sp{text-align:center;padding:1.1rem 1.5rem;background:var(--card);border:1px solid var(--border);border-radius:var(--r);flex:1;min-width:115px;transition:var(--t);}
        .sp:hover{border-color:var(--border2);}
        .sv{font-family:var(--fd);font-size:1.7rem;font-weight:700;background:linear-gradient(135deg,var(--gold),var(--orange));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .sl{font-size:.71rem;color:var(--tm);text-transform:uppercase;letter-spacing:.08em;margin-top:.25rem;}
        .r-row{display:flex;align-items:center;gap:.88rem;padding:.82rem 1rem;border-radius:var(--rs);transition:background var(--t);cursor:pointer;}
        .r-row:hover{background:rgba(255,255,255,.035);}
        @media(max-width:600px){.ac-grid{grid-template-columns:1fr;}.sbar{gap:.7rem;}}
      `}</style>

      {/* Hero */}
      <div style={{ textAlign:'center',marginBottom:'2rem',animation:'fadeUp .5s ease' }}>
        <p style={{ fontSize:'.8rem',color:'var(--ts)',textTransform:'uppercase',letterSpacing:'.13em',marginBottom:'.5rem' }}>{greeting} ☀️</p>
        <h1 style={{ fontFamily:'var(--fd)',fontSize:'2.6rem',fontWeight:900,lineHeight:1.1 }}>
          {profile?.full_name?.split(' ')[0]||'Traveller'} <span className="gold">✦</span>
        </h1>
        <p style={{ color:'var(--ts)',marginTop:'.5rem',fontSize:'.95rem' }}>Our Wheels Take You to Fly</p>
        {stats.active>0&&(
          <button onClick={()=>navigate('/book')}
            style={{ display:'inline-flex',alignItems:'center',gap:7,marginTop:'.8rem',background:'rgba(46,204,113,.1)',border:'1px solid rgba(46,204,113,.3)',borderRadius:99,padding:'.38rem 1rem',fontSize:'.82rem',color:'var(--green)',cursor:'pointer',fontFamily:'var(--fb)',fontWeight:700 }}>
            <span className="dot" style={{ width:7,height:7 }}/>{stats.active} active booking — Track →
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="sbar">
        {[[stats.trips,'Total Trips'],[`₹${stats.savings.toLocaleString()}`,'Saved'],[`${profile?.discount_percent||0}%`,'Discount'],[`₹${(profile?.balance||0).toLocaleString()}`,'Wallet']].map(([v,l])=>(
          <div key={l} className="sp"><div className="sv">{v}</div><div className="sl">{l}</div></div>
        ))}
      </div>

      {/* Tier */}
      <div style={{ maxWidth:820,margin:'0 auto 2rem',background:'linear-gradient(135deg,rgba(255,179,71,.09),rgba(255,107,53,.06))',border:'1px solid var(--border2)',borderRadius:'var(--r)',padding:'.95rem 1.4rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'var(--fd)',fontSize:'1rem',fontWeight:700,color:t.color }}>{t.label} Member</div>
          <div style={{ color:'var(--ts)',fontSize:'.8rem',marginTop:2 }}>
            {profile?.discount_percent>0?<><strong style={{ color:t.color }}>{profile.discount_percent}%</strong> off every ride · </>:''}{t.next&&<span style={{ color:'var(--tm)' }}>Next: {t.next}</span>}
          </div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:'.75rem',flexWrap:'wrap' }}>
          {drivers>0&&<span style={{ fontSize:'.8rem',color:'var(--green)',display:'flex',alignItems:'center',gap:5 }}><span className="dot" style={{ width:7,height:7 }}/>{drivers} drivers online</span>}
          <TrendingUp size={22} style={{ color:t.color,opacity:.8 }}/>
        </div>
      </div>

      {/* Action cards */}
      <div className="ac-grid">
        <div className="ac dep fu d1" onClick={()=>navigate('/deposit')}>
          <div className="aic2 d"><CreditCard size={30}/></div>
          <h2 style={{ fontFamily:'var(--fd)',fontSize:'1.28rem',fontWeight:700,marginBottom:'.6rem' }}>Deposit Money</h2>
          <p style={{ color:'var(--ts)',fontSize:'.84rem',lineHeight:1.65,marginBottom:'1.25rem' }}>Top-up ₹5,000+ and unlock ride discounts. Higher deposits = bigger savings on every trip.</p>
          <span className="badge b-gold mb2">💰 Min ₹5,000 · Up to 25% Off</span><br/>
          <button className="btn btn-primary btn-blk mt2" onClick={e=>{e.stopPropagation();navigate('/deposit')}}>Deposit & Save →</button>
          <p style={{ fontSize:'.72rem',color:'var(--tm)',marginTop:'.6rem',display:'flex',alignItems:'center',justifyContent:'center',gap:4 }}><Zap size={10}/> Instant UPI / QR</p>
        </div>

        <div className="ac bk fu d2" onClick={()=>navigate('/book')}>
          <div className="aic2 b"><Navigation size={30}/></div>
          <h2 style={{ fontFamily:'var(--fd)',fontSize:'1.28rem',fontWeight:700,marginBottom:'.6rem' }}>Book a Cab</h2>
          <p style={{ color:'var(--ts)',fontSize:'.84rem',lineHeight:1.65,marginBottom:'1.25rem' }}>Live driver tracking, ETA countdown, and address autocomplete.</p>
          <span className="badge b-green mb2">🚖 Places Search · Live GPS</span><br/>
          <button className="btn btn-green btn-blk mt2" onClick={e=>{e.stopPropagation();navigate('/book')}}>Book Now →</button>
          <p style={{ fontSize:'.72rem',color:'var(--tm)',marginTop:'.6rem',display:'flex',alignItems:'center',justifyContent:'center',gap:4 }}><Clock size={10}/> Avg. pickup: 8 mins</p>
        </div>
      </div>

      {/* Recent trips */}
      <div style={{ maxWidth:820,margin:'0 auto' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem' }}>
          <h3 style={{ fontFamily:'var(--fd)',fontSize:'1.12rem',fontWeight:700 }}>Recent Trips</h3>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/history')}><History size={13}/> All Trips</button>
        </div>
        {loading&&(
          <div className="card">{[1,2,3].map(i=><div key={i} className="skel" style={{ height:56,margin:i>1?'.75rem 0 0':0,borderRadius:'var(--rs)' }}/>)}</div>
        )}
        {!loading&&recent.length===0&&(
          <div className="card" style={{ textAlign:'center',padding:'2.5rem' }}>
            <div style={{ fontSize:'2.5rem',marginBottom:'.7rem' }}>🚖</div>
            <p style={{ color:'var(--tm)',fontSize:'.9rem' }}>No trips yet — book your first ride!</p>
            <button className="btn btn-primary mt3" onClick={()=>navigate('/book')}>Book Now</button>
          </div>
        )}
        {!loading&&recent.length>0&&(
          <div className="card" style={{ padding:'.4rem .2rem' }}>
            {recent.map(b=>(
              <div key={b.id} className="r-row" onClick={()=>navigate('/history')}>
                <div style={{ fontSize:'1.25rem',flexShrink:0 }}>{b.status==='completed'?'✅':b.status==='confirmed'?'🟢':b.status==='cancelled'?'❌':'🔄'}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:700,fontSize:'.86rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{b.pickup_address}</div>
                  <div style={{ fontSize:'.72rem',color:'var(--tm)',marginTop:1 }}>
                    {b.distance_km}km · {new Date(b.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    {b.user_rating&&<span style={{ color:'var(--gold)',marginLeft:6 }}>{'★'.repeat(b.user_rating)}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right',flexShrink:0 }}>
                  <div style={{ fontWeight:800,color:'var(--gold)',fontSize:'.9rem' }}>₹{b.final_fare}</div>
                  <span className="badge mt1" style={{ fontSize:'.62rem',background:'rgba(255,255,255,.04)',color:SC[b.status]||'var(--tm)',border:`1px solid ${SC[b.status]||'var(--tm)'}44` }}>{b.status?.replace('_',' ')}</span>
                </div>
                <ChevronRight size={13} style={{ color:'var(--tm)',flexShrink:0 }}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
