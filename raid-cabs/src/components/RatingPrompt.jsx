// Mandatory rating popup shown after a completed trip
import { useState } from 'react'
import { supabase, q } from '../lib/supabase'
import { Star, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RatingPrompt({ booking, driver, onDone }) {
  const [stars,   setStars]   = useState(0)
  const [hover,   setHover]   = useState(0)
  const [review,  setReview]  = useState('')
  const [saving,  setSaving]  = useState(false)

  const submit = async () => {
    if (!stars) { toast.error('Please select a rating'); return }
    setSaving(true)
    await q(() => supabase.from('bookings').update({
      user_rating: stars,
      user_review: review.trim() || null,
      rated_at:    new Date().toISOString(),
    }).eq('id', booking.id))
    toast.success('Thanks for rating! ⭐')
    setSaving(false)
    onDone()
  }

  const labels = ['','Terrible','Poor','OK','Good','Excellent!']

  return (
    <div className="overlay" style={{ zIndex:950 }}>
      <div className="modal" style={{ textAlign:'center', maxWidth:400 }}>
        {/* Driver photo */}
        <div style={{ width:76, height:76, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--orange))', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', overflow:'hidden', border:'3px solid rgba(245,166,35,.3)' }}>
          {driver?.photo_url
            ? <img src={driver.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : <span style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:'1.6rem', color:'#0a0a0f' }}>{driver?.name?.[0]?.toUpperCase()||'D'}</span>
          }
        </div>

        <h2 style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700, marginBottom:'.4rem' }}>
          How was your ride?
        </h2>
        <p style={{ color:'var(--ts)', fontSize:'.85rem', marginBottom:'1.5rem' }}>
          Rate your experience with <strong style={{ color:'var(--tp)' }}>{driver?.name||'your driver'}</strong>
        </p>

        {/* Stars */}
        <div style={{ display:'flex', justifyContent:'center', gap:'.4rem', marginBottom:'.65rem' }}>
          {[1,2,3,4,5].map(s => (
            <button key={`rating-star-${s}`}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setStars(s)}
              style={{ background:'transparent', border:'none', cursor:'pointer', padding:4, transition:'transform .15s', transform:(hover||stars)>=s?'scale(1.15)':'scale(1)' }}>
              <Star size={36} fill={(hover||stars)>=s?'var(--gold)':'transparent'} color={(hover||stars)>=s?'var(--gold)':'var(--tm)'}/>
            </button>
          ))}
        </div>

        {(hover||stars) > 0 && (
          <div style={{ fontSize:'.85rem', fontWeight:700, color:'var(--gold)', marginBottom:'1rem', height:20 }}>
            {labels[hover||stars]}
          </div>
        )}

        {/* Quick tags */}
        {stars > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.45rem', justifyContent:'center', marginBottom:'1rem' }}>
            {(stars>=4
              ? ['Great driver','Clean vehicle','On time','Safe driving','Friendly']
              : ['Late pickup','Drove too fast','Wrong route','Unprofessional']
            ).map(tag => (
              <button key={tag}
                onClick={() => setReview(r => r.includes(tag) ? r.replace(tag,'').trim() : `${r} ${tag}`.trim())}
                style={{ padding:'.35rem .8rem', borderRadius:99, fontSize:'.76rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--fb)', transition:'all .15s',
                  background: review.includes(tag) ? 'rgba(245,166,35,.15)' : 'rgba(255,255,255,.05)',
                  border: review.includes(tag) ? '1px solid rgba(245,166,35,.4)' : '1px solid var(--b1)',
                  color: review.includes(tag) ? 'var(--gold)' : 'var(--ts)',
                }}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={review}
          onChange={e => setReview(e.target.value)}
          placeholder="Add a comment (optional)…"
          rows={2}
          style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid var(--b1)', borderRadius:'var(--rs)', padding:'.72rem 1rem', color:'var(--tp)', fontFamily:'var(--fb)', fontSize:'.86rem', outline:'none', resize:'none', marginBottom:'1rem' }}
          onFocus={e=>e.target.style.borderColor='rgba(245,166,35,.4)'}
          onBlur={e=>e.target.style.borderColor='var(--b1)'}
        />

        <div style={{ display:'flex', gap:'.75rem' }}>
          <button onClick={onDone} className="btn btn-ghost w100">Skip</button>
          <button onClick={submit} className="btn btn-primary w100 btn-lg" disabled={!stars||saving}>
            {saving ? <span className="spinner"/> : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  )
}
