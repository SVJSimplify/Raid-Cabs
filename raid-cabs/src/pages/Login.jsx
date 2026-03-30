import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Phone, Mail, Lock, User, Eye, EyeOff, Shield, Info, ArrowRight, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const formatPhone = raw => {
  const d = raw.replace(/\D/g,'')
  if (d.length === 10) return `+91${d}`
  if (d.startsWith('91') && d.length === 12) return `+${d}`
  if (d.startsWith('+')) return raw.trim()
  return `+91${d}`
}

export default function Login() {
  const [authMethod, setAuthMethod] = useState('phone')  // 'phone' | 'email'
  const [userType,   setUserType]   = useState('user')   // 'user' | 'admin'
  const [phoneStep,  setPhoneStep]  = useState('number') // 'number' | 'otp'
  const [emailMode,  setEmailMode]  = useState('login')  // 'login' | 'register'
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [cooldown,   setCooldown]   = useState(0)

  const [phone,    setPhone]    = useState('')
  const [otp,      setOtp]      = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')

  const { sendPhoneOtp, verifyPhoneOtp, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  // Countdown helper
  const startCooldown = secs => {
    setCooldown(secs)
    const iv = setInterval(() => setCooldown(c => { if (c<=1){clearInterval(iv);return 0} return c-1 }), 1000)
  }

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendOtp = async e => {
    e.preventDefault()
    if (!phone.replace(/\D/,'').length) { toast.error('Enter your phone number'); return }
    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await sendPhoneOtp(formatted)
    if (error) {
      if (error.message?.includes('not supported') || error.message?.includes('provider')) {
        toast.error('Phone OTP not configured in Supabase. Use Email login instead.')
      } else {
        toast.error(error.message || 'Failed to send OTP')
      }
    } else {
      toast.success(`OTP sent to ${formatted}`)
      setPhoneStep('otp')
      startCooldown(60)
    }
    setLoading(false)
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async e => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    const { error } = await verifyPhoneOtp(formatPhone(phone), otp)
    if (error) {
      toast.error(error.message?.includes('invalid') ? 'Wrong OTP. Please try again.' : error.message)
    } else {
      toast.success('Verified! Welcome 🎉')
      navigate(userType === 'admin' ? '/admin' : '/dashboard')
    }
    setLoading(false)
  }

  // ── Email login / register ────────────────────────────────────────────────
  const handleEmail = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (emailMode === 'login') {
        const { error } = await signIn({ email, password })
        if (error) throw error
        toast.success('Welcome back! 👋')
        navigate(userType === 'admin' ? '/admin' : '/dashboard')
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

  const OtpInput = () => (
    <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', margin:'1.25rem 0' }}>
      {Array.from({length:6}).map((_,i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={otp[i] || ''}
          onChange={e => {
            const v = e.target.value.replace(/\D/,'')
            const arr = otp.split('')
            arr[i] = v
            setOtp(arr.join('').slice(0,6))
            if (v && i < 5) document.getElementById(`otp-${i+1}`)?.focus()
          }}
          onKeyDown={e => { if (e.key==='Backspace' && !otp[i] && i>0) document.getElementById(`otp-${i-1}`)?.focus() }}
          style={{
            width:46, height:54, textAlign:'center', fontSize:'1.4rem', fontWeight:700,
            background:'rgba(255,255,255,.05)', border:`1.5px solid ${otp[i]?'var(--gold)':'var(--border)'}`,
            borderRadius:'var(--rs)', color:'var(--tp)', fontFamily:'var(--fb)', outline:'none',
            transition:'border-color var(--t)', boxShadow:otp[i]?'0 0 0 3px rgba(255,179,71,.12)':'none',
          }}
        />
      ))}
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)', overflow:'hidden' }}>
      <style>{`
        .ll{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3rem;position:relative;background:radial-gradient(ellipse at 30% 50%,rgba(255,107,53,.09) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(255,179,71,.07) 0%,transparent 50%);}
        .ll::after{content:'';position:absolute;right:0;top:10%;bottom:10%;width:1px;background:linear-gradient(to bottom,transparent,var(--border),transparent);}
        .hero-logo{width:130px;margin-bottom:2rem;filter:drop-shadow(0 0 30px rgba(255,179,71,.42));animation:float 4s ease-in-out infinite;}
        @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-14px);}}
        .tagline{font-family:var(--fd);font-size:2.9rem;font-weight:900;line-height:1.15;text-align:center;max-width:400px;}
        .pills{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:2.25rem;justify-content:center;}
        .pill{display:flex;align-items:center;gap:5px;background:rgba(255,179,71,.07);border:1px solid var(--border);border-radius:99px;padding:.4rem .9rem;font-size:.79rem;color:var(--ts);}
        .lr{width:500px;display:flex;flex-direction:column;justify-content:center;padding:3rem;background:rgba(13,13,31,.65);backdrop-filter:blur(24px);}
        .lcard{background:var(--card);border:1px solid var(--border);border-radius:22px;padding:2.35rem;box-shadow:0 24px 80px rgba(0,0,0,.55);}
        .mrow{display:flex;gap:.6rem;margin-bottom:1.6rem;}
        .mopt{flex:1;padding:.82rem .7rem;border-radius:12px;cursor:pointer;text-align:center;border:1px solid var(--border);background:transparent;transition:all var(--t);font-family:var(--fb);font-weight:700;font-size:.83rem;color:var(--tm);}
        .mopt em{font-size:1.4rem;font-style:normal;display:block;margin-bottom:.22rem;}
        .mopt.tu{border-color:rgba(52,152,219,.45);background:rgba(52,152,219,.08);color:var(--blue);}
        .mopt.ta{border-color:rgba(255,179,71,.45);background:rgba(255,179,71,.08);color:var(--gold);}
        .method-tabs{display:flex;background:rgba(255,255,255,.04);border-radius:10px;padding:4px;margin-bottom:1.6rem;border:1px solid var(--border);}
        .mt-btn{flex:1;padding:.56rem;border:none;border-radius:7px;background:transparent;color:var(--ts);font-family:var(--fb);font-size:.86rem;font-weight:700;cursor:pointer;transition:var(--t);}
        .mt-btn.on{background:linear-gradient(135deg,var(--gold),var(--orange));color:#06060f;}
        .phone-display{text-align:center;padding:.75rem;background:rgba(255,179,71,.07);border:1px solid var(--border2);border-radius:var(--rs);margin-bottom:1.25rem;font-weight:700;color:var(--gold);font-size:.95rem;}
        @media(max-width:900px){.ll{display:none;}.lr{width:100%;padding:2rem 1.4rem;}}
      `}</style>

      {/* Left hero */}
      <div className="ll">
        <img src="/logo.png" alt="Raid Cabs" className="hero-logo" onError={e=>e.target.style.display='none'}/>
        <h1 className="tagline" style={{ fontFamily:'var(--fd)', fontWeight:900, lineHeight:1.15, textAlign:'center', maxWidth:400 }}>
          Our <span className="gold">Wheels</span><br/>Take You<br/>to <span className="gold">Fly</span>
        </h1>
        <p style={{ marginTop:'1.1rem', color:'var(--ts)', textAlign:'center', maxWidth:330, fontSize:'.97rem', lineHeight:1.65 }}>
          Premium campus cab service connecting IIT routes.
        </p>
        <div className="pills">
          {[['📱','Phone OTP Login'],['✈️','IIT Campus Routes'],['🛣️','Real Road Distance'],['💰','Deposit & Save'],['⭐','Rate Your Driver'],['🆘','SOS Emergency'],['📋','Trip Receipts'],['🛡️','Admin Portal']].map(([ic,lb])=>(
            <span key={lb} className="pill">{ic} {lb}</span>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="lr">
        <div className="lcard">
          <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
            <div style={{ fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:700 }}>
              {phoneStep==='otp' ? 'Enter OTP' : authMethod==='phone' ? 'Sign In with Phone' : emailMode==='login' ? 'Welcome Back' : 'Create Account'}
            </div>
            <div style={{ color:'var(--ts)', fontSize:'.85rem', marginTop:'.3rem' }}>
              {phoneStep==='otp' ? `Code sent to ${formatPhone(phone)}` : 'Raid Cabs · Our Wheels Take You to Fly'}
            </div>
          </div>

          {/* User type */}
          <div className="mrow">
            <button className={`mopt ${userType==='user'?'tu':''}`} onClick={()=>setUserType('user')}><em>🧑‍💼</em>Passenger</button>
            <button className={`mopt ${userType==='admin'?'ta':''}`} onClick={()=>setUserType('admin')}><em>🛡️</em>Admin</button>
          </div>

          {/* Auth method tabs (only if not mid-OTP) */}
          {phoneStep==='number' && (
            <div className="method-tabs">
              <button className={`mt-btn ${authMethod==='phone'?'on':''}`} onClick={()=>setAuthMethod('phone')}>📱 Phone OTP</button>
              <button className={`mt-btn ${authMethod==='email'?'on':''}`} onClick={()=>setAuthMethod('email')}>✉️ Email</button>
            </div>
          )}

          {/* Admin info */}
          {userType==='admin' && (
            <div className="info-box mb2">
              <Shield size={15} style={{ color:'var(--gold)', flexShrink:0 }}/>
              <span>Sign in with admin credentials. Ask another admin to set your role in the Users tab.</span>
            </div>
          )}

          {/* ── PHONE OTP FLOW ── */}
          {authMethod==='phone' && phoneStep==='number' && (
            <form onSubmit={handleSendOtp} style={{ display:'flex', flexDirection:'column', gap:'1.15rem' }}>
              <div className="info-box">
                <Info size={14} style={{ flexShrink:0 }}/>
                <span>Requires <strong>Twilio</strong> configured in Supabase → Auth → Providers → Phone. Or use Email login.</span>
              </div>
              <div className="fg">
                <label className="label">Phone Number</label>
                <div className="input-wrap">
                  <Phone size={16} className="ico"/>
                  <input className="input" type="tel" placeholder="+91 98765 43210 or 9876543210"
                    value={phone} onChange={e=>setPhone(e.target.value)} required/>
                </div>
                <p className="hint">Indian numbers: enter 10 digits, we'll add +91 automatically.</p>
              </div>
              <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
                {loading ? <span className="spinner"/> : <><ArrowRight size={16}/> Send OTP</>}
              </button>
            </form>
          )}

          {authMethod==='phone' && phoneStep==='otp' && (
            <form onSubmit={handleVerifyOtp} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div className="phone-display">📱 {formatPhone(phone)}</div>
              <p style={{ textAlign:'center', color:'var(--ts)', fontSize:'.85rem' }}>
                Enter the 6-digit code sent via SMS
              </p>
              <OtpInput/>
              <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading||otp.length!==6}>
                {loading ? <span className="spinner"/> : '✦ Verify & Sign In'}
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setPhoneStep('number');setOtp('')}}>← Change Number</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleSendOtp} disabled={cooldown>0||loading}>
                  <RefreshCw size={13}/> {cooldown>0?`Resend in ${cooldown}s`:'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {/* ── EMAIL FLOW ── */}
          {authMethod==='email' && (
            <>
              {userType==='user' && (
                <div className="method-tabs mb2" style={{ marginTop:'-.5rem' }}>
                  <button className={`mt-btn ${emailMode==='login'?'on':''}`}  onClick={()=>setEmailMode('login')}>Sign In</button>
                  <button className={`mt-btn ${emailMode==='register'?'on':''}`} onClick={()=>setEmailMode('register')}>Register</button>
                </div>
              )}
              {emailMode==='register' && (
                <div className="info-box mb2">
                  <Info size={14} style={{ flexShrink:0 }}/>
                  <span>Disable <strong>email confirmation</strong> in Supabase → Auth → Settings for instant login.</span>
                </div>
              )}
              <form onSubmit={handleEmail} style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
                {emailMode==='register' && userType==='user' && (<>
                  <div className="fg">
                    <label className="label">Full Name</label>
                    <div className="input-wrap"><User size={16} className="ico"/><input className="input" type="text" placeholder="Your full name" value={fullName} onChange={e=>setFullName(e.target.value)} required/></div>
                  </div>
                  <div className="fg">
                    <label className="label">Phone Number</label>
                    <div className="input-wrap"><Phone size={16} className="ico"/><input className="input" type="tel" placeholder="+91 98765 43210" value={regPhone} onChange={e=>setRegPhone(e.target.value)}/></div>
                  </div>
                </>)}
                <div className="fg">
                  <label className="label">Email Address</label>
                  <div className="input-wrap"><Mail size={16} className="ico"/><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
                </div>
                <div className="fg">
                  <label className="label">Password</label>
                  <div className="input-wrap" style={{ position:'relative' }}>
                    <Lock size={16} className="ico"/>
                    <input className="input" type={showPw?'text':'password'} placeholder="Min. 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} style={{ paddingRight:'2.8rem' }}/>
                    <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:'absolute', right:'.85rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--tm)', display:'flex' }}>
                      {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-blk btn-lg" style={{ marginTop:'.3rem' }} disabled={loading}>
                  {loading ? <span className="spinner"/> : userType==='admin' ? <><Shield size={15}/> Enter Admin Panel</> : emailMode==='login' ? '✦ Sign In' : '✦ Create Account'}
                </button>
              </form>
              {userType==='user' && (
                <div style={{ textAlign:'center', marginTop:'1.4rem', fontSize:'.79rem', color:'var(--tm)' }}>
                  <p>Are you a driver? <Link to="/driver-signup" style={{ color:'var(--gold)', fontWeight:700 }}>Driver Sign Up →</Link></p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
