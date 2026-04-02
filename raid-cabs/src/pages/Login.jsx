import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Phone, Mail, Lock, User, Eye, EyeOff, Shield, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const normalizePhone = raw => {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (raw.trim().startsWith('+')) return raw.trim()
  return `+91${digits}`
}

const OTP_LENGTH = 6

export default function Login() {
  const [userType,  setUserType]  = useState('user')
  const [authMode,  setAuthMode]  = useState('choose')
  const [otpMethod, setOtpMethod] = useState(null)
  const [otpStep,   setOtpStep]   = useState('input')
  const [emailMode, setEmailMode] = useState('login')

  const [phone,    setPhone]    = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [otpCode,  setOtpCode]  = useState(Array(OTP_LENGTH).fill(''))
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const otpRefs = useRef([])
  const { sendPhoneOtp, verifyPhoneOtp, signInWithEmailOtp, verifyEmailOtp, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const startCooldown = secs => {
    setCooldown(secs)
    const iv = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 }), 1000)
  }

  const otpString = otpCode.join('')

  const handleOtpCellChange = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otpCode]
    next[i] = v
    setOtpCode(next)
    if (v && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpCellKey = (i, e) => {
    if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft'  && i > 0)              otpRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpPaste = e => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    e.preventDefault()
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setOtpCode(next)
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const sendOtp = async () => {
    setLoading(true)
    if (otpMethod === 'phone') {
      const formatted = normalizePhone(phone)
      const { error } = await sendPhoneOtp(formatted)
      if (error) {
        toast.error(error.message?.includes('not supported') || error.message?.includes('provider')
          ? 'Phone OTP is not enabled. Use Email OTP or Password instead.'
          : error.message)
        setLoading(false)
        return
      }
      toast.success(`OTP sent to ${formatted}`)
    } else {
      const { error } = await signInWithEmailOtp(email)
      if (error) {
        toast.error(error.message)
        setLoading(false)
        return
      }
      toast.success(`OTP sent to ${email}`)
    }
    setOtpStep('verify')
    startCooldown(60)
    setLoading(false)
  }

  const verifyOtp = async e => {
    e.preventDefault()
    if (otpString.length !== OTP_LENGTH) { toast.error('Enter the full 6-digit code'); return }
    setLoading(true)
    let error
    if (otpMethod === 'phone') {
      ;({ error } = await verifyPhoneOtp(normalizePhone(phone), otpString))
    } else {
      ;({ error } = await verifyEmailOtp(email, otpString))
    }
    if (error) {
      toast.error('Invalid code. Check and try again.')
      setOtpCode(Array(OTP_LENGTH).fill(''))
      otpRefs.current[0]?.focus()
    } else {
      toast.success('Verified! Welcome 🎉')
      navigate(userType === 'admin' ? '/ops' : '/dashboard')
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
        navigate(userType === 'admin' ? '/ops' : '/dashboard')
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
    setAuthMode('choose'); setOtpMethod(null); setOtpStep('input')
    setOtpCode(Array(OTP_LENGTH).fill('')); setPhone(''); setEmail('')
  }

  const OtpBoxes = () => (
    <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'center', margin: '1.5rem 0' }}>
      {Array(OTP_LENGTH).fill(null).map((_, i) => (
        <input
          key={`otp-cell-${i}`}
          ref={el => otpRefs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={otpCode[i] || ''}
          onChange={e => handleOtpCellChange(i, e.target.value)}
          onKeyDown={e => handleOtpCellKey(i, e)}
          onPaste={i === 0 ? handleOtpPaste : undefined}
          className="otp-cell"
          style={{ borderColor: otpCode[i] ? 'var(--gold)' : 'var(--b1)' }}
        />
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', overflow: 'hidden' }}>
      <style>{`
        .ll { flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:3rem; position:relative; background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.09) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(255,179,71,.07) 0%,transparent 50%); }
        .ll::after { content:''; position:absolute; right:0; top:10%; bottom:10%; width:1px; background:linear-gradient(to bottom,transparent,var(--b1),transparent); }
        .hero-logo { width:130px; margin-bottom:2rem; filter:drop-shadow(0 0 32px rgba(255,179,71,.42)); animation:float 4s ease-in-out infinite; }
        .tagline { font-family:var(--fd); font-size:2.9rem; font-weight:900; line-height:1.15; text-align:center; max-width:400px; }
        .pills { display:flex; flex-wrap:wrap; gap:.65rem; margin-top:2.25rem; justify-content:center; }
        .pill { display:flex; align-items:center; gap:5px; background:rgba(255,179,71,.07); border:1px solid var(--b1); border-radius:99px; padding:.4rem .9rem; font-size:.79rem; color:var(--ts); }
        .lr { width:500px; display:flex; flex-direction:column; justify-content:center; padding:3rem; background:rgba(13,13,31,.65); backdrop-filter:blur(24px); }
        .lcard { background:var(--card); border:1px solid var(--b1); border-radius:22px; padding:2.35rem; box-shadow:0 24px 80px rgba(0,0,0,.55); }
        .type-row { display:flex; gap:.65rem; margin-bottom:1.6rem; }
        .type-opt { flex:1; padding:.82rem .7rem; border-radius:12px; cursor:pointer; text-align:center; border:1px solid var(--b1); background:transparent; transition:all var(--t); font-family:var(--fb); font-weight:700; font-size:.84rem; color:var(--tm); }
        .type-opt em { font-size:1.35rem; font-style:normal; display:block; margin-bottom:.22rem; }
        .type-opt.tu { border-color:rgba(52,152,219,.45); background:rgba(52,152,219,.08); color:var(--blue); }
        .type-opt.ta { border-color:rgba(255,179,71,.45); background:rgba(255,179,71,.08); color:var(--gold); }
        .choice-btn { display:flex; align-items:center; gap:.9rem; width:100%; padding:1rem 1.25rem; background:rgba(255,255,255,.03); border:1px solid var(--b1); border-radius:12px; cursor:pointer; transition:all var(--t); font-family:var(--fb); margin-bottom:.75rem; }
        .choice-btn:hover { border-color:var(--b2); background:rgba(255,179,71,.05); }
        .choice-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }
        .choice-label { text-align:left; flex:1; }
        .choice-title { font-weight:700; color:var(--tp); font-size:.9rem; }
        .choice-sub { font-size:.76rem; color:var(--tm); margin-top:1px; }
        .method-tabs { display:flex; background:rgba(255,255,255,.04); border-radius:10px; padding:4px; margin-bottom:1.6rem; border:1px solid var(--b1); }
        .mt-btn { flex:1; padding:.56rem; border:none; border-radius:7px; background:transparent; color:var(--ts); font-family:var(--fb); font-size:.86rem; font-weight:700; cursor:pointer; transition:var(--t); }
        .mt-btn.on { background:linear-gradient(135deg,var(--gold),var(--orange)); color:#05050e; }
        .otp-target { text-align:center; padding:.75rem; background:rgba(255,179,71,.07); border:1px solid var(--b2); border-radius:var(--rs); margin-bottom:.5rem; font-weight:700; color:var(--gold); font-size:.92rem; }
        @media(max-width:900px) { .ll { display:none; } .lr { width:100%; padding:2rem 1.4rem; } }
      `}</style>

      {/* Left hero */}
      <div className="ll">
        <img src="/logo.png" alt="Raid Cabs" className="hero-logo" onError={e => e.target.style.display='none'}/>
        <h1 className="tagline">
          Our <span className="gold">Wheels</span><br/>Take You<br/>to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:330, fontSize:'.97rem', lineHeight:1.65 }}>
          Premium campus cab service connecting IIT routes — reliable, affordable, always on time.
        </p>
        <div className="pills">
          {[['📱','Phone OTP'],['✉️','Email OTP'],['🛣️','Real Road Distance'],['💰','Deposit & Save'],['⭐','Rate Driver'],['🆘','SOS'],['📋','Receipts'],['🛡️','Admin Portal']].map(([ic,lb]) => (
            <span key={lb} className="pill">{ic} {lb}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="lr">
        <div className="lcard">

          {/* User type toggle */}
          <div className="type-row">
            <button className={`type-opt ${userType==='user'?'tu':''}`} onClick={() => setUserType('user')}><em>🧑‍💼</em>Passenger</button>
            <button className={`type-opt ${userType==='admin'?'ta':''}`} onClick={() => { setUserType('admin'); setAuthMode('email') }}><em>🛡️</em>Admin</button>
          </div>

          {/* ── CHOOSE AUTH METHOD ─────────────────────── */}
          {userType === 'user' && authMode === 'choose' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700 }}>Sign In</div>
                <div style={{ color:'var(--ts)', fontSize:'.84rem', marginTop:'.3rem' }}>Choose how to sign in</div>
              </div>

              <button className="choice-btn" onClick={() => { setAuthMode('otp'); setOtpMethod('phone') }}>
                <div className="choice-icon" style={{ background:'rgba(46,204,113,.12)' }}>📱</div>
                <div className="choice-label">
                  <div className="choice-title">Phone OTP</div>
                  <div className="choice-sub">Get a 6-digit code via SMS</div>
                </div>
                <ArrowRight size={15} style={{ color:'var(--tm)' }}/>
              </button>

              <button className="choice-btn" onClick={() => { setAuthMode('otp'); setOtpMethod('email') }}>
                <div className="choice-icon" style={{ background:'rgba(52,152,219,.12)' }}>✉️</div>
                <div className="choice-label">
                  <div className="choice-title">Email OTP</div>
                  <div className="choice-sub">Get a 6-digit code via email</div>
                </div>
                <ArrowRight size={15} style={{ color:'var(--tm)' }}/>
              </button>

              <button className="choice-btn" onClick={() => setAuthMode('email')}>
                <div className="choice-icon" style={{ background:'rgba(155,89,182,.12)' }}>🔑</div>
                <div className="choice-label">
                  <div className="choice-title">Email & Password</div>
                  <div className="choice-sub">Sign in or create an account</div>
                </div>
                <ArrowRight size={15} style={{ color:'var(--tm)' }}/>
              </button>

              <p style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'.78rem', color:'var(--tm)' }}>
                Driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Register here →</Link>
              </p>
            </>
          )}

          {/* ── OTP FLOW ───────────────────────────────── */}
          {authMode === 'otp' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ts)', display:'flex', padding:0 }}>
                  <ChevronLeft size={20}/>
                </button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:700 }}>
                    {otpStep === 'input' ? (otpMethod === 'phone' ? 'Enter Your Phone' : 'Enter Your Email') : 'Enter the Code'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>
                    {otpStep === 'verify' ? `Sent to ${otpMethod === 'phone' ? normalizePhone(phone) : email}` : 'We\'ll send you a 6-digit code'}
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
                        ? <input className="input" type="tel" placeholder="+91 98765 43210 or 9876543210" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus/>
                        : <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus/>
                      }
                    </div>
                    {otpMethod === 'phone' && (
                      <p className="hint">Indian numbers: enter 10 digits — +91 added automatically.</p>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                    {loading ? <span className="spinner"/> : <><ArrowRight size={16}/> Send Code</>}
                  </button>
                  <button type="button" className="btn btn-ghost btn-blk mt2" style={{ fontSize:'.83rem' }}
                    onClick={() => { setOtpMethod(otpMethod === 'phone' ? 'email' : 'phone') }}>
                    Use {otpMethod === 'phone' ? 'Email OTP' : 'Phone OTP'} instead
                  </button>
                </form>
              )}

              {otpStep === 'verify' && (
                <form onSubmit={verifyOtp}>
                  <div className="otp-target">
                    {otpMethod === 'phone' ? '📱' : '✉️'} {otpMethod === 'phone' ? normalizePhone(phone) : email}
                  </div>
                  <p style={{ textAlign:'center', color:'var(--ts)', fontSize:'.83rem', marginBottom:0 }}>Enter the 6-digit code below</p>
                  <OtpBoxes/>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading || otpString.length !== OTP_LENGTH}>
                    {loading ? <span className="spinner"/> : '✦ Verify & Sign In'}
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOtpStep('input'); setOtpCode(Array(OTP_LENGTH).fill('')) }}>
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

          {/* ── EMAIL / PASSWORD FLOW ──────────────────── */}
          {authMode === 'email' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                {userType === 'user' && (
                  <button onClick={reset} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--ts)', display:'flex', padding:0 }}>
                    <ChevronLeft size={20}/>
                  </button>
                )}
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:700 }}>
                    {userType === 'admin' ? 'Admin Sign In' : emailMode === 'login' ? 'Sign In' : 'Create Account'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>
                    {userType === 'admin' ? 'Enter your admin credentials' : 'Use email and password'}
                  </div>
                </div>
              </div>

              {userType === 'user' && (
                <div className="method-tabs">
                  <button className={`mt-btn ${emailMode==='login'?'on':''}`} onClick={() => setEmailMode('login')}>Sign In</button>
                  <button className={`mt-btn ${emailMode==='register'?'on':''}`} onClick={() => setEmailMode('register')}>Register</button>
                </div>
              )}

              <form onSubmit={handleEmail} style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
                {emailMode === 'register' && userType === 'user' && (
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
                  <label className="label">Email</label>
                  <div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required/></div>
                </div>
                <div className="fg">
                  <label className="label">Password</label>
                  <div className="input-wrap" style={{ position:'relative' }}>
                    <Lock size={15} className="ico"/>
                    <input className="input" type={showPw?'text':'password'} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ paddingRight:'2.8rem' }}/>
                    <button type="button" onClick={() => setShowPw(v=>!v)} style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}>
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-blk btn-lg" style={{ marginTop:'.3rem' }} disabled={loading}>
                  {loading ? <span className="spinner"/> : userType==='admin' ? <><Shield size={15}/> Enter Admin Portal</> : emailMode==='login' ? '✦ Sign In' : '✦ Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
