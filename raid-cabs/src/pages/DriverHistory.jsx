import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDriver } from '../contexts/DriverContext'
import { supabase, q } from '../lib/supabase'
import { ArrowLeft, MapPin } from 'lucide-react'

const SC = { completed:'#2ecc71', cancelled:'#e74c3c', in_progress:'#ffb347', confirmed:'#3498db' }

export default function DriverHistory() {
  const { driver } = useDriver()
  const navigate   = useNavigate()
  const [trips,   setTrips]   = useState([])
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState({ total: 0, earnings: 0, avgRating: 0 })

  useEffect(() => {
    if (!driver) return
    q(() => supabase.from('bookings')
      .select('id,receipt_number,pickup_address,drop_address,final_fare,distance_km,status,user_rating,user_review,created_at,completed_at')
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false })
      .limit(50)
    ).then(({ data }) => {
      const trips = data || []
      setTrips(trips)
      const done    = trips.filter(t => t.status === 'completed')
      const rated   = done.filter(t => t.user_rating)
      setStats({
        total:     done.length,
        earnings:  done.reduce((s, t) => s + (t.final_fare || 0), 0),
        avgRating: rated.length ? (rated.reduce((s, t) => s + t.user_rating, 0) / rated.length).toFixed(1) : '—',
      })
      setLoading(false)
    })
  }, [driver])

  return (
    <div style={{ minHeight: '100vh', background: '#05050e', fontFamily: "'Nunito',sans-serif", color: '#ede8d8' }}>
      <style>{`
        .dhi-nav { height:58px; background:rgba(5,5,14,.92); border-bottom:1px solid rgba(46,204,113,.12); display:flex; align-items:center; padding:0 1.5rem; position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); gap:1rem; }
        .dhi-card { background:#0e0e20; border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:1.25rem; }
        .dhi-row { display:flex; align-items:center; gap:.85rem; padding:.88rem 1rem; border-radius:10px; transition:background .15s; cursor:default; }
        .dhi-row:hover { background:rgba(255,255,255,.03); }
        .skel { background:linear-gradient(90deg,#0e0e20 25%,#161628 50%,#0e0e20 75%); background-size:400% 100%; animation:sh 1.4s ease infinite; border-radius:10px; }
        @keyframes sh { 0%{background-position:100% 0;} 100%{background-position:-100% 0;} }
      `}</style>

      <nav className="dhi-nav">
        <button onClick={() => navigate('/driver/home')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#504c74', display: 'flex', padding: 0 }}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: '1.1rem' }}>Trip History</div>
      </nav>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '1.5rem 1.25rem' }}>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '.85rem', marginBottom: '1.5rem' }}>
          {[
            [stats.total,                    'Completed',    '#2ecc71'],
            [`₹${stats.earnings.toLocaleString()}`, 'Earned', '#ffb347'],
            [`${stats.avgRating}★`,          'Avg Rating',   '#ffb347'],
          ].map(([v, l, c]) => (
            <div key={l} className="dhi-card" style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.45rem', fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: '.7rem', color: '#504c74', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Trip list */}
        <div className="dhi-card" style={{ padding: '.5rem .25rem' }}>
          {loading && [1,2,3,4].map(i => (
            <div key={`sk-${i}`} className="skel" style={{ height: 72, margin: '.5rem .75rem', borderRadius: 10 }}/>
          ))}

          {!loading && trips.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#504c74' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '.75rem' }}>🚗</div>
              <p>No trips yet</p>
            </div>
          )}

          {!loading && trips.map(t => (
            <div key={t.id} className="dhi-row">
              <div style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                {t.status === 'completed' ? '✅' : t.status === 'cancelled' ? '❌' : '🔄'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.87rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.pickup_address}
                </div>
                <div style={{ fontSize: '.74rem', color: '#504c74', marginTop: 1 }}>
                  {t.distance_km}km · {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                {t.user_rating && (
                  <div style={{ fontSize: '.74rem', color: '#ffb347', marginTop: 1 }}>
                    {'★'.repeat(t.user_rating)}{'☆'.repeat(5 - t.user_rating)}
                    {t.user_review && <span style={{ color: '#504c74', marginLeft: 5 }}>{t.user_review}</span>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, color: '#ffb347', fontSize: '.9rem' }}>₹{t.final_fare}</div>
                <span style={{ display: 'inline-block', marginTop: 3, padding: '.2rem .55rem', borderRadius: 99, fontSize: '.63rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', background: `${SC[t.status] || '#504c74'}18`, color: SC[t.status] || '#504c74', border: `1px solid ${SC[t.status] || '#504c74'}33` }}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
