// LiveLinkGate — driver must paste a valid Google Maps live location link
// before the start-pickup action is enabled.
//
// Usage in DriverHome (wrap your "Go to Pickup" button):
//
//   <LiveLinkGate
//     bookingId={booking.id}
//     existingLink={booking.driver_live_link}
//     onConfirmed={(link) => { /* now enable start button */ }}
//   />

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { MapPin, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

// Accept: maps.app.goo.gl short links, google.com/maps URLs, goo.gl/maps
const GMAPS_RE = /^https:\/\/(maps\.app\.goo\.gl\/|www\.google\.com\/maps|maps\.google\.com\/|goo\.gl\/maps\/)/

export function validateGoogleMapsLink(url = '') {
  try { new URL(url.trim()) } catch { return false }
  return GMAPS_RE.test(url.trim())
}

export default function LiveLinkGate({ bookingId, existingLink = null, onConfirmed }) {
  const [link,   setLink]   = useState(existingLink || '')
  const [saving, setSaving] = useState(false)

  const isValid = validateGoogleMapsLink(link)

  // Already confirmed — show status bar only
  if (existingLink && validateGoogleMapsLink(existingLink)) {
    return (
      <div style={{ background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.22)', borderRadius:10, padding:'.7rem 1rem', display:'flex', alignItems:'center', gap:8 }}>
        <CheckCircle size={15} color="#22c55e" style={{ flexShrink:0 }}/>
        <span style={{ fontSize:'.82rem', color:'#22c55e', fontWeight:700, flex:1 }}>Live location link active</span>
        <a href={existingLink} target="_blank" rel="noreferrer"
          style={{ fontSize:'.75rem', color:'var(--gold)', display:'flex', alignItems:'center', gap:3 }}>
          Open <ExternalLink size={11}/>
        </a>
      </div>
    )
  }

  const handleConfirm = async () => {
    if (!isValid) return
    setSaving(true)
    const { error } = await supabase
      .from('bookings')
      .update({
        driver_live_link:        link.trim(),
        driver_live_link_set_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (error) {
      toast.error('Could not save link — try again')
      setSaving(false)
      return
    }

    toast.success('Live location link saved!')
    onConfirmed?.(link.trim())
    setSaving(false)
  }

  return (
    <div style={{ background:'rgba(245,166,35,.06)', border:'1px solid rgba(245,166,35,.22)', borderRadius:12, padding:'1rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:'.55rem' }}>
        <MapPin size={14} color="#f5a623"/>
        <span style={{ fontSize:'.82rem', fontWeight:700, color:'#f5a623' }}>Share live location to start</span>
      </div>

      {/* Instruction */}
      <p style={{ fontSize:'.74rem', color:'var(--ts)', marginBottom:'.8rem', lineHeight:1.55 }}>
        Open <strong style={{ color:'var(--tp)' }}>Google Maps</strong> → tap your profile photo → <em>Share location</em> → copy the link and paste it below.
      </p>

      {/* Input row */}
      <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <input
            className="input"
            type="url"
            placeholder="https://maps.app.goo.gl/..."
            value={link}
            onChange={e => setLink(e.target.value)}
            style={{ paddingRight:'2.2rem', borderColor: link ? (isValid ? 'var(--green)' : '#e74c3c') : undefined }}
          />
          {link && (
            <span style={{ position:'absolute', right:'.65rem', top:'50%', transform:'translateY(-50%)', display:'flex' }}>
              {isValid
                ? <CheckCircle size={14} color="#22c55e"/>
                : <AlertCircle size={14} color="#e74c3c"/>}
            </span>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={!isValid || saving}
          style={{ flexShrink:0 }}
        >
          {saving ? <span className="spinner"/> : 'Confirm'}
        </button>
      </div>

      {link && !isValid && (
        <p style={{ fontSize:'.72rem', color:'#e74c3c', marginTop:'.4rem' }}>
          Must be a Google Maps link (maps.app.goo.gl or google.com/maps)
        </p>
      )}
    </div>
  )
}
