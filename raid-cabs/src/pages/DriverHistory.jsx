import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDriver } from '../contexts/DriverContext'
import { supabase, q } from '../lib/supabase'
import { ArrowLeft } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const SC = { completed:'var(--green)', cancelled:'var(--red)', in_progress:'var(--gold)', confirmed:'var(--blue)' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--card2)', border:'1px solid var(--b1)', borderRadius:10, padding:'.65rem .9rem', fontSize:'.82rem' }}>
      <div style={{ color:'var(--ts)', marginBottom:3 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, fontWeight:700 }}>₹{p.value?.toLocaleString()}</div>
      ))}
    </div>
  )
}

export default function DriverHistory() {
  const { driver } = useDriver()
  const navigate   = useNavigate()
  const [trips,    setTrips]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [period,   setPeriod]   = useState('week') // week | month
  const [stats,    setStats]    = useState({ total:0, earnings:0, avgRating:0, cancelled:0 })
  const [chartData,setChart]    = useState([])

  useEffect(() => {
    if (!driver) return
    q(() => supabase.from('bookings')
      .select('id,receipt_number,pickup_address,drop_address,final_fare,distance_km,status,user_rating,user_review,created_at,completed_at')
      .eq('driver_id', driver.id)
      .order('created_at',{ascending:false})
      .limit(60)
    ).then(({ data }) => {
      const all = data || []
      setTrips(all)

      const done    = all.filter(t=>t.status==='completed')
      const rated   = done.filter(t=>t.user_rating)
      setStats({
        total:    done.length,
        earnings: done.reduce((s,t)=>s+(t.final_fare||0),0),
        avgRating:rated.length ? (rated.reduce((s,t)=>s+t.user_rating,0)/rated.length).toFixed(1) : '—',
        cancelled:all.filter(t=>t.status==='cancelled').length,
      })

      // Build chart data (last 7 days or 4 weeks)
      const now = new Date()
      if (period === 'week') {
        const days = Array.from({length:7},(_,i)=>{
          const d = new Date(now); d.setDate(d.getDate()-6+i)
          const key = d.toISOString().slice(0,10)
          const label = d.toLocaleDateString('en-IN',{weekday:'short'})
          const dayTrips = done.filter(t=>t.created_at?.slice(0,10)===key)
          return { label, earnings: dayTrips.reduce((s,t)=>s+(t.final_fare||0),0), trips: dayTrips.length }
        })
        setChart(days)
      } else {
        const weeks = Array.from({length:4},(_,i)=>{
          const wStart = new Date(now); wStart.setDate(wStart.getDate()-27+(i*7))
          const wEnd   = new Date(wStart); wEnd.setDate(wEnd.getDate()+6)
          const label  = `W${i+1}`
          const wTrips = done.filter(t=>{
            const d=new Date(t.created_at); return d>=wStart&&d<=wEnd
          })
          return { label, earnings:wTrips.reduce((s,t)=>s+(t.final_fare||0),0), trips:wTrips.length }
        })
        setChart(weeks)
      }
      setLoading(false)
    })
  }, [driver, period])

  return (
    <div style={{ minHeight:'100vh', background:'#05050e', fontFamily:"'Nunito',sans-serif", color:'#ede8d8' }}>
      <style>{`
        .dhi-nav{height:58px;background:rgba(5,5,14,.92);border-bottom:1px solid rgba(46,204,113,.15);display:flex;align-items:center;padding:0 1.5rem;position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);gap:1rem;}
        .dhi-card{background:#0e0e20;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:1.25rem;}
        .skel{background:linear-gradient(90deg,#0e0e20 25%,#161628 50%,#0e0e20 75%);background-size:400% 100%;animation:sh 1.4s ease infinite;border-radius:10px;}
        @keyframes sh{0%{background-position:100% 0}100%{background-position:-100% 0}}
        .p-btn{padding:.45rem 1rem;border:1px solid rgba(255,255,255,.1);border-radius:99px;background:transparent;color:#504c74;font-family:'Nunito',sans-serif;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .18s;}
        .p-btn.on{background:rgba(46,204,113,.12);border-color:rgba(46,204,113,.3);color:#2ecc71;}
        .recharts-tooltip-cursor{fill:rgba(255,255,255,.03)!important;}
      `}</style>

      <nav className="dhi-nav">
        <button onClick={()=>navigate('/driver/home')} style={{background:'transparent',border:'none',cursor:'pointer',color:'#504c74',display:'flex',padding:0}}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:'1.1rem'}}>Earnings & History</div>
      </nav>

      <div style={{maxWidth:560,margin:'0 auto',padding:'1.5rem 1.25rem'}}>

        {/* Summary stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'.85rem',marginBottom:'1.25rem'}}>
          {[
            [`₹${Number(stats.earnings).toLocaleString()}`, 'Total Earned',   '#ffb347'],
            [stats.total,                                    'Completed Trips', '#2ecc71'],
            [`${stats.avgRating}★`,                         'Avg Rating',      '#ffb347'],
            [stats.cancelled,                               'Cancelled',        '#e74c3c'],
          ].map(([v,l,c])=>(
            <div key={l} className="dhi-card" style={{textAlign:'center'}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:'1.5rem',fontWeight:700,color:c}}>{v}</div>
              <div style={{fontSize:'.69rem',color:'#504c74',textTransform:'uppercase',letterSpacing:'.07em',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Earnings chart */}
        <div className="dhi-card" style={{marginBottom:'1.25rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.1rem'}}>
            <div style={{fontWeight:700,fontSize:'.95rem'}}>Earnings</div>
            <div style={{display:'flex',gap:'.4rem'}}>
              <button className={`p-btn ${period==='week'?'on':''}`} onClick={()=>setPeriod('week')}>7 Days</button>
              <button className={`p-btn ${period==='month'?'on':''}`} onClick={()=>setPeriod('month')}>4 Weeks</button>
            </div>
          </div>
          {loading ? <div className="skel" style={{height:180}}/> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{top:5,right:5,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false}/>
                <XAxis dataKey="label" tick={{fill:'#504c74',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#504c74',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${v}`}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="earnings" fill="#ffb347" radius={[6,6,0,0]} maxBarSize={36}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trip list */}
        <div className="dhi-card" style={{padding:'.5rem .25rem'}}>
          <div style={{fontWeight:700,fontSize:'.95rem',padding:'.5rem 1rem .75rem'}}>Trip History</div>

          {loading && [1,2,3,4].map(i=><div key={`sk-${i}`} className="skel" style={{height:68,margin:'.5rem .75rem',borderRadius:10}}/>)}
          {!loading && trips.length===0 && (
            <div style={{textAlign:'center',padding:'3rem 1.5rem',color:'#504c74'}}>
              <div style={{fontSize:'2.5rem',marginBottom:'.75rem'}}>🚗</div>
              <p>No trips yet</p>
            </div>
          )}

          {!loading && trips.map((t,i)=>(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:'.85rem',padding:'.85rem 1rem',borderBottom:i<trips.length-1?'1px solid rgba(255,255,255,.04)':'none'}}>
              <div style={{fontSize:'1.2rem',flexShrink:0}}>{t.status==='completed'?'✅':t.status==='cancelled'?'❌':'🔄'}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:'.87rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{t.pickup_address?.split(',')[0]||'Pickup'}</div>
                <div style={{fontSize:'.73rem',color:'#504c74',marginTop:1}}>
                  {t.distance_km}km · {new Date(t.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                </div>
                {t.user_rating&&<div style={{fontSize:'.72rem',color:'#ffb347',marginTop:1}}>{'★'.repeat(t.user_rating)}{'☆'.repeat(5-t.user_rating)}{t.user_review&&<span style={{color:'#504c74',marginLeft:4}}>{t.user_review}</span>}</div>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontWeight:800,color:'#ffb347',fontSize:'.9rem'}}>₹{t.final_fare}</div>
                <span style={{display:'inline-block',marginTop:3,padding:'.18rem .5rem',borderRadius:99,fontSize:'.62rem',fontWeight:800,textTransform:'uppercase',letterSpacing:'.06em',background:`${SC[t.status]||'#504c74'}18`,color:SC[t.status]||'#504c74',border:`1px solid ${SC[t.status]||'#504c74'}33`}}>{t.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
