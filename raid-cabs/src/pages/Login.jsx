import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Phone, Mail, Lock, User, Eye, EyeOff, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const normalizePhone = raw => {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (raw.trim().startsWith('+')) return raw.trim()
  return `+91${digits}`
}

const OTP_LEN = 6

export default function Login() {
  const [authMode,  setAuthMode]  = useState('choose')  // choose | otp | email
  const [otpMethod, setOtpMethod] = useState(null)       // phone | email
  const [otpStep,   setOtpStep]   = useState('input')    // input | verify
  const [emailMode, setEmailMode] = useState('login')    // login | register

  const [phone,    setPhone]    = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [otp,      setOtp]      = useState(Array(OTP_LEN).fill(''))
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const otpRefs = useRef([])
  const { sendPhoneOtp, verifyPhoneOtp, signInWithEmailOtp, verifyEmailOtp, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const startCooldown = s => {
    setCooldown(s)
    const iv = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 }), 1000)
  }

  const otpStr = otp.join('')

  const handleOtpCell = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = v; setOtp(next)
    if (v && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft'  && i > 0)            otpRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < OTP_LEN - 1)  otpRefs.current[i + 1]?.focus()
  }

  const handlePaste = e => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN)
    if (!p) return
    e.preventDefault()
    const next = Array(OTP_LEN).fill('')
    p.split('').forEach((ch, i) => { next[i] = ch })
    setOtp(next)
    otpRefs.current[Math.min(p.length, OTP_LEN - 1)]?.focus()
  }

  const sendOtp = async () => {
    setLoading(true)
    const target = otpMethod === 'phone' ? normalizePhone(phone) : email
    const { error } = otpMethod === 'phone'
      ? await sendPhoneOtp(target)
      : await signInWithEmailOtp(target)

    if (error) {
      if (error.message?.includes('not supported') || error.message?.includes('provider'))
        toast.error('Phone OTP is not set up. Use Email OTP instead.')
      else
        toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success(`Code sent to ${target}`)
    setOtpStep('verify')
    startCooldown(60)
    setLoading(false)
  }

  const verifyOtp = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter the full 6-digit code'); return }
    setLoading(true)
    const { error } = otpMethod === 'phone'
      ? await verifyPhoneOtp(normalizePhone(phone), otpStr)
      : await verifyEmailOtp(email, otpStr)

    if (error) {
      toast.error('Invalid code. Try again.')
      setOtp(Array(OTP_LEN).fill(''))
      otpRefs.current[0]?.focus()
    } else {
      toast.success('Welcome! 🎉')
      navigate('/dashboard')
    }
    setLoading(false)
  }

  const handleEmail = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (emailMode === 'login') {
        const { error } = await signIn({ email, password })
        if (error) throw error
        toast.success('Welcome back!')
        navigate('/dashboard')
      } else {
        const { data, error } = await signUp({ email, password, fullName, phone: regPhone })
        if (error) throw error
        if (data?.user?.identities?.length === 0) throw new Error('Email already registered.')
        toast.success('Account created! Sign in to continue.')
        setEmailMode('login')
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  const reset = () => {
    setAuthMode('choose'); setOtpMethod(null)
    setOtpStep('input'); setOtp(Array(OTP_LEN).fill(''))
    setPhone(''); setEmail('')
  }

  const OtpBoxes = () => (
    <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', margin:'1.5rem 0' }}>
      {Array(OTP_LEN).fill(null).map((_, i) => (
        <input
          key={`otp-cell-${i}`}
          ref={el => otpRefs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={otp[i] || ''}
          onChange={e => handleOtpCell(i, e.target.value)}
          onKeyDown={e => handleOtpKey(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="otp-cell"
          style={{ borderColor: otp[i] ? 'var(--gold)' : 'var(--b1)' }}
        />
      ))}
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', overflow:'hidden' }}>
      <style>{`
        .ll { flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:3rem; position:relative; background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.09) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(255,179,71,.07) 0%,transparent 50%); }
        .ll::after { content:''; position:absolute; right:0; top:10%; bottom:10%; width:1px; background:linear-gradient(to bottom,transparent,var(--b1),transparent); }
        .hero-logo { width:130px; margin-bottom:2rem; filter:drop-shadow(0 0 32px rgba(255,179,71,.42)); animation:float 4s ease-in-out infinite; }
        .tagline { font-family:var(--fd); font-size:2.9rem; font-weight:900; line-height:1.15; text-align:center; max-width:400px; }
        .pills { display:flex; flex-wrap:wrap; gap:.65rem; margin-top:2.25rem; justify-content:center; }
        .pill { display:flex; align-items:center; gap:5px; background:rgba(255,179,71,.07); border:1px solid var(--b1); border-radius:99px; padding:.4rem .9rem; font-size:.79rem; color:var(--ts); }
        .lr { width:490px; display:flex; flex-direction:column; justify-content:center; padding:3rem; background:rgba(13,13,31,.65); backdrop-filter:blur(24px); }
        .lcard { background:var(--card); border:1px solid var(--b1); border-radius:22px; padding:2.35rem; box-shadow:0 24px 80px rgba(0,0,0,.55); }
        .choice-btn { display:flex; align-items:center; gap:.9rem; width:100%; padding:1rem 1.25rem; background:rgba(255,255,255,.03); border:1px solid var(--b1); border-radius:12px; cursor:pointer; transition:all var(--t); font-family:var(--fb); margin-bottom:.75rem; }
        .choice-btn:hover { border-color:var(--b2); background:rgba(255,179,71,.05); transform:translateX(3px); }
        .choice-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }
        .choice-title { font-weight:700; color:var(--tp); font-size:.9rem; text-align:left; }
        .choice-sub { font-size:.75rem; color:var(--tm); margin-top:1px; text-align:left; }
        .method-tabs { display:flex; background:rgba(255,255,255,.04); border-radius:10px; padding:4px; margin-bottom:1.6rem; border:1px solid var(--b1); }
        .mt-btn { flex:1; padding:.56rem; border:none; border-radius:7px; background:transparent; color:var(--ts); font-family:var(--fb); font-size:.86rem; font-weight:700; cursor:pointer; transition:var(--t); }
        .mt-btn.on { background:linear-gradient(135deg,var(--gold),var(--orange)); color:#05050e; }
        .otp-target { text-align:center; padding:.75rem; background:rgba(255,179,71,.07); border:1px solid var(--b2); border-radius:var(--rs); margin-bottom:.5rem; font-weight:700; color:var(--gold); font-size:.92rem; }
        .back-row { display:flex; align-items:center; gap:.75rem; margin-bottom:1.5rem; }
        @media(max-width:900px) { .ll { display:none; } .lr { width:100%; padding:2rem 1.4rem; } }
      `}</style>

      {/* Left hero */}
      <div className="ll">
        <img src="/logo.png" alt="Raid Cabs" className="hero-logo" onError={e => e.target.style.display='none'}/>
        <h1 className="tagline">
          Our <span className="gold">Wheels</span><br/>Take You<br/>to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:330, fontSize:'.95rem', lineHeight:1.65 }}>
          Premium campus cab service connecting IIT routes — reliable, affordable, always on time.
        </p>
        <div className="pills">
          {[['📱','Phone OTP'],['✉️','Email OTP'],['🛣️','Road Distance'],['💰','Deposit & Save'],['⭐','Rate Driver'],['🆘','SOS'],['📋','Receipts']].map(([ic, lb]) => (
            <span key={lb} className="pill">{ic} {lb}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="lr">
        <div className="lcard">

          {/* CHOOSE */}
          {authMode === 'choose' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.55rem', fontWeight:700 }}>Welcome Back</div>
                <div style={{ color:'var(--ts)', fontSize:'.84rem', marginTop:'.3rem' }}>Choose how to sign in</div>
              </div>

              <button className="choice-btn" onClick={() => { setAuthMode('otp'); setOtpMethod('phone') }}>
                <div className="choice-icon" style={{ background:'rgba(46,204,113,.12)' }}>📱</div>
                <div style={{ flex:1 }}>
                  <div className="choice-title">Phone OTP</div>
                  <div className="choice-sub">Get a 6-digit code via SMS</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <button className="choice-btn" onClick={() => { setAuthMode('otp'); setOtpMethod('email') }}>
                <div className="choice-icon" style={{ background:'rgba(52,152,219,.12)' }}>✉️</div>
                <div style={{ flex:1 }}>
                  <div className="choice-title">Email OTP</div>
                  <div className="choice-sub">Get a 6-digit code via email</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <button className="choice-btn" onClick={() => setAuthMode('email')}>
                <div className="choice-icon" style={{ background:'rgba(155,89,182,.12)' }}>🔑</div>
                <div style={{ flex:1 }}>
                  <div className="choice-title">Email & Password</div>
                  <div className="choice-sub">Sign in or create an account</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <p style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'.78rem', color:'var(--tm)' }}>
                Joining as a driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Apply here →</Link>
              </p>
            </>
          )}

          {/* OTP FLOW */}
          {authMode === 'otp' && (
            <>
              <div className="back-row">
                <button onClick={reset} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ts)', display:'flex', padding:0 }}>
                  <ChevronLeft size={20}/>
                </button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:700 }}>
                    {otpStep === 'input' ? (otpMethod === 'phone' ? 'Your Phone Number' : 'Your Email') : 'Enter the Code'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>
                    {otpStep === 'verify'
                      ? `Sent to ${otpMethod === 'phone' ? normalizePhone(phone) : email}`
                      : "We'll send you a 6-digit code"}
                  </div>
                </div>
              </div>

              {otpStep === 'input' && (
                <form onSubmit={e => { e.preventDefault(); sendOtp() }}>
                  <div className="fg mb3">
                    <label className="label">{otpMethod === 'phone' ? 'Phone Number' : 'Email Address'}</label>
                    <div className="input-wrap">
                      {otpMethod === 'phone'
                        ? <Phone size={15} className="ico"/>
                        : <Mail size={15} className="ico"/>
                      }
                      {otpMethod === 'phone'
                        ? <input className="input" type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus/>
                        : <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus/>
                      }
                    </div>
                    {otpMethod === 'phone' && (
                      <p className="hint">Indian numbers: enter 10 digits — +91 is added automatically</p>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                    {loading ? <span className="spinner"/> : <><ArrowRight size={16}/> Send Code</>}
                  </button>
                  <button type="button" className="btn btn-ghost btn-blk mt2" style={{ fontSize:'.82rem' }}
                    onClick={() => setOtpMethod(otpMethod === 'phone' ? 'email' : 'phone')}>
                    Use {otpMethod === 'phone' ? 'Email OTP' : 'Phone OTP'} instead
                  </button>
                </form>
              )}

              {otpStep === 'verify' && (
                <form onSubmit={verifyOtp}>
                  <div className="otp-target">
                    {otpMethod === 'phone' ? '📱' : '✉️'} {otpMethod === 'phone' ? normalizePhone(phone) : email}
                  </div>
                  <p style={{ textAlign:'center', color:'var(--ts)', fontSize:'.83rem' }}>Enter the 6-digit code</p>
                  <OtpBoxes/>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading || otpStr.length !== OTP_LEN}>
                    {loading ? <span className="spinner"/> : '✦ Verify & Sign In'}
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOtpStep('input'); setOtp(Array(OTP_LEN).fill('')) }}>
                      <ChevronLeft size={13}/> Change
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={sendOtp} disabled={cooldown > 0 || loading}>
                      <RefreshCw size={13}/> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* EMAIL / PASSWORD */}
          {authMode === 'email' && (
            <>
              <div className="back-row">
                <button onClick={reset} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ts)', display:'flex', padding:0 }}>
                  <ChevronLeft size={20}/>
                </button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:700 }}>
                    {emailMode === 'login' ? 'Sign In' : 'Create Account'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>
                    {emailMode === 'login' ? 'Use your email and password' : 'Register a new account'}
                  </div>
                </div>
              </div>

              <div className="method-tabs">
                <button className={`mt-btn ${emailMode==='login'?'on':''}`}    onClick={() => setEmailMode('login')}>Sign In</button>
                <button className={`mt-btn ${emailMode==='register'?'on':''}`} onClick={() => setEmailMode('register')}>Register</button>
              </div>

              <form onSubmit={handleEmail} style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
                {emailMode === 'register' && (
                  <>
                    <div className="fg">
                      <label className="label">Full Name</label>
                      <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} required/></div>
                    </div>
                    <div className="fg">
                      <label className="label">Phone</label>
                      <div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" placeholder="+91 98765 43210" value={regPhone} onChange={e => setRegPhone(e.target.value)}/></div>
                    </div>
                  </>
                )}
                <div className="fg">
                  <label className="label">Email Address</label>
                  <div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required/></div>
                </div>
                <div className="fg">
                  <label className="label">Password</label>
                  <div className="input-wrap" style={{ position:'relative' }}>
                    <Lock size={15} className="ico"/>
                    <input className="input" type={showPw?'text':'password'} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ paddingRight:'2.8rem' }}/>
                    <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}>
                      {showPw ? <Eye size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-blk btn-lg" style={{ marginTop:'.3rem' }} disabled={loading}>
                  {loading ? <span className="spinner"/> : emailMode === 'login' ? '✦ Sign In' : '✦ Create Account'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
