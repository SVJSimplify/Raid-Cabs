// EmergencySetup — shown once to every new user before they can access the app
// Forces them to add an emergency contact before continuing

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Heart, Phone, User, Shield, ArrowRight, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EmergencySetup() {
  const { profile, updateProfile, signOut } = useAuth()
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [step,    setStep]    = useState('intro') // intro | form

  const handleSave = async e => {
    e.preventDefault()
    if (!name.trim())  { toast.error('Enter your contact\'s name'); return }
    const digits = phone.replace(/\D/g,'')
    if (digits.length < 10) { toast.error('Enter a valid 10-digit phone number'); return }

    setSaving(true)
    const { error } = await updateProfile({
      emergency_contact_name:  name.trim(),
      emergency_contact_phone: phone.trim(),
    })
    if (error) {
      toast.error('Could not save — please try again')
      setSaving(false)
      return
    }
    toast.success('Emergency contact saved ✓')
    setSaving(false)
    // AuthContext will re-render and ProtectedRoute will now let them through
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:'var(--page-py) var(--page-px)', fontFamily:'var(--fb)', position:'relative', overflow:'hidden' }}>
      <div className="orb orb1"/>
      <div className="orb orb2"/>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        .ec-card{background:var(--card);border:1px solid var(--b1);border-radius:22px;padding:2.4rem;width:100%;max-width:480px;box-shadow:0 24px 80px rgba(0,0,0,.6);position:relative;z-index:1;}
        .ec-heart{width:80px;height:80px;background:rgba(231,76,60,.1);border:2px solid rgba(231,76,60,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;animation:float 3s ease-in-out infinite;}
        .ec-step{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;flex-shrink:0;}
        .ec-step.done{background:rgba(46,204,113,.12);border:1.5px solid rgba(46,204,113,.3);color:var(--green);}
        .ec-step.active{background:linear-gradient(135deg,var(--gold),var(--orange));color:#05050e;}
        .ec-step.next{background:rgba(255,255,255,.05);border:1.5px solid var(--b1);color:var(--tm);}
      `}</style>

      <div className="ec-card">

        {/* ── INTRO ──────────────────────────────────────────── */}
        {step === 'intro' && (
          <div style={{ textAlign:'center' }}>
            <div className="ec-heart"><Heart size={36} color="var(--red)"/></div>

            <h1 style={{ fontFamily:'var(--fd)', fontSize:'1.75rem', fontWeight:800, marginBottom:'.75rem' }}>
              One Safety Step
            </h1>
            <p style={{ color:'var(--ts)', lineHeight:1.75, fontSize:'.95rem', marginBottom:'2rem' }}>
              Before your first ride, add someone we can notify in an emergency — a parent, friend, or roommate.
              This is <strong style={{ color:'var(--gold)' }}>required</strong> to use Raid Cabs.
            </p>

            {/* Why it matters */}
            <div style={{ textAlign:'left', marginBottom:'2rem' }}>
              {[
                ['🆘', 'SOS activated', 'They get WhatsApp message with your location + driver details instantly'],
                ['📍', 'Live location', 'Your trip details and live map link go to them in any emergency'],
                ['✅', 'Peace of mind', 'They know you\'re safe without you having to text every time'],
              ].map(([em, title, desc]) => (
                <div key={title} style={{ display:'flex', gap:'.85rem', padding:'.75rem 0', borderBottom:'1px solid var(--b1)' }}>
                  <span style={{ fontSize:'1.3rem', flexShrink:0 }}>{em}</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'.88rem' }}>{title}</div>
                    <div style={{ fontSize:'.78rem', color:'var(--ts)', marginTop:2, lineHeight:1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('form')}
              className="btn btn-primary btn-blk btn-lg"
            >
              <Heart size={16}/> Add Emergency Contact
            </button>

            <button
              onClick={() => signOut()}
              style={{ marginTop:'.85rem', background:'transparent', border:'none', color:'var(--tm)', fontSize:'.79rem', cursor:'pointer', fontFamily:'var(--fb)', width:'100%' }}
            >
              Sign out instead
            </button>
          </div>
        )}

        {/* ── FORM ───────────────────────────────────────────── */}
        {step === 'form' && (
          <>
            {/* Progress */}
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'2rem' }}>
              <div className="ec-step done">✓</div>
              <div style={{ flex:1, height:2, background:'linear-gradient(to right, var(--green), var(--gold))', borderRadius:99 }}/>
              <div className="ec-step active">2</div>
              <div style={{ flex:1, height:2, background:'var(--b1)', borderRadius:99 }}/>
              <div className="ec-step next">3</div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:'.85rem', marginBottom:'1.75rem' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(231,76,60,.1)', border:'1.5px solid rgba(231,76,60,.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Shield size={20} color="var(--red)"/>
              </div>
              <div>
                <h2 style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>Emergency Contact</h2>
                <p style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>Who should we notify in an emergency?</p>
              </div>
            </div>

            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              <div className="fg">
                <label className="label">Contact Name</label>
                <div className="input-wrap">
                  <User size={15} className="ico"/>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Mum, Dad, Best Friend"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="fg">
                <label className="label">Their Phone Number</label>
                <div className="input-wrap">
                  <Phone size={15} className="ico"/>
                  <input
                    className="input"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                  />
                </div>
                <p className="hint">They'll be contacted via WhatsApp if you press SOS during a ride</p>
              </div>

              <div className="info-box">
                <Heart size={13} style={{ flexShrink:0, color:'var(--red)' }}/>
                <span>We only contact them if <strong>you</strong> press the SOS button. This is never shared with anyone else.</span>
              </div>

              <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={saving}>
                {saving
                  ? <span className="spinner"/>
                  : <><ArrowRight size={16}/> Save & Continue to App</>
                }
              </button>
            </form>

            <button
              onClick={() => setStep('intro')}
              style={{ marginTop:'.85rem', background:'transparent', border:'none', color:'var(--tm)', fontSize:'.79rem', cursor:'pointer', fontFamily:'var(--fb)', width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
