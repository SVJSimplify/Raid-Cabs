// SafetyPanel — shown during active bookings
// Provides: SOS, emergency call, trip sharing, arrive safe

import { useState } from 'react'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Shield, AlertTriangle, Phone, Share2, CheckCircle, X, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

const IIT_SECURITY = '+914023016000'  // IIT Hyderabad security
const INDIA_EMERGENCY = '112'

export default function SafetyPanel({ booking, driver, userPos, onClose, onArriveSafe }) {
  const { profile } = useAuth()
  const [sending,  setSending]  = useState(false)
  const [shared,   setShared]   = useState(false)
  const [sosSent,  setSosSent]  = useState(false)
  const [showFull, setShowFull] = useState(false)

  const emergencyName  = profile?.emergency_contact_name  || 'Emergency Contact'
  const emergencyPhone = profile?.emergency_contact_phone || ''
  const hasEmergencyContact = Boolean(emergencyPhone)

  // Build a WhatsApp share message with trip details
  const buildShareMsg = () => {
    const lines = [
      `🚖 *Raid Cabs — Live Trip Update*`,
      ``,
      `Passenger: ${profile?.full_name || 'Unknown'}`,
      `Status: ${booking?.status || 'Active'}`,
      driver ? `Driver: ${driver.name} (${driver.phone})` : '',
      driver ? `Vehicle: ${driver.vehicle_model} · ${driver.vehicle_number}` : '',
      booking ? `Pickup: ${booking.pickup_address}` : '',
      `Drop: IIT Hyderabad, Sangareddy`,
      userPos  ? `\nLive location: https://maps.google.com/?q=${userPos.lat},${userPos.lng}` : '',
      ``,
      `_This message was sent from Raid Cabs safety feature_`,
    ].filter(l => l !== null)
    return lines.join('\n')
  }

  const shareViaWhatsApp = phone => {
    const msg = encodeURIComponent(buildShareMsg())
    const cleaned = phone.replace(/\D/g,'')
    const num = cleaned.startsWith('91') ? cleaned : `91${cleaned.slice(-10)}`
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
    setShared(true)
    toast.success('WhatsApp opened — send the message to share your trip')
  }

  const copyTripDetails = async () => {
    const text = buildShareMsg().replace(/\*/g,'').replace(/_/g,'')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Trip details copied — paste in any chat')
      setShared(true)
    } catch {
      toast.error('Could not copy — try sharing via WhatsApp')
    }
  }

  const triggerSOS = async () => {
    if (sosSent) return
    setSending(true)

    // Log SOS to database
    if (booking?.id) {
      await Promise.all([
        q(() => supabase.from('sos_alerts').insert({
          booking_id:   booking.id,
          user_id:      booking.user_id,
          driver_id:    booking.driver_id,
          triggered_by: 'passenger',
          message:      'Passenger triggered SOS',
          location_lat: userPos?.lat,
          location_lng: userPos?.lng,
        })),
        q(() => supabase.from('bookings').update({
          sos_triggered: true,
          sos_at: new Date().toISOString(),
        }).eq('id', booking.id)),
      ])
    }

    setSosSent(true)
    setSending(false)

    toast.error('🆘 SOS triggered — Admin notified immediately!', { duration: 8000, icon: '🆘' })

    // Auto-share with emergency contact via WhatsApp
    if (hasEmergencyContact) {
      setTimeout(() => {
        shareViaWhatsApp(emergencyPhone)
      }, 800)
    }
  }

  return (
    <>
      {/* Inline safety bar — always visible during trip */}
      {!showFull && (
        <div style={{ background:'rgba(231,76,60,.08)', border:'1px solid rgba(231,76,60,.2)', borderRadius:'var(--rs)', padding:'.75rem 1rem', display:'flex', alignItems:'center', gap:'.75rem', cursor:'pointer' }}
          onClick={() => setShowFull(true)}>
          <Shield size={16} style={{ color:'var(--red)', flexShrink:0 }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:'.85rem', color:'var(--red)' }}>Safety</div>
            <div style={{ fontSize:'.73rem', color:'var(--ts)', marginTop:1 }}>SOS · Share trip · Emergency call</div>
          </div>
          <span style={{ fontSize:'.72rem', color:'var(--tm)' }}>Tap to open →</span>
        </div>
      )}

      {/* Full safety panel */}
      {showFull && (
        <div style={{ background:'rgba(5,5,14,.97)', border:'2px solid rgba(231,76,60,.3)', borderRadius:'var(--r)', padding:'1.5rem', position:'relative' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.25rem' }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(231,76,60,.12)', border:'1px solid rgba(231,76,60,.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={18} color="var(--red)"/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:'1rem', color:'var(--red)' }}>Safety Panel</div>
              <div style={{ fontSize:'.74rem', color:'var(--ts)', marginTop:1 }}>
                {sosSent ? '🆘 SOS Active — Admin notified' : 'Active booking protection'}
              </div>
            </div>
            <button onClick={() => setShowFull(false)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:4 }}>
              <X size={16}/>
            </button>
          </div>

          {/* SOS Button — biggest, most prominent */}
          <button
            onClick={triggerSOS}
            disabled={sending || sosSent}
            style={{
              width: '100%',
              padding: '1rem',
              background: sosSent ? 'rgba(46,204,113,.1)' : 'linear-gradient(135deg,#e74c3c,#c0392b)',
              border: sosSent ? '2px solid rgba(46,204,113,.3)' : '2px solid rgba(231,76,60,.5)',
              borderRadius: 'var(--rs)',
              color: sosSent ? 'var(--green)' : '#fff',
              fontFamily: 'var(--fb)',
              fontWeight: 800,
              fontSize: '1.05rem',
              cursor: sosSent ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '.65rem',
              marginBottom: '1rem',
              boxShadow: sosSent ? 'none' : '0 4px 24px rgba(231,76,60,.4)',
              transition: 'all .2s',
            }}>
            {sending ? <span className="spinner" style={{ borderTopColor:'#fff' }}/> :
             sosSent  ? <><CheckCircle size={18}/> SOS Sent — Admin Notified</> :
                        <><AlertTriangle size={18}/> 🆘 SOS — I Need Help</>}
          </button>

          {sosSent && !hasEmergencyContact && (
            <div className="warn-box mb2" style={{ fontSize:'.78rem' }}>
              <AlertTriangle size={13} style={{ flexShrink:0 }}/>
              Add an emergency contact in your Profile so they get notified automatically next time.
            </div>
          )}

          {/* Emergency calls */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.65rem', marginBottom:'1rem' }}>
            <a href={`tel:${INDIA_EMERGENCY}`}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'.4rem', padding:'.9rem .5rem', background:'rgba(231,76,60,.08)', border:'1px solid rgba(231,76,60,.22)', borderRadius:'var(--rs)', textDecoration:'none', color:'var(--red)', fontWeight:700, fontSize:'.82rem' }}>
              <span style={{ fontSize:'1.4rem' }}>🚨</span>
              <span>112</span>
              <span style={{ fontSize:'.68rem', color:'var(--ts)', fontWeight:400 }}>National Emergency</span>
            </a>
            <a href={`tel:${IIT_SECURITY}`}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'.4rem', padding:'.9rem .5rem', background:'rgba(52,152,219,.08)', border:'1px solid rgba(52,152,219,.22)', borderRadius:'var(--rs)', textDecoration:'none', color:'var(--blue)', fontWeight:700, fontSize:'.82rem' }}>
              <span style={{ fontSize:'1.4rem' }}>🏫</span>
              <span>Campus</span>
              <span style={{ fontSize:'.68rem', color:'var(--ts)', fontWeight:400 }}>IIT Security</span>
            </a>
          </div>

          {/* Emergency contact call */}
          {hasEmergencyContact && (
            <a href={`tel:${emergencyPhone}`}
              style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.85rem 1rem', background:'rgba(155,89,182,.08)', border:'1px solid rgba(155,89,182,.22)', borderRadius:'var(--rs)', textDecoration:'none', marginBottom:'1rem' }}>
              <Phone size={15} color="#9b59b6" style={{ flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'#9b59b6', fontSize:'.87rem' }}>Call {emergencyName}</div>
                <div style={{ fontSize:'.73rem', color:'var(--ts)' }}>{emergencyPhone} · Your emergency contact</div>
              </div>
              <span style={{ fontSize:'.75rem', color:'var(--blue)', fontWeight:700 }}>CALL →</span>
            </a>
          )}

          {/* Share trip */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--tm)', marginBottom:'.6rem' }}>Share Your Trip</div>
            <div style={{ display:'flex', gap:'.6rem' }}>
              {hasEmergencyContact && (
                <button onClick={() => shareViaWhatsApp(emergencyPhone)}
                  style={{ flex:1, padding:'.72rem .5rem', background:'rgba(37,211,102,.08)', border:'1px solid rgba(37,211,102,.22)', borderRadius:'var(--rs)', color:'#25d366', fontFamily:'var(--fb)', fontWeight:700, fontSize:'.8rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  <span>📲</span> WhatsApp {emergencyName.split(' ')[0]}
                </button>
              )}
              <button onClick={copyTripDetails}
                style={{ flex:1, padding:'.72rem .5rem', background:'rgba(52,152,219,.08)', border:'1px solid rgba(52,152,219,.22)', borderRadius:'var(--rs)', color:'var(--blue)', fontFamily:'var(--fb)', fontWeight:700, fontSize:'.8rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <Share2 size={13}/> {shared ? 'Copied!' : 'Copy Details'}
              </button>
            </div>
            {!hasEmergencyContact && (
              <p style={{ fontSize:'.72rem', color:'var(--tm)', marginTop:'.45rem' }}>
                💡 Add an emergency contact in <a href="/profile" style={{ color:'var(--gold)' }}>Profile</a> for one-tap WhatsApp sharing.
              </p>
            )}
          </div>

          {/* Arrive Safe */}
          {booking?.status === 'completed' && !booking?.arrived_safe && (
            <button onClick={onArriveSafe}
              style={{ width:'100%', padding:'.82rem', background:'rgba(46,204,113,.1)', border:'2px solid rgba(46,204,113,.3)', borderRadius:'var(--rs)', color:'var(--green)', fontFamily:'var(--fb)', fontWeight:700, fontSize:'.9rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
              <CheckCircle size={16}/> I Have Arrived Safely ✓
            </button>
          )}

          {/* Driver details for verification */}
          {driver && (
            <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--b1)' }}>
              <div style={{ fontSize:'.73rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--tm)', marginBottom:'.5rem' }}>Verify Your Driver</div>
              <div style={{ display:'flex', gap:'.6rem', flexWrap:'wrap' }}>
                {[
                  ['👤', driver.name],
                  ['🚗', driver.vehicle_number],
                  ['🚘', driver.vehicle_model],
                ].map(([em, v]) => (
                  <div key={v} style={{ background:'rgba(255,255,255,.04)', border:'1px solid var(--b1)', borderRadius:'var(--rx)', padding:'.35rem .75rem', fontSize:'.79rem', color:'var(--tp)', display:'flex', alignItems:'center', gap:5 }}>
                    <span>{em}</span> <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:'.71rem', color:'var(--tm)', marginTop:'.5rem' }}>
                ⚠ Always confirm the vehicle plate matches before getting in.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
