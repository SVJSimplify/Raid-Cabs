import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const OTP_LEN = 6

export default function Login() {
  const [mode,     setMode]     = useState('choose')   // choose|otp|password
  const [otpStep,  setOtpStep]  = useState('input')    // input|verify
  const [pwMode,   setPwMode]   = useState('login')    // login|register
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [otp,      setOtp]      = useState(Array(OTP_LEN).fill(''))
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const refs = useRef([])
  const { signIn, signUp, signInWithEmailOtp, verifyEmailOtp } = useAuth()
  const navigate = useNavigate()

  const startCooldown = s => {
    setCooldown(s)
    const iv = setInterval(() => setCooldown(c => { if(c<=1){clearInterval(iv);return 0} return c-1 }), 1000)
  }

  const otpStr = otp.join('')

  const handleCell = (i, val) => {
    const v = val.replace(/\D/g,'').slice(-1)
    const n = [...otp]; n[i] = v; setOtp(n)
    if (v && i < OTP_LEN-1) refs.current[i+1]?.focus()
  }

  const handleKey = (i, e) => {
    if (e.key==='Backspace' && !otp[i] && i>0) refs.current[i-1]?.focus()
    if (e.key==='ArrowLeft'  && i>0)            refs.current[i-1]?.focus()
    if (e.key==='ArrowRight' && i<OTP_LEN-1)    refs.current[i+1]?.focus()
  }

  const handlePaste = e => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,OTP_LEN)
    if (!p) return
    e.preventDefault()
    const n = Array(OTP_LEN).fill('')
    p.split('').forEach((c,i) => { n[i]=c })
    setOtp(n)
    refs.current[Math.min(p.length,OTP_LEN-1)]?.focus()
  }

  const sendOtp = async () => {
    if (!email.includes('@')) { toast.error('Enter a valid email address'); return }
    setLoading(true)
    const { error } = await signInWithEmailOtp(email)
    if (error) {
      toast.error(error.message || 'Failed to send OTP')
    } else {
      toast.success(`Code sent to ${email}`)
      setOtpStep('verify')
      startCooldown(60)
    }
    setLoading(false)
  }

  const verifyOtp = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter all 6 digits'); return }
    setLoading(true)
    const { error } = await verifyEmailOtp(email, otpStr)
    if (error) {
      toast.error('Invalid code — check your email and try again')
      setOtp(Array(OTP_LEN).fill(''))
      refs.current[0]?.focus()
    } else {
      toast.success('Signed in! 🎉')
      navigate('/dashboard')
    }
    setLoading(false)
  }

  const handlePassword = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (pwMode === 'login') {
        const { error } = await signIn({ email, password })
        if (error) throw error
        toast.success('Welcome back!')
        navigate('/dashboard')
      } else {
        const { data, error } = await signUp({ email, password, fullName: name, phone })
        if (error) throw error
        if (data?.user?.identities?.length === 0) throw new Error('Email already registered. Try signing in.')
        toast.success('Account created!')
        navigate('/dashboard')
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  const reset = () => { setMode('choose'); setOtpStep('input'); setOtp(Array(OTP_LEN).fill('')) }

  const OtpBoxes = () => (
    <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', margin:'1.5rem 0' }}>
      {Array(OTP_LEN).fill(null).map((_,i) => (
        <input key={`otp-${i}`}
          ref={el => refs.current[i]=el}
          type="text" inputMode="numeric" maxLength={1}
          value={otp[i]||''} onChange={e=>handleCell(i,e.target.value)}
          onKeyDown={e=>handleKey(i,e)} onPaste={i===0?handlePaste:undefined}
          className="otp-cell"
          style={{ borderColor: otp[i]?'var(--gold)':'var(--b1)' }}
        />
      ))}
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', overflow:'hidden' }}>
      <style>{`
        .ll{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3rem;background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(255,179,71,.06) 0%,transparent 50%);position:relative;}
        .ll::after{content:'';position:absolute;right:0;top:10%;bottom:10%;width:1px;background:linear-gradient(to bottom,transparent,var(--b1),transparent);}
        .lr{width:500px;display:flex;flex-direction:column;justify-content:center;padding:3rem;background:rgba(13,13,31,.6);backdrop-filter:blur(28px);}
        .lcard{background:var(--card);border:1px solid var(--b1);border-radius:22px;padding:2.4rem;box-shadow:0 24px 80px rgba(0,0,0,.6);}
        .choice{display:flex;align-items:center;gap:.9rem;width:100%;padding:1rem 1.2rem;background:rgba(255,255,255,.03);border:1px solid var(--b1);border-radius:12px;cursor:pointer;transition:all .22s;font-family:var(--fb);margin-bottom:.7rem;}
        .choice:hover{border-color:var(--b2);background:rgba(255,179,71,.04);transform:translateX(3px);}
        .ci{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0;}
        .ctitle{font-weight:700;color:var(--tp);font-size:.9rem;text-align:left;}
        .csub{font-size:.74rem;color:var(--tm);margin-top:1px;text-align:left;}
        .pw-tabs{display:flex;background:rgba(255,255,255,.04);border-radius:10px;padding:4px;margin-bottom:1.5rem;border:1px solid var(--b1);}
        .pw-tab{flex:1;padding:.54rem;border:none;border-radius:7px;background:transparent;color:var(--ts);font-family:var(--fb);font-size:.85rem;font-weight:700;cursor:pointer;transition:.2s;}
        .pw-tab.on{background:linear-gradient(135deg,var(--gold),var(--orange));color:#05050e;}
        .back-btn{background:transparent;border:none;cursor:pointer;color:var(--ts);display:flex;padding:0;}
        @media(max-width:880px){.ll{display:none;}.lr{width:100%;padding:2rem 1.4rem;}}
      `}</style>

      {/* Left hero */}
      <div className="ll">
        <img src="/logo.png" alt="" style={{ width:120, marginBottom:'2rem', filter:'drop-shadow(0 0 30px rgba(255,179,71,.4))', animation:'float 4s ease-in-out infinite' }} onError={e=>e.target.style.display='none'}/>
        <h1 style={{ fontFamily:'var(--fd)', fontSize:'2.85rem', fontWeight:900, lineHeight:1.15, textAlign:'center', maxWidth:380 }}>
          Our <span className="gold">Wheels</span><br/>Take You to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:310, fontSize:'.95rem', lineHeight:1.65 }}>
          Premium campus cab service for IIT Hyderabad — reliable, affordable, always on time.
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'.6rem', marginTop:'2rem', justifyContent:'center' }}>
          {['✉️ Email OTP','🔑 Password Login','📍 GPS Tracking','💰 Deposit & Save','⭐ Rate Driver','🆘 SOS'].map(p=>(
            <span key={p} style={{ background:'rgba(255,179,71,.07)', border:'1px solid var(--b1)', borderRadius:99, padding:'.38rem .9rem', fontSize:'.78rem', color:'var(--ts)' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="lr">
        <div className="lcard">

          {/* CHOOSE */}
          {mode === 'choose' && (
            <>
              <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700 }}>Welcome Back</div>
                <div style={{ color:'var(--ts)', fontSize:'.84rem', marginTop:'.3rem' }}>How would you like to sign in?</div>
              </div>

              <button className="choice" onClick={() => setMode('otp')}>
                <div className="ci" style={{ background:'rgba(52,152,219,.12)' }}>✉️</div>
                <div style={{ flex:1 }}><div className="ctitle">Email OTP</div><div className="csub">Get a 6-digit code via email — no password needed</div></div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <button className="choice" onClick={() => setMode('password')}>
                <div className="ci" style={{ background:'rgba(155,89,182,.12)' }}>🔑</div>
                <div style={{ flex:1 }}><div className="ctitle">Email & Password</div><div className="csub">Sign in or create a new account</div></div>
                <ArrowRight size={14} style={{ color:'var(--tm)', flexShrink:0 }}/>
              </button>

              <div style={{ borderTop:'1px solid var(--b1)', marginTop:'1.25rem', paddingTop:'1.1rem', display:'flex', flexDirection:'column', gap:'.45rem' }}>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>
                  Applying as a driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Apply here →</Link>
                </p>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>
                  Driver login? <Link to="/driver" style={{ color:'var(--green)', fontWeight:700 }}>Driver Portal →</Link>
                </p>
              </div>
            </>
          )}

          {/* OTP */}
          {mode === 'otp' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back-btn"><ChevronLeft size={20}/></button>
                <div>
                  <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>
                    {otpStep === 'input' ? 'Enter Your Email' : 'Check Your Email'}
                  </div>
                  <div style={{ color:'var(--ts)', fontSize:'.81rem', marginTop:2 }}>
                    {otpStep === 'verify' ? `Code sent to ${email}` : "We'll send a 6-digit code — no password needed"}
                  </div>
                </div>
              </div>

              {otpStep === 'input' && (
                <form onSubmit={e=>{e.preventDefault();sendOtp()}}>
                  <div className="fg mb3">
                    <label className="label">Email Address</label>
                    <div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                    {loading?<span className="spinner"/>:<><ArrowRight size={16}/> Send Code</>}
                  </button>
                  <div className="info-box mt2" style={{ fontSize:'.8rem' }}>
                    <Mail size={13} style={{ flexShrink:0 }}/>
                    No Twilio needed — OTP is sent directly via Supabase to your email. Free.
                  </div>
                </form>
              )}

              {otpStep === 'verify' && (
                <form onSubmit={verifyOtp}>
                  <div style={{ textAlign:'center', padding:'.65rem', background:'rgba(52,152,219,.07)', border:'1px solid rgba(52,152,219,.2)', borderRadius:'var(--rs)', marginBottom:'.5rem', fontWeight:700, color:'#3498db', fontSize:'.9rem' }}>
                    ✉️ {email}
                  </div>
                  <p style={{ textAlign:'center', color:'var(--ts)', fontSize:'.82rem' }}>Enter the 6-digit code from your email</p>
                  <OtpBoxes/>
                  <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading||otpStr.length!==OTP_LEN}>
                    {loading?<span className="spinner"/>:'✦ Verify & Sign In'}
                  </button>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setOtpStep('input');setOtp(Array(OTP_LEN).fill(''))}}>
                      <ChevronLeft size={13}/> Change Email
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={sendOtp} disabled={cooldown>0||loading}>
                      <RefreshCw size={13}/> {cooldown>0?`Resend in ${cooldown}s`:'Resend Code'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* PASSWORD */}
          {mode === 'password' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
                <button onClick={reset} className="back-btn"><ChevronLeft size={20}/></button>
                <div style={{ fontFamily:'var(--fd)', fontSize:'1.35rem', fontWeight:700 }}>
                  {pwMode==='login' ? 'Sign In' : 'Create Account'}
                </div>
              </div>
              <div className="pw-tabs">
                <button className={`pw-tab ${pwMode==='login'?'on':''}`} onClick={()=>setPwMode('login')}>Sign In</button>
                <button className={`pw-tab ${pwMode==='register'?'on':''}`} onClick={()=>setPwMode('register')}>Register</button>
              </div>
              <form onSubmit={handlePassword} style={{ display:'flex', flexDirection:'column', gap:'1.05rem' }}>
                {pwMode==='register' && (
                  <>
                    <div className="fg"><label className="label">Full Name</label><div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} required/></div></div>
                    <div className="fg"><label className="label">Phone</label><div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" placeholder="+91 98765 43210" value={phone} onChange={e=>setPhone(e.target.value)}/></div></div>
                  </>
                )}
                <div className="fg"><label className="label">Email</label><div className="input-wrap"><Mail size={15} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div></div>
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
                <button type="submit" className="btn btn-primary btn-blk btn-lg" style={{ marginTop:'.25rem' }} disabled={loading}>
                  {loading?<span className="spinner"/>: pwMode==='login'?'✦ Sign In':'✦ Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
