import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { sendFirebaseOtp, verifyFirebaseOtp, FIREBASE_OK } from '../lib/firebase'
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const OTP_LEN = 6
const last10  = p => p.replace(/\D/g,'').slice(-10)
const fmt91   = p => `+91${last10(p)}`

export default function Login() {
  const [mode,       setMode]     = useState('choose')
  const [otpStep,    setOtpStep]  = useState('input')
  const [pwMode,     setPwMode]   = useState('login')
  const [phone,      setPhone]    = useState('')
  const [email,      setEmail]    = useState('')
  const [password,   setPassword] = useState('')
  const [name,       setName]     = useState('')
  const [regPhone,   setRegPhone] = useState('')
  const [otp,        setOtp]      = useState(Array(OTP_LEN).fill(''))
  const [showPw,     setShowPw]   = useState(false)
  const [loading,    setLoading]  = useState(false)
  const [cooldown,   setCooldown] = useState(0)
  const [confirm,    setConfirm]  = useState(null)

  const refs = useRef([])
  const { signIn, signUp, signInWithEmailOtp, verifyEmailOtp } = useAuth()
  const navigate = useNavigate()

  const startCooldown = s => {
    setCooldown(s)
    const iv = setInterval(() => setCooldown(c => { if(c<=1){clearInterval(iv);return 0}; return c-1 }), 1000)
  }

  const otpStr = otp.join('')

  const onCell = (i, val) => {
    const v = val.replace(/\D/g,'').slice(-1)
    const n = [...otp]; n[i] = v; setOtp(n)
    if (v && i < OTP_LEN-1) refs.current[i+1]?.focus()
  }
  const onKey = (i, e) => {
    if (e.key==='Backspace' && !otp[i] && i>0) refs.current[i-1]?.focus()
    if (e.key==='ArrowLeft'  && i>0)            refs.current[i-1]?.focus()
    if (e.key==='ArrowRight' && i<OTP_LEN-1)    refs.current[i+1]?.focus()
  }
  const onPaste = e => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,OTP_LEN)
    if (!p) return; e.preventDefault()
    const n = Array(OTP_LEN).fill(''); p.split('').forEach((c,i)=>{n[i]=c}); setOtp(n)
    refs.current[Math.min(p.length,OTP_LEN-1)]?.focus()
  }

  // ── Firebase Phone OTP ────────────────────────────────────────
  const sendPhoneOtp = async () => {
    const digits = last10(phone)
    if (digits.length !== 10) { toast.error('Enter a valid 10-digit number'); return }
    if (!FIREBASE_OK) { toast.error('Firebase not configured — add keys to .env'); return }
    setLoading(true)
    try {
      const result = await sendFirebaseOtp(digits, 'user-recaptcha')
      setConfirm(result)
      toast.success(`OTP sent to ${fmt91(phone)} 📱`)
      setOtpStep('verify')
      startCooldown(60)
      setTimeout(() => refs.current[0]?.focus(), 100)
    } catch (err) {
      if (err.code === 'auth/too-many-requests') toast.error('Too many attempts. Try again later.')
      else if (err.code === 'auth/invalid-phone-number') toast.error('Invalid phone number.')
      else toast.error(err.message || 'Failed to send OTP')
    }
    setLoading(false)
  }

  const verifyPhoneOtp = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter all 6 digits'); return }
    if (!confirm) { toast.error('Request OTP first'); return }
    setLoading(true)
    try {
      await verifyFirebaseOtp(confirm, otpStr)
      toast.success('Signed in! 🎉')
      navigate('/dashboard')
    } catch (err) {
      if (err.code === 'auth/invalid-verification-code') toast.error('Wrong code. Try again.')
      else if (err.code === 'auth/code-expired') {
        toast.error('Code expired. Request a new one.')
        setOtpStep('input'); setOtp(Array(OTP_LEN).fill(''))
      } else toast.error(err.message || 'Verification failed')
    }
    setLoading(false)
  }

  // ── Email OTP ─────────────────────────────────────────────────
  const sendEmailOtp = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email'); return }
    setLoading(true)
    const { error } = await signInWithEmailOtp(email)
    if (error) toast.error(error.message || 'Failed to send OTP')
    else { toast.success(`Code sent to ${email} ✉️`); setOtpStep('verify'); startCooldown(60) }
    setLoading(false)
  }

  const verifyEmailOtpFn = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter all 6 digits'); return }
    setLoading(true)
    const { error } = await verifyEmailOtp(email, otpStr)
    if (error) { toast.error('Invalid code'); setOtp(Array(OTP_LEN).fill('')); refs.current[0]?.focus() }
    else { toast.success('Signed in! 🎉'); navigate('/dashboard') }
    setLoading(false)
  }

  // ── Password ──────────────────────────────────────────────────
  const handlePassword = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (pwMode === 'login') {
        const { error } = await signIn({ email, password })
        if (error) throw error
        toast.success('Welcome back!'); navigate('/dashboard')
      } else {
        const { data, error } = await signUp({ email, password, fullName: name, phone: regPhone })
        if (error) throw error
        if (data?.user?.identities?.length === 0) throw new Error('Email already registered.')
        toast.success('Account created!'); navigate('/dashboard')
      }
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  const reset = () => { setMode('choose'); setOtpStep('input'); setOtp(Array(OTP_LEN).fill('')); setConfirm(null) }

  const OtpBoxes = () => (
    <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', margin:'1.5rem 0' }}>
      {Array(OTP_LEN).fill(null).map((_,i) => (
        <input key={`otp-${i}`} ref={el=>refs.current[i]=el}
          type="text" inputMode="numeric" maxLength={1}
          value={otp[i]||''} onChange={e=>onCell(i,e.target.value)}
          onKeyDown={e=>onKey(i,e)} onPaste={i===0?onPaste:undefined}
          className="otp-cell" style={{ borderColor:otp[i]?'var(--gold)':'var(--b1)' }}/>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', overflow:'hidden' }}>
      <style>{`
        .ll{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3rem;background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.08) 0%,transparent 60%);position:relative;}
        .ll::after{content:'';position:absolute;right:0;top:10%;bottom:10%;width:1px;background:linear-gradient(to bottom,transparent,var(--b1),transparent);}
        .lr{width:500px;display:flex;flex-direction:column;justify-content:center;padding:3rem;background:rgba(13,13,31,.6);backdrop-filter:blur(28px);}
        .lcard{background:var(--card);border:1px solid var(--b1);border-radius:22px;padding:2.4rem;box-shadow:0 24px 80px rgba(0,0,0,.6);}
        .choice{display:flex;align-items:center;gap:.9rem;width:100%;padding:1rem 1.2rem;background:rgba(255,255,255,.03);border:1px solid var(--b1);border-radius:12px;cursor:pointer;transition:all .22s;font-family:var(--fb);margin-bottom:.7rem;}
        .choice:hover{border-color:var(--b2);background:rgba(255,179,71,.04);transform:translateX(3px);}
        .ci{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0;}
        .pw-tabs{display:flex;background:rgba(255,255,255,.04);border-radius:10px;padding:4px;margin-bottom:1.5rem;border:1px solid var(--b1);}
        .pw-tab{flex:1;padding:.54rem;border:none;border-radius:7px;background:transparent;color:var(--ts);font-family:var(--fb);font-size:.85rem;font-weight:700;cursor:pointer;transition:.2s;}
        .pw-tab.on{background:linear-gradient(135deg,var(--gold),var(--orange));color:#05050e;}
        .back-btn{background:transparent;border:none;cursor:pointer;color:var(--ts);display:flex;padding:0;}
        @media(max-width:880px){.ll{display:none;}.lr{width:100%;padding:2rem 1.4rem;}}
      `}</style>

      {/* Invisible reCAPTCHA anchor — must be in DOM */}
      <div id="user-recaptcha" style={{ position:'absolute', bottom:0 }}/>

      {/* Left hero */}
      <div className="ll">
        <img src="/logo.png" alt="" style={{ width:120, marginBottom:'2rem', filter:'drop-shadow(0 0 30px rgba(255,179,71,.4))', animation:'float 4s ease-in-out infinite' }} onError={e=>e.target.style.display='none'}/>
        <h1 style={{ fontFamily:'var(--fd)', fontSize:'2.85rem', fontWeight:900, lineHeight:1.15, textAlign:'center' }}>
          Our <span className="gold">Wheels</span><br/>Take You to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:310, fontSize:'.95rem', lineHeight:1.65 }}>
          Premium campus cab service for IIT Hyderabad.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem', marginTop:'2rem', justifyContent:'center' }}>
          {['📱 Phone OTP','✉️ Email OTP','🔑 Password','📍 GPS Tracking','💰 Deposit & Save','🆘 SOS Safety'].map(p=>(
            <span key={p} style={{ background:'rgba(255,179,71,.07)', border:'1px solid var(--b1)', borderRadius:99, padding:'.38rem .9rem', fontSize:'.78rem', color:'var(--ts)' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="lr">
        <div className="lcard">

          {mode === 'choose' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700 }}>Welcome Back</div>
                <div style={{ color:'var(--ts)', fontSize:'.84rem', marginTop:'.3rem' }}>Choose how to sign in</div>
              </div>

              {[
                ['phone',    'rgba(52,152,219,.12)',  '📱', 'Phone OTP',        'Get a code via SMS to your mobile'],
                ['email',    'rgba(255,179,71,.12)',   '✉️', 'Email OTP',        'Get a code via email — no password needed'],
                ['password', 'rgba(155,89,182,.12)',   '🔑', 'Email & Password', 'Sign in or create an account'],
              ].map(([m, bg, em, title, sub]) => (
                <button key={m} className="choice" onClick={() => setMode(m)}>
                  <div className="ci" style={{ background: bg }}>{em}</div>
                  <div style={{ flex:1, textAlign:'left' }}>
                    <div style={{ fontWeight:700, color:'var(--tp)', fontSize:'.9rem' }}>{title}</div>
                    <div style={{ fontSize:'.74rem', color:'var(--tm)', marginTop:1 }}>{sub}</div>
                  </div>
                  <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
                </button>
              ))}

              <div style={{ borderTop:'1px solid var(--b1)', marginTop:'1.25rem', paddingTop:'1.1rem', display:'flex', flexDirection:'column', gap:'.4rem' }}>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>
                  New driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Apply here →</Link>
                </p>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>
                  Already a driver? <Link to="/driver" style={{ color:'var(--green)', fontWeight:700 }}>Driver Portal →</Link>
                </p>
              </div>
            </>
          )}

          {/* Phone OTP */}
          {mode === 'phone' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back-btn"><ChevronLeft size={20}/></button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>
                    {otpStep==='input' ? 'Your Phone Number' : 'Enter the Code'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>
                    {otpStep==='verify' ? `Code sent to ${fmt91(phone)}` : "We'll send an OTP to your mobile"}
                  </div>
                </div>
              </div>

              {otpStep === 'input' && (
                <form onSubmit={e=>{e.preventDefault();sendPhoneOtp()}}>
                  <div className="fg mb3">
                    <label className="label">Phone Number</label>
                    <div className="input-wrap">
                      <Phone size={15} className="ico"/>
                      <input className="input" type="tel" inputMode="numeric"
                        placeholder="+91 98765 43210" value={phone}
                        onChange={e=>setPhone(e.target.value)} required autoFocus/>
                    </div>
                    <p className="hint">10-digit Indian mobile number</p>
                  </div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                    {loading?<span className="spinner"/>:<><ArrowRight size={16}/> Send OTP</>}
                  </button>
                </form>
              )}

              {otpStep === 'verify' && (
                <form onSubmit={verifyPhoneOtp}>
                  <p style={{ textAlign:'center', color:'var(--ts)', fontSize:'.83rem' }}>Enter the 6-digit code sent to your phone</p>
                  <OtpBoxes/>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading||otpStr.length!==OTP_LEN}>
                    {loading?<span className="spinner"/>:'✦ Verify & Sign In'}
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setOtpStep('input');setOtp(Array(OTP_LEN).fill(''));setConfirm(null)}}>
                      <ChevronLeft size={13}/> Change
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={sendPhoneOtp} disabled={cooldown>0||loading}>
                      <RefreshCw size={13}/>{cooldown>0?`Resend in ${cooldown}s`:'Resend'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Email OTP */}
          {mode === 'email' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back-btn"><ChevronLeft size={20}/></button>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>
                  {otpStep==='input' ? 'Your Email' : 'Check Email'}
                </div>
              </div>
              {otpStep==='input' && (
                <form onSubmit={e=>{e.preventDefault();sendEmailOtp()}}>
                  <div className="fg mb3">
                    <label className="label">Email Address</label>
                    <div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                    {loading?<span className="spinner"/>:<><ArrowRight size={16}/> Send Code</>}
                  </button>
                </form>
              )}
              {otpStep==='verify' && (
                <form onSubmit={verifyEmailOtpFn}>
                  <div style={{ textAlign:'center', padding:'.65rem', background:'rgba(52,152,219,.07)', border:'1px solid rgba(52,152,219,.2)', borderRadius:'var(--rs)', marginBottom:'.5rem', fontWeight:700, color:'#3498db' }}>✉️ {email}</div>
                  <OtpBoxes/>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading||otpStr.length!==OTP_LEN}>
                    {loading?<span className="spinner"/>:'✦ Verify & Sign In'}
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setOtpStep('input');setOtp(Array(OTP_LEN).fill(''))}}>
                      <ChevronLeft size={13}/> Change
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={sendEmailOtp} disabled={cooldown>0||loading}>
                      <RefreshCw size={13}/>{cooldown>0?`Resend in ${cooldown}s`:'Resend'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Password */}
          {mode === 'password' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back-btn"><ChevronLeft size={20}/></button>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>{pwMode==='login'?'Sign In':'Create Account'}</div>
              </div>
              <div className="pw-tabs">
                <button className={`pw-tab ${pwMode==='login'?'on':''}`} onClick={()=>setPwMode('login')}>Sign In</button>
                <button className={`pw-tab ${pwMode==='register'?'on':''}`} onClick={()=>setPwMode('register')}>Register</button>
              </div>
              <form onSubmit={handlePassword} style={{ display:'flex', flexDirection:'column', gap:'1.05rem' }}>
                {pwMode==='register'&&(<>
                  <div className="fg"><label className="label">Full Name</label><div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/></div></div>
                  <div className="fg"><label className="label">Phone</label><div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" value={regPhone} onChange={e=>setRegPhone(e.target.value)} placeholder="+91 98765 43210"/></div></div>
                </>)}
                <div className="fg"><label className="label">Email</label><div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></div></div>
                <div className="fg">
                  <label className="label">Password</label>
                  <div className="input-wrap" style={{ position:'relative' }}>
                    <Lock size={15} className="ico"/>
                    <input className="input" type={showPw?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} style={{ paddingRight:'2.8rem' }}/>
                    <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}>
                      {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-blk btn-lg" style={{ marginTop:'.25rem' }} disabled={loading}>
                  {loading?<span className="spinner"/>:pwMode==='login'?'✦ Sign In':'✦ Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
