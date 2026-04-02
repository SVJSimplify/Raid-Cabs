import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RatingModal({ booking, onClose, onDone }) {
  const [rating, setRating]   = useState(0)
  const [hover, setHover]     = useState(0)
  const [review, setReview]   = useState('')
  const [saving, setSaving]   = useState(false)

  const submit = async () => {
    if (!rating) { toast.error('Please select a star rating'); return }
    setSaving(true)
    const { error } = await supabase.from('bookings').update({
      user_rating: rating,
      user_review: review.trim() || null,
      rated_at: new Date().toISOString(),
    }).eq('id', booking.id)
    if (error) { toast.error('Failed to save rating'); setSaving(false); return }
    toast.success('Thanks for your feedback! ⭐')
    setSaving(false)
    onDone(rating)
  }

  const labels = ['','Terrible','Poor','OK','Good','Excellent']
  const colors = ['','var(--red)','#e67e22','var(--gold)','#27ae60','var(--green)']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:400, textAlign:'center' }}>
        <button onClick={onClose} style={{ position:'absolute', top:'1.25rem', right:'1.25rem', background:'transparent', border:'none', cursor:'pointer', color:'var(--tm)' }}>
          <X size={18}/>
        </button>

        <div style={{ fontSize:'2.5rem', marginBottom:'.75rem' }}>🌟</div>
        <h2 style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700, marginBottom:'.4rem' }}>Rate Your Ride</h2>
        <p style={{ color:'var(--ts)', fontSize:'.86rem', marginBottom:'1.75rem' }}>
          How was your trip with <strong style={{ color:'var(--tp)' }}>{booking.driver_name || 'your driver'}</strong>?
        </p>

        {/* Stars */}
        <div style={{ display:'flex', justifyContent:'center', gap:'.5rem', marginBottom:'.6rem' }}>
          {[1,2,3,4,5].map(s => (
            <span
              key={s}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              style={{ fontSize:'2.4rem', cursor:'pointer', color:(hover||rating)>=s?'var(--gold)':'var(--tm)', transition:'color .15s, transform .15s', transform:(hover||rating)>=s?'scale(1.15)':'scale(1)', display:'inline-block' }}
            >★</span>
          ))}
        </div>
        {(hover||rating) > 0 && (
          <p style={{ color:colors[hover||rating], fontWeight:700, fontSize:'.92rem', marginBottom:'1.25rem', transition:'color .15s' }}>
            {labels[hover||rating]}
          </p>
        )}

        <div className="fg mb3" style={{ textAlign:'left' }}>
          <label className="label">Add a comment (optional)</label>
          <textarea
            className="input"
            rows={3}
            placeholder="How was your experience? Any feedback for the driver?"
            value={review}
            onChange={e=>setReview(e.target.value)}
            style={{ resize:'vertical', minHeight:80 }}
          />
        </div>

        <button className="btn btn-primary btn-blk btn-lg" onClick={submit} disabled={saving||!rating}>
          {saving ? <span className="spinner"/> : '✦ Submit Rating'}
        </button>
      </div>
    </div>
  )
}
