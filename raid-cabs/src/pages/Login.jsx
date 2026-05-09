import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const OTP_LEN = 6

export default function Login() {
  const [mode,         setMode]      = useState('choose')   // choose | email-otp
  const [email,        setEmail]     = useState('')
  const [emailOtpStep, setEmailStep] = useState('input')    // input | verify
  const [emailOtp,     setEmailOtp]  = useState(Array(OTP_LEN).fill(''))
  const [cooldown,     setCooldown]  = useState(0)
  const [loading,      setLoading]   = useState(false)
  const emailRefs = useRef([])

  const { signInWithEmailOtp, verifyEmailOtp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const startCd = (s) => {
    setCooldown(s)
    const iv = setInterval(() => setCooldown(c => {
      if (c <= 1) { clearInterval(iv); return 0 }
      return c - 1
    }), 1000)
  }

  // ── OTP box ───────────────────────────────────────────────────────────────
  const otpHandlers = {
    onCell: (i, val) => {
      const v = val.replace(/\D/g, '').slice(-1)
      const n = [...emailOtp]; n[i] = v; setEmailOtp(n)
      if (v && i < OTP_LEN - 1) emailRefs.current[i + 1]?.focus()
    },
    onKey: (i, e) => {
      if (e.key === 'Backspace' && !emailOtp[i] && i > 0) emailRefs.current[i - 1]?.focus()
    },
    onPaste: e => {
      const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN)
      if (!p) return; e.preventDefault()
      const n = Array(OTP_LEN).fill(''); p.split('').forEach((c, i) => { n[i] = c })
      setEmailOtp(n); emailRefs.current[Math.min(p.length, OTP_LEN - 1)]?.focus()
    },
  }

  const renderOtp = () => (
    <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', margin:'1.5rem 0' }}>
      {emailOtp.map((v, i) => (
        <input key={i} ref={el => emailRefs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1} value={v}
          onChange={e => otpHandlers.onCell(i, e.target.value)}
          onKeyDown={e => otpHandlers.onKey(i, e)}
          onPaste={i === 0 ? otpHandlers.onPaste : undefined}
          className="otp-cell"
          style={{ borderColor: v ? 'var(--gold)' : 'var(--b1)' }}/>
      ))}
    </div>
  )

  const reset = () => {
    setMode('choose'); setEmailStep('input'); setEmailOtp(Array(OTP_LEN).fill(''))
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { toast.error(error.message); setLoading(false) }
  }

  const sendEmailOtp = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email'); return }
    setLoading(true)
    const { error } = await signInWithEmailOtp(email)
    if (error) {
      toast.error(error.message || 'Could not send code')
    } else {
      toast.success(`Code sent to ${email}`)
      setEmailStep('verify')
      startCd(60)
      setTimeout(() => emailRefs.current[0]?.focus(), 100)
    }
    setLoading(false)
  }

  const verifyEmailOtpFn = async e => {
    e.preventDefault()
    const code = emailOtp.join('')
    if (code.length !== OTP_LEN) { toast.error('Enter all 6 digits'); return }
    setLoading(true)
    const { error } = await verifyEmailOtp(email, code)
    if (error) {
      toast.error('Invalid code')
      setEmailOtp(Array(OTP_LEN).fill(''))
      emailRefs.current[0]?.focus()
    } else {
      toast.success('Signed in!')
      navigate('/dashboard')
    }
    setLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', overflow:'hidden' }}>
      <style>{`
        .ll{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3rem;background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(255,179,71,.06) 0%,transparent 50%);position:relative;}
        .ll::after{content:'';position:absolute;right:0;top:10%;bottom:10%;width:1px;background:linear-gradient(to bottom,transparent,var(--b1),transparent);}
        .lr{width:440px;display:flex;flex-direction:column;justify-content:center;padding:3rem;background:rgba(13,13,31,.6);backdrop-filter:blur(28px);overflow-y:auto;max-height:100vh;}
        .lcard{background:var(--card);border:1px solid var(--b1);border-radius:22px;padding:2.4rem;box-shadow:0 24px 80px rgba(0,0,0,.6);}
        .choice{display:flex;align-items:center;gap:.9rem;width:100%;padding:1rem 1.2rem;background:rgba(255,255,255,.03);border:1px solid var(--b1);border-radius:12px;cursor:pointer;transition:all .22s;font-family:var(--fb);margin-bottom:.7rem;}
        .choice:hover{border-color:var(--b2);background:rgba(255,179,71,.04);transform:translateX(3px);}
        .ci{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .back-btn{background:transparent;border:none;cursor:pointer;color:var(--ts);display:flex;padding:0;}
        .google-btn{width:100%;padding:.78rem;background:#fff;color:#1f1f1f;border:1px solid #e0e0e0;border-radius:10px;font-family:var(--fb);font-size:.92rem;font-weight:600;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:9px;}
        .google-btn:hover:not(:disabled){background:#f5f5f5;} .google-btn:disabled{opacity:.45;cursor:not-allowed;}
        @media(max-width:880px){.ll{display:none;}.lr{width:100%;padding:2rem 1.4rem;max-height:none;}}
      `}</style>

      {/* Left panel */}
      <div className="ll">
        <img src="/logo.png" alt="" style={{ width:120, marginBottom:'2rem', filter:'drop-shadow(0 0 30px rgba(255,179,71,.4))', animation:'float 4s ease-in-out infinite' }} onError={e=>e.target.style.display='none'}/>
        <h1 style={{ fontFamily:'var(--fd)', fontSize:'2.85rem', fontWeight:900, lineHeight:1.15, textAlign:'center', maxWidth:380 }}>
          Our <span className="gold">Wheels</span><br/>Take You to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:310, fontSize:'.95rem', lineHeight:1.65 }}>Premium campus cab service for IIT Hyderabad.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem', marginTop:'2rem', justifyContent:'center' }}>
          {['Google Login','Email OTP','Live Tracking','Ride Code','SOS Safety'].map(p => (
            <span key={p} style={{ background:'rgba(255,179,71,.07)', border:'1px solid var(--b1)', borderRadius:99, padding:'.38rem .9rem', fontSize:'.78rem', color:'var(--ts)' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="lr">
        <div className="lcard">

          {/* ── CHOOSE ── */}
          {mode === 'choose' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'1.8rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700 }}>Welcome</div>
                <div style={{ color:'var(--ts)', fontSize:'.84rem', marginTop:'.3rem' }}>Sign in to book your ride</div>
              </div>

              <button className="google-btn" onClick={handleGoogle} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                  <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                  <path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.86.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.86.92 7.5 2.56 10.72l7.12-5.7-.02-.01z"/>
                  <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7C13.42 14.62 18.27 10.75 24 10.75z"/>
                </svg>
                {loading ? <span className="spinner"/> : 'Continue with Google'}
              </button>

              <div className="divider mb3">or</div>

              <button className="choice" onClick={() => setMode('email-otp')}>
                <div className="ci" style={{ background:'rgba(52,152,219,.12)' }}><Mail size={18} color="#3498db"/></div>
                <div style={{ flex:1, textAlign:'left' }}>
                  <div style={{ fontWeight:700, color:'var(--tp)', fontSize:'.9rem' }}>Email OTP</div>
                  <div style={{ fontSize:'.74rem', color:'var(--tm)', marginTop:1 }}>6-digit code to your email — no password needed</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <div style={{ borderTop:'1px solid var(--b1)', marginTop:'1.25rem', paddingTop:'1.1rem', display:'flex', flexDirection:'column', gap:'.4rem' }}>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>New driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Apply here →</Link></p>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>Driver? <Link to="/driver" style={{ color:'var(--green)', fontWeight:700 }}>Driver login →</Link></p>
              </div>
            </>
          )}

          {/* ── EMAIL OTP ── */}
          {mode === 'email-otp' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back-btn"><ChevronLeft size={20}/></button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>
                    {emailOtpStep === 'input' ? 'Your Email' : 'Check Email'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>
                    {emailOtpStep === 'verify' ? `Code sent to ${email}` : "We'll email you a 6-digit code"}
                  </div>
                </div>
              </div>

              {emailOtpStep === 'input' && (
                <form onSubmit={e => { e.preventDefault(); sendEmailOtp() }}>
                  <div className="fg mb3">
                    <label className="label">Email Address</label>
                    <div className="input-wrap">
                      <Mail size={15} className="ico"/>
                      <input className="input" type="email" placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        required autoFocus name="email" autoComplete="email"/>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                    {loading ? <span className="spinner"/> : <><ArrowRight size={16}/> Send Code</>}
                  </button>
                </form>
              )}

              {emailOtpStep === 'verify' && (
                <form onSubmit={verifyEmailOtpFn}>
                  <div style={{ textAlign:'center', padding:'.65rem', background:'rgba(52,152,219,.08)', border:'1px solid rgba(52,152,219,.2)', borderRadius:'var(--rs)', marginBottom:'.5rem', fontWeight:700, color:'#3498db' }}>
                    {email}
                  </div>
                  {renderOtp()}
                  <button type="submit" className="btn btn-primary btn-blk btn-lg"
                    disabled={loading || emailOtp.join('').length !== OTP_LEN}>
                    {loading ? <span className="spinner"/> : 'Verify & Sign In'}
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => { setEmailStep('input'); setEmailOtp(Array(OTP_LEN).fill('')) }}>
                      <ChevronLeft size={13}/> Change
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={sendEmailOtp} disabled={cooldown > 0 || loading}>
                      <RefreshCw size={13}/> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
