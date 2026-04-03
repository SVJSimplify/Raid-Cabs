import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, RefreshCw, ChevronLeft, HelpCircle, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const OTP_LEN = 6
const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favourite teacher's name?",
  "What was the model of your first phone?",
  "What is the name of your best childhood friend?",
]

export default function Login() {
  const [mode,       setMode]      = useState('choose')
  const [otpStep,    setOtpStep]   = useState('input')
  const [subMode,    setSubMode]   = useState('login')
  const [email,      setEmail]     = useState('')
  const [phone,      setPhone]     = useState('')
  const [password,   setPassword]  = useState('')
  const [name,       setName]      = useState('')
  const [showPw,     setShowPw]    = useState(false)
  const [loading,    setLoading]   = useState(false)
  const [cooldown,   setCooldown]  = useState(0)
  const [otp,        setOtp]       = useState(Array(OTP_LEN).fill(''))
  const [secQ,       setSecQ]      = useState(SECURITY_QUESTIONS[0])
  const [secA,       setSecA]      = useState('')
  const [forgotStep, setForgotStep]= useState('input') // input | security | done
  const [forgotId,   setForgotId]  = useState('')     // email or phone
  const [forgotSecQ, setForgotSecQ]= useState('')
  const [forgotSecA, setForgotSecA]= useState('')

  const refs = useRef([])
  const {
    signIn, signUp, signInWithPhone, signUpWithPhone,
    signInWithEmailOtp, verifyEmailOtp, signInWithGoogle, sendPasswordReset,
  } = useAuth()
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
  }
  const onPaste = e => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,OTP_LEN)
    if (!p) return; e.preventDefault()
    const n = Array(OTP_LEN).fill(''); p.split('').forEach((c,i)=>{n[i]=c})
    setOtp(n); refs.current[Math.min(p.length,OTP_LEN-1)]?.focus()
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { toast.error(error.message); setLoading(false) }
    // On success, Supabase redirects to /dashboard automatically
  }

  const sendEmailOtp = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email'); return }
    setLoading(true)
    const { error } = await signInWithEmailOtp(email)
    if (error) toast.error(error.message || 'Could not send code')
    else { toast.success(`Code sent to ${email} ✉️`); setOtpStep('verify'); startCooldown(60); setTimeout(()=>refs.current[0]?.focus(),100) }
    setLoading(false)
  }

  const verifyEmailOtpFn = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter all 6 digits'); return }
    setLoading(true)
    const { error } = await verifyEmailOtp(email, otpStr)
    if (error) { toast.error('Invalid code — try again'); setOtp(Array(OTP_LEN).fill('')); refs.current[0]?.focus() }
    else { toast.success('Signed in! 🎉'); navigate('/dashboard') }
    setLoading(false)
  }

  const handlePhone = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (subMode === 'login') {
        const { error } = await signInWithPhone({ phone, password })
        if (error) throw error
        toast.success('Welcome back!'); navigate('/dashboard')
      } else {
        if (!name.trim()) throw new Error('Enter your full name')
        if (!secA.trim()) throw new Error('Answer your security question')
        const { error } = await signUpWithPhone({ phone, password, fullName:name, securityQuestion:secQ, securityAnswer:secA })
        if (error) throw error
        toast.success('Account created! 🎉 Check your profile for your Ride Code.')
        navigate('/dashboard')
      }
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  const handleEmail = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (subMode === 'login') {
        const { error } = await signIn({ email, password })
        if (error) throw error
        toast.success('Welcome back!'); navigate('/dashboard')
      } else {
        if (!name.trim()) throw new Error('Enter your full name')
        if (!secA.trim()) throw new Error('Answer your security question')
        const { data, error } = await signUp({ email, password, fullName:name, securityQuestion:secQ, securityAnswer:secA })
        if (error) throw error
        if (data?.user?.identities?.length === 0) throw new Error('Email already registered.')
        toast.success('Account created! 🎉')
        navigate('/dashboard')
      }
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  const handleForgot = async e => {
    e.preventDefault()
    const isEmail = forgotId.includes('@')
    setLoading(true)
    if (isEmail) {
      // Email users: Supabase sends a reset link
      const { error } = await sendPasswordReset(forgotId)
      if (error) toast.error(error.message)
      else { toast.success('Password reset link sent to your email ✉️'); setForgotStep('done') }
      setLoading(false)
      return
    }
    // Phone users: check security question
    const digits = forgotId.replace(/\D/g,'').slice(-10)
    const { data: prof } = await supabase
      .from('profiles').select('security_question,security_answer').ilike('phone', `%${digits}`).maybeSingle()
    if (!prof?.security_question) {
      toast.error('No account found for this phone number.')
      setLoading(false); return
    }
    setForgotSecQ(prof.security_question)
    setForgotStep('security')
    setLoading(false)
  }

  const handleForgotVerify = async e => {
    e.preventDefault(); setLoading(true)
    const digits = forgotId.replace(/\D/g,'').slice(-10)
    const { data: prof } = await supabase.from('profiles').select('security_answer').ilike('phone',`%${digits}`).maybeSingle()
    if (!prof || prof.security_answer !== forgotSecA.toLowerCase().trim()) {
      toast.error('Wrong answer. Try again.')
      setLoading(false); return
    }
    toast.success('Identity verified! Contact admin to reset your phone account password, or use Email OTP to sign in.')
    setForgotStep('done')
    setLoading(false)
  }

  const reset = () => { setMode('choose'); setOtpStep('input'); setOtp(Array(OTP_LEN).fill('')); setSubMode('login') }

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

  const Tabs = ({ onChange }) => (
    <div style={{ display:'flex', background:'rgba(255,255,255,.04)', borderRadius:10, padding:4, marginBottom:'1.5rem', border:'1px solid var(--b1)' }}>
      {['login','register'].map(m => (
        <button key={m} onClick={() => { setSubMode(m); onChange?.() }}
          style={{ flex:1, padding:'.54rem', border:'none', borderRadius:7, fontFamily:'var(--fb)', fontSize:'.85rem', fontWeight:700, cursor:'pointer', transition:'.2s', background:subMode===m?'linear-gradient(135deg,var(--gold),var(--orange))':'transparent', color:subMode===m?'#05050e':'var(--ts)' }}>
          {m==='login'?'Sign In':'Register'}
        </button>
      ))}
    </div>
  )

  const SecurityFields = () => (
    <div style={{ background:'rgba(74,144,217,.06)', border:'1px solid rgba(74,144,217,.15)', borderRadius:'var(--rs)', padding:'1rem', marginBottom:'.5rem' }}>
      <div style={{ fontSize:'.74rem', fontWeight:700, color:'var(--blue)', marginBottom:'.65rem', display:'flex', alignItems:'center', gap:5 }}>
        <HelpCircle size={12}/> Security Question (used to recover account)
      </div>
      <div className="fg mb2">
        <label className="label">Question</label>
        <select className="input" value={secQ} onChange={e=>setSecQ(e.target.value)} style={{ paddingLeft:'.85rem' }}>
          {SECURITY_QUESTIONS.map(q=><option key={q} value={q}>{q}</option>)}
        </select>
      </div>
      <div className="fg">
        <label className="label">Your Answer</label>
        <input className="input" type="text" placeholder="Your answer" value={secA} onChange={e=>setSecA(e.target.value)} required/>
        <p className="hint">Case-insensitive. Remember this!</p>
      </div>
    </div>
  )

  const PwField = () => (
    <div className="fg">
      <label className="label">Password</label>
      <div className="input-wrap" style={{ position:'relative' }}>
        <Lock size={15} className="ico"/>
        <input className="input" type={showPw?'text':'password'} placeholder="Min. 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} style={{ paddingRight:'2.8rem' }}/>
        <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex', padding:0 }}>
          {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', overflow:'hidden' }}>
      <style>{`
        .ll{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3rem;background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(255,179,71,.06) 0%,transparent 50%);position:relative;}
        .ll::after{content:'';position:absolute;right:0;top:10%;bottom:10%;width:1px;background:linear-gradient(to bottom,transparent,var(--b1),transparent);}
        .lr{width:500px;display:flex;flex-direction:column;justify-content:center;padding:3rem;background:rgba(13,13,31,.6);backdrop-filter:blur(28px);overflow-y:auto;max-height:100vh;}
        .lcard{background:var(--card);border:1px solid var(--b1);border-radius:22px;padding:2.4rem;box-shadow:0 24px 80px rgba(0,0,0,.6);}
        .choice{display:flex;align-items:center;gap:.9rem;width:100%;padding:1rem 1.2rem;background:rgba(255,255,255,.03);border:1px solid var(--b1);border-radius:12px;cursor:pointer;transition:all .22s;font-family:var(--fb);margin-bottom:.7rem;}
        .choice:hover{border-color:var(--b2);background:rgba(255,179,71,.04);transform:translateX(3px);}
        .ci{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;}
        .back{background:transparent;border:none;cursor:pointer;color:var(--ts);display:flex;padding:0;}
        .google-btn{width:100%;padding:.78rem;background:#fff;color:#1f1f1f;border:1px solid #e0e0e0;border-radius:10px;font-family:var(--fb);font-size:.92rem;font-weight:600;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:9px;}
        .google-btn:hover:not(:disabled){background:#f5f5f5;box-shadow:0 2px 12px rgba(0,0,0,.12);}
        .google-btn:disabled{opacity:.5;cursor:not-allowed;}
        @media(max-width:880px){.ll{display:none;}.lr{width:100%;padding:2rem 1.4rem;max-height:none;}}
      `}</style>

      <div className="ll">
        <img src="/logo.png" alt="" style={{ width:120, marginBottom:'2rem', filter:'drop-shadow(0 0 30px rgba(255,179,71,.4))', animation:'float 4s ease-in-out infinite' }} onError={e=>e.target.style.display='none'}/>
        <h1 style={{ fontFamily:'var(--fd)', fontSize:'2.85rem', fontWeight:900, lineHeight:1.15, textAlign:'center', maxWidth:380 }}>
          Our <span className="gold">Wheels</span><br/>Take You to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:310, fontSize:'.95rem', lineHeight:1.65 }}>
          Premium campus cab service for IIT Hyderabad.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem', marginTop:'2rem', justifyContent:'center' }}>
          {['📱 Phone Login','✉️ Email OTP','🆔 Ride Code','📍 Live Tracking','🆘 SOS Safety','🔵 Google (Soon)'].map(p=>(
            <span key={p} style={{ background:'rgba(255,179,71,.07)', border:'1px solid var(--b1)', borderRadius:99, padding:'.38rem .9rem', fontSize:'.78rem', color:'var(--ts)' }}>{p}</span>
          ))}
        </div>
      </div>

      <div className="lr">
        <div className="lcard">

          {/* CHOOSE */}
          {mode==='choose' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700 }}>Welcome</div>
                <div style={{ color:'var(--ts)', fontSize:'.84rem', marginTop:'.3rem' }}>Sign in to book your ride</div>
              </div>

              {/* Google */}
              <div style={{ position:'relative', marginBottom:'1rem' }}>
                <button className="google-btn" disabled style={{ opacity:.45, cursor:'not-allowed', position:'relative' }}>
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.86.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.86.92 7.5 2.56 10.72l7.12-5.7-.02-.01z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7C13.42 14.62 18.27 10.75 24 10.75z"/></svg>
                  Continue with Google
                </button>
                <span style={{ position:'absolute', top:'50%', right:'.85rem', transform:'translateY(-50%)', fontSize:'.68rem', fontWeight:700, background:'rgba(245,166,35,.12)', color:'var(--gold)', border:'1px solid rgba(245,166,35,.25)', borderRadius:99, padding:'2px 8px', pointerEvents:'none' }}>
                  Coming Soon
                </span>
              </div>

              <div className="divider mb3">or</div>

              <button className="choice" onClick={()=>setMode('phone')} style={{ borderColor:'rgba(0,200,150,.2)', background:'rgba(0,200,150,.03)' }}>
                <div className="ci" style={{ background:'rgba(0,200,150,.12)' }}>📱</div>
                <div style={{ flex:1, textAlign:'left' }}>
                  <div style={{ fontWeight:700, color:'var(--tp)', fontSize:'.9rem' }}>Phone + Password <span style={{ marginLeft:6, fontSize:'.65rem', background:'rgba(0,200,150,.1)', color:'var(--green)', border:'1px solid rgba(0,200,150,.2)', borderRadius:99, padding:'1px 6px' }}>No email</span></div>
                  <div style={{ fontSize:'.74rem', color:'var(--tm)', marginTop:1 }}>Use your mobile number as your ID</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <button className="choice" onClick={()=>setMode('email-otp')}>
                <div className="ci" style={{ background:'rgba(52,152,219,.12)' }}>✉️</div>
                <div style={{ flex:1, textAlign:'left' }}>
                  <div style={{ fontWeight:700, color:'var(--tp)', fontSize:'.9rem' }}>Email OTP</div>
                  <div style={{ fontSize:'.74rem', color:'var(--tm)', marginTop:1 }}>6-digit code to your email, no password</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <button className="choice" onClick={()=>setMode('email-pw')}>
                <div className="ci" style={{ background:'rgba(155,89,182,.12)' }}>🔑</div>
                <div style={{ flex:1, textAlign:'left' }}>
                  <div style={{ fontWeight:700, color:'var(--tp)', fontSize:'.9rem' }}>Email + Password</div>
                  <div style={{ fontSize:'.74rem', color:'var(--tm)', marginTop:1 }}>Traditional login with email and password</div>
                </div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <div style={{ borderTop:'1px solid var(--b1)', marginTop:'1.25rem', paddingTop:'1.1rem', display:'flex', flexDirection:'column', gap:'.4rem' }}>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>New driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Apply here →</Link></p>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>Driver? <Link to="/driver" style={{ color:'var(--green)', fontWeight:700 }}>Driver login →</Link></p>
              </div>
            </>
          )}

          {/* PHONE */}
          {mode==='phone' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back"><ChevronLeft size={20}/></button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>{subMode==='login'?'Phone Sign In':'Create Account'}</div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>No email required</div>
                </div>
              </div>
              <Tabs onChange={()=>setPassword('')}/>
              <form onSubmit={handlePhone} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {subMode==='register' && <div className="fg"><label className="label">Full Name</label><div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Your full name" value={name} onChange={e=>setName(e.target.value)} required/></div></div>}
                <div className="fg"><label className="label">Phone Number</label><div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" inputMode="numeric" placeholder="98765 43210" value={phone} onChange={e=>setPhone(e.target.value)} required/></div><p className="hint">10-digit Indian mobile number</p></div>
                <PwField/>
                {subMode==='register' && <SecurityFields/>}
                {subMode==='login' && <button type="button" onClick={()=>{setForgotId(phone);setMode('forgot');setForgotStep('input')}} style={{ alignSelf:'flex-end', background:'transparent', border:'none', color:'var(--gold)', fontSize:'.78rem', cursor:'pointer', fontFamily:'var(--fb)', marginTop:'-.5rem' }}>Forgot password?</button>}
                <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>{loading?<span className="spinner"/>:subMode==='login'?'✦ Sign In':'✦ Create Account'}</button>
              </form>
            </>
          )}

          {/* EMAIL OTP */}
          {mode==='email-otp' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back"><ChevronLeft size={20}/></button>
                <div><div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>{otpStep==='input'?'Your Email':'Check Email'}</div><div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>{otpStep==='verify'?`Code sent to ${email}`:'We\'ll email you a 6-digit code'}</div></div>
              </div>
              {otpStep==='input' && <form onSubmit={e=>{e.preventDefault();sendEmailOtp()}}><div className="fg mb3"><label className="label">Email Address</label><div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></div></div><button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>{loading?<span className="spinner"/>:<><ArrowRight size={16}/> Send Code</>}</button></form>}
              {otpStep==='verify' && <form onSubmit={verifyEmailOtpFn}><div style={{ textAlign:'center', padding:'.65rem', background:'rgba(52,152,219,.08)', border:'1px solid rgba(52,152,219,.2)', borderRadius:'var(--rs)', marginBottom:'.5rem', fontWeight:700, color:'#3498db' }}>✉️ {email}</div><OtpBoxes/><button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading||otpStr.length!==OTP_LEN}>{loading?<span className="spinner"/>:'✦ Verify & Sign In'}</button><div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}><button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setOtpStep('input');setOtp(Array(OTP_LEN).fill(''))}}><ChevronLeft size={13}/> Change</button><button type="button" className="btn btn-ghost btn-sm" onClick={sendEmailOtp} disabled={cooldown>0||loading}><RefreshCw size={13}/> {cooldown>0?`Resend in ${cooldown}s`:'Resend'}</button></div></form>}
            </>
          )}

          {/* EMAIL + PASSWORD */}
          {mode==='email-pw' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back"><ChevronLeft size={20}/></button>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>{subMode==='login'?'Sign In':'Create Account'}</div>
              </div>
              <Tabs/>
              <form onSubmit={handleEmail} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {subMode==='register' && <div className="fg"><label className="label">Full Name</label><div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} required/></div></div>}
                <div className="fg"><label className="label">Email</label><div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div></div>
                <PwField/>
                {subMode==='register' && <SecurityFields/>}
                {subMode==='login' && <button type="button" onClick={()=>{setForgotId(email);setMode('forgot');setForgotStep('input')}} style={{ alignSelf:'flex-end', background:'transparent', border:'none', color:'var(--gold)', fontSize:'.78rem', cursor:'pointer', fontFamily:'var(--fb)', marginTop:'-.5rem' }}>Forgot password?</button>}
                <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>{loading?<span className="spinner"/>:subMode==='login'?'✦ Sign In':'✦ Create Account'}</button>
              </form>
            </>
          )}

          {/* FORGOT PASSWORD */}
          {mode==='forgot' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back"><ChevronLeft size={20}/></button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>Recover Account</div>
                  <div style={{ color:'var(--ts)', fontSize:'.82rem', marginTop:2 }}>{forgotStep==='input'?'Enter your email or phone':forgotStep==='security'?'Answer your security question':'All done!'}</div>
                </div>
              </div>

              {forgotStep==='input' && (
                <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <div className="fg"><label className="label">Email or Phone Number</label><div className="input-wrap"><KeyRound size={15} className="ico"/><input className="input" type="text" placeholder="you@email.com or 9876543210" value={forgotId} onChange={e=>setForgotId(e.target.value)} required autoFocus/></div></div>
                  <div className="info-box" style={{ fontSize:'.8rem' }}><HelpCircle size={13} style={{ flexShrink:0 }}/> Email → we send a reset link. Phone → we check your security question.</div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>{loading?<span className="spinner"/>:<><ArrowRight size={16}/> Continue</>}</button>
                </form>
              )}

              {forgotStep==='security' && (
                <form onSubmit={handleForgotVerify} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <div className="card" style={{ padding:'1rem', background:'rgba(255,179,71,.05)', borderColor:'rgba(255,179,71,.2)' }}>
                    <div style={{ fontSize:'.73rem', color:'var(--ts)', marginBottom:'.4rem' }}>Your security question:</div>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>{forgotSecQ}</div>
                  </div>
                  <div className="fg"><label className="label">Your Answer</label><input className="input" type="text" placeholder="Your answer" value={forgotSecA} onChange={e=>setForgotSecA(e.target.value)} required autoFocus/><p className="hint">Case-insensitive</p></div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>{loading?<span className="spinner"/>:'Verify & Continue'}</button>
                </form>
              )}

              {forgotStep==='done' && (
                <div style={{ textAlign:'center', padding:'1rem 0' }}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
                  <div style={{ fontFamily:'var(--fd)', fontWeight:700, fontSize:'1.1rem', marginBottom:'.5rem' }}>Done!</div>
                  <p style={{ color:'var(--ts)', fontSize:'.85rem', lineHeight:1.65 }}>
                    {forgotId.includes('@') ? 'Check your email for a password reset link.' : 'Identity verified. Contact admin or use Email OTP to sign in.'}
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop:'1.25rem' }} onClick={reset}>Back to Sign In</button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
