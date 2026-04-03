import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { Car, MapPin, History, CreditCard, ChevronRight, Navigation, LayoutDashboard, User } from 'lucide-react'
import RatingPrompt from '../components/RatingPrompt'

const SC = { confirmed:'var(--green)', in_progress:'var(--gold)', completed:'var(--blue)', cancelled:'var(--red)' }

function BottomNav() {
  const location = useLocation()
  const at = p => location.pathname === p ? 'bn-item active' : 'bn-item'
  return (
    <div className="bottom-nav">
      <div className="bottom-nav-inner">
        <Link to="/dashboard" className={at('/dashboard')}><LayoutDashboard size={20}/> Home</Link>
        <Link to="/book"      className={at('/book')}>      <Car size={20}/> Book</Link>
        <Link to="/history"   className={at('/history')}>   <History size={20}/> Trips</Link>
        <Link to="/profile"   className={at('/profile')}>   <User size={20}/> Profile</Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [stats,   setStats]   = useState({ trips:0, savings:0, active:0, spent:0 })
  const [recent,  setRecent]  = useState([])
  const [loading, setLd]      = useState(true)
  const [drivers, setDrivers] = useState(0)
  const [unrated, setUnrated] = useState(null)
  const [unratedDriver, setUnratedDriver] = useState(null)

  useEffect(() => {
    if (!user) return
    // Check for completed unrated trips
    supabase.from('bookings').select('*').eq('user_id',user.id).eq('status','completed').is('user_rating',null).order('created_at',{ascending:false}).limit(1)
      .then(({data})=>{
        if (data?.[0]) {
          setUnrated(data[0])
          if (data[0].driver_id) supabase.from('drivers').select('*').eq('id',data[0].driver_id).maybeSingle().then(({data:d})=>setUnratedDriver(d))
        }
      })

    Promise.all([
      supabase.from('bookings')
        .select('id,discount_amount,status,pickup_address,created_at,final_fare,distance_km,user_rating')
        .eq('user_id', user.id).order('created_at',{ascending:false}).limit(5),
      supabase.from('drivers')
        .select('id',{count:'exact'})
        .eq('status','available').eq('is_approved',true),
    ]).then(([{data:bk},{count}]) => {
      setRecent(bk||[])
      setStats({
        trips:    bk?.length||0,
        savings:  bk?.reduce((s,b)=>s+(b.discount_amount||0),0)||0,
        active:   bk?.filter(b=>['confirmed','in_progress'].includes(b.status)).length||0,
        spent:    bk?.filter(b=>b.status==='completed').reduce((s,b)=>s+(b.final_fare||0),0)||0,
      })
      setDrivers(count||0)
      setLd(false)
    })
  }, [user, location.key])

  const h = new Date().getHours()
  const greeting = h<12 ? 'Good Morning' : h<17 ? 'Good Afternoon' : 'Good Evening'

  const tier = () => {
    const d = profile?.discount_percent||0
    if (d>=25) return { label:'💎 Diamond', color:'#a78bfa', next:null }
    if (d>=20) return { label:'🏆 Platinum', color:'#60a5fa', next:'💎 Diamond at ₹50k deposit' }
    if (d>=15) return { label:'🥇 Gold', color:'var(--gold)', next:'🏆 Platinum at ₹25k deposit' }
    if (d>=10) return { label:'🥈 Silver', color:'#94a3b8', next:'🥇 Gold at ₹10k deposit' }
    return { label:'🌱 Basic', color:'var(--ts)', next:'🥈 Silver — deposit ₹5,000' }
  }

  const t = tier()

  return (
    <div className="main" style={{ padding:'1.75rem 1.5rem', maxWidth:700, margin:'0 auto' }}>

      {/* Active booking alert */}
      {stats.active > 0 && (
        <div onClick={() => navigate('/book')}
          style={{ display:'flex', alignItems:'center', gap:'.85rem', padding:'1rem 1.25rem', background:'rgba(0,200,150,.08)', border:'1px solid rgba(0,200,150,.22)', borderRadius:'var(--r)', marginBottom:'1.25rem', cursor:'pointer', transition:'transform .15s' }}
          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
          onMouseLeave={e=>e.currentTarget.style.transform='none'}>
          <span className="dot"/>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:'.9rem', color:'var(--green)' }}>Ride in Progress</div>
            <div style={{ fontSize:'.78rem', color:'var(--ts)', marginTop:1 }}>Tap to track your driver</div>
          </div>
          <ChevronRight size={16} style={{ color:'var(--green)' }}/>
        </div>
      )}

      {/* Greeting */}
      <div style={{ marginBottom:'1.75rem' }}>
        <div style={{ fontSize:'.82rem', color:'var(--ts)', marginBottom:'.2rem' }}>{greeting},</div>
        <h1 className="h1">{profile?.full_name?.split(' ')[0] || 'Welcome'} 👋</h1>
        {drivers > 0
          ? <p style={{ color:'var(--green)', fontSize:'.83rem', marginTop:'.4rem', display:'flex', alignItems:'center', gap:5 }}>
              <span className="dot" style={{ width:7, height:7 }}/> {drivers} driver{drivers!==1?'s':''} available now
            </p>
          : <p style={{ color:'var(--ts)', fontSize:'.83rem', marginTop:'.4rem' }}>No drivers online right now</p>
        }
      </div>

      {/* Quick book CTA */}
      <div onClick={() => navigate('/book')}
        style={{ background:'linear-gradient(135deg,rgba(245,166,35,.12) 0%,rgba(255,107,43,.08) 100%)', border:'1px solid rgba(245,166,35,.22)', borderRadius:18, padding:'1.5rem', marginBottom:'1.25rem', cursor:'pointer', transition:'all .2s', position:'relative', overflow:'hidden' }}
        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 12px 40px rgba(245,166,35,.15)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
        <div style={{ position:'absolute', right:-20, top:-20, width:140, height:140, background:'radial-gradient(circle,rgba(245,166,35,.08) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>
        <div style={{ fontSize:'.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--gold)', marginBottom:'.5rem' }}>Drop: IIT Hyderabad</div>
        <div style={{ display:'flex', alignItems:'center', gap:'.85rem' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'var(--fd)', fontSize:'1.3rem', fontWeight:700 }}>Where are you?</div>
            <div style={{ color:'var(--ts)', fontSize:'.83rem', marginTop:.25+'rem' }}>Tap to enter pickup and book</div>
          </div>
          <div style={{ width:48, height:48, background:'linear-gradient(135deg,var(--gold),var(--orange))', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', flexShrink:0 }}>
            🚖
          </div>
        </div>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="g2-mob" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.85rem', marginBottom:'1.25rem' }}>
          {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height:82, borderRadius:'var(--r)' }}/>)}
        </div>
      ) : (
        <div className="g2-mob" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.85rem', marginBottom:'1.25rem' }}>
          {[
            ['₹'+stats.spent.toLocaleString(), 'Total Spent',    'var(--gold)'],
            [stats.trips,                       'Total Trips',    'var(--green)'],
            ['₹'+stats.savings.toLocaleString(),'Total Saved',   'var(--blue)'],
            [(profile?.discount_percent||0)+'%', 'Concession',   'var(--purple)'],
          ].map(([v,l,c]) => (
            <div key={l} className="stat-card fu">
              <div className="stat-v" style={{ color:c }}>{v}</div>
              <div className="stat-l">{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tier + deposit */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.85rem', marginBottom:'1.25rem' }}>
        {/* Tier card */}
        <div className="card fu d1" style={{ padding:'1.1rem' }}>
          <div style={{ fontSize:'.72rem', color:'var(--ts)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'.5rem' }}>Your Tier</div>
          <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:'1.05rem', color:t.color }}>{t.label}</div>
          {t.next && <div style={{ fontSize:'.72rem', color:'var(--tm)', marginTop:'.35rem', lineHeight:1.45 }}>Next: {t.next}</div>}
        </div>

        {/* Wallet card */}
        <div className="card fu d2" style={{ padding:'1.1rem', cursor:'pointer' }} onClick={()=>navigate('/deposit')}>
          <div style={{ fontSize:'.72rem', color:'var(--ts)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'.5rem' }}>Wallet</div>
          <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'1.1rem', color:'var(--gold)' }}>
            ₹{Number(profile?.balance||0).toLocaleString()}
          </div>
          <div style={{ fontSize:'.72rem', color:'var(--ts)', marginTop:'.35rem', display:'flex', alignItems:'center', gap:4 }}>
            <CreditCard size={11}/> Tap to deposit
          </div>
        </div>
      </div>

      {/* Recent trips */}
      <div className="card fu d3">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h3 className="h3">Recent Trips</h3>
          <Link to="/history" style={{ fontSize:'.8rem', color:'var(--gold)', fontWeight:600 }}>See all →</Link>
        </div>

        {loading && [1,2,3].map(i => (
          <div key={i} className="skel" style={{ height:60, marginBottom:'.65rem', borderRadius:'var(--rs)' }}/>
        ))}

        {!loading && recent.length === 0 && (
          <div style={{ textAlign:'center', padding:'2rem 1rem', color:'var(--tm)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>🚖</div>
            <div style={{ fontWeight:600, marginBottom:'.4rem' }}>No trips yet</div>
            <p style={{ fontSize:'.83rem', lineHeight:1.6 }}>Book your first cab to IIT Hyderabad</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop:'1rem' }} onClick={()=>navigate('/book')}>
              Book Now
            </button>
          </div>
        )}

        {!loading && recent.map((b, i) => (
          <div key={b.id} className="fu" style={{ animationDelay:`${i*.05}s`, display:'flex', alignItems:'center', gap:'.85rem', padding:'.75rem 0', borderBottom: i<recent.length-1?'1px solid var(--b1)':'none' }}>
            <div style={{ width:38, height:38, borderRadius:10, background: b.status==='completed'?'rgba(0,200,150,.1)':b.status==='cancelled'?'rgba(255,71,87,.1)':'rgba(245,166,35,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'1.1rem' }}>
              {b.status==='completed'?'✅':b.status==='cancelled'?'❌':'🔄'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:'.88rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {b.pickup_address?.split(',')[0] || 'Pickup'}
              </div>
              <div style={{ fontSize:'.74rem', color:'var(--tm)', marginTop:1 }}>
                {new Date(b.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                {b.distance_km ? ` · ${b.distance_km} km` : ''}
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontWeight:700, color:'var(--gold)', fontSize:'.9rem' }}>₹{b.final_fare}</div>
              <span className="badge" style={{ fontSize:'.6rem', background:`${SC[b.status]||'var(--tm)'}18`, color:SC[b.status]||'var(--tm)', border:`1px solid ${SC[b.status]||'var(--tm)'}33` }}>
                {b.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {unrated && <RatingPrompt booking={unrated} driver={unratedDriver} onDone={()=>setUnrated(null)}/>}
      <BottomNav/>
    </div>
  )
}
