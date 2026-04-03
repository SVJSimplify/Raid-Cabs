import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDriver } from '../contexts/DriverContext'
import { supabase } from '../lib/supabase'
import { sendFirebaseOtp, verifyFirebaseOtp, FIREBASE_OK } from '../lib/firebase'
import { Phone, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const OTP_LEN = 6
const last10  = p => p.replace(/\D/g,'').slice(-10)
const fmt91   = p => `+91${last10(p)}`

export default function DriverLogin() {
  const [step,        setStep]       = useState('phone')
  const [phone,       setPhone]      = useState('')
  const [otp,         setOtp]        = useState(Array(OTP_LEN).fill(''))
  const [loading,     setLoading]    = useState(false)
  const [cooldown,    setCooldown]   = useState(0)
  const [confirmation,setConfirm]    = useState(null)
  const refs = useRef([])

  const { driver, loading: dLoading, fetchDriver } = useDriver()
  const navigate = useNavigate()

  useEffect(() => {
    if (!dLoading && driver) navigate('/driver/home', { replace: true })
  }, [driver, dLoading, navigate])

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
    const n = Array(OTP_LEN).fill(''); p.split('').forEach((c,i)=>{n[i]=c}); setOtp(n)
    refs.current[Math.min(p.length,OTP_LEN-1)]?.focus()
  }

  const sendOtp = async () => {
    const digits = last10(phone)
    if (digits.length !== 10) { toast.error('Enter a valid 10-digit number'); return }
    if (!FIREBASE_OK) { toast.error('Firebase not configured — add VITE_FIREBASE_* keys to .env'); return }
    setLoading(true)
    try {
      const result = await sendFirebaseOtp(digits, 'driver-recaptcha')
      setConfirm(result)
      toast.success(`OTP sent to ${fmt91(phone)} 📱`)
      setStep('otp')
      startCooldown(60)
      setTimeout(() => refs.current[0]?.focus(), 100)
    } catch (err) {
      console.error('Send OTP error:', err)
      if (err.code === 'auth/invalid-phone-number') toast.error('Invalid phone number format')
      else if (err.code === 'auth/too-many-requests') toast.error('Too many attempts. Try again in a few minutes.')
      else toast.error(err.message || 'Failed to send OTP')
    }
    setLoading(false)
  }

  const verifyOtp = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter all 6 digits'); return }
    if (!confirmation) { toast.error('Please request OTP first'); return }
    setLoading(true)
    try {
      const fbUser = await verifyFirebaseOtp(confirmation, otpStr)
      const digits = last10(fbUser.phoneNumber || phone)

      // Look up driver in Supabase by phone number
      const { data: drivers } = await supabase
        .from('drivers').select('*').eq('is_approved', true)

      const driver = (drivers || []).find(d => last10(d.phone || '') === digits)

      if (!driver) {
        toast.error('No approved driver found for this number. Contact admin.')
        setLoading(false)
        return
      }

      sessionStorage.setItem('driver_session', JSON.stringify(driver))
      await fetchDriver()
      toast.success(`Welcome, ${driver.name}! 🚗`)
      navigate('/driver/home')
    } catch (err) {
      console.error('Verify OTP error:', err)
      if (err.code === 'auth/invalid-verification-code') toast.error('Wrong code. Try again.')
      else if (err.code === 'auth/code-expired') {
        toast.error('Code expired. Request a new one.')
        setStep('phone'); setOtp(Array(OTP_LEN).fill(''))
      } else toast.error(err.message || 'Verification failed')
    }
    setLoading(false)
  }

  if (dLoading) return (
    <div style={{ minHeight:'100vh', background:'#05050e', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:'2.5px solid rgba(46,204,113,.2)', borderTopColor:'#2ecc71', borderRadius:'50%', animation:'sp .7s linear infinite' }}/>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:"'Nunito',sans-serif", background:'radial-gradient(ellipse at 50% 0%,rgba(46,204,113,.07) 0%,transparent 55%),#05050e' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap');
        .dl{background:#0e0e20;border:1px solid rgba(46,204,113,.22);border-radius:20px;padding:2.4rem;width:100%;max-width:420px;box-shadow:0 24px 70px rgba(0,0,0,.65);}
        .di{background:rgba(255,255,255,.04);border:1.5px solid rgba(46,204,113,.18);border-radius:9px;padding:.82rem 1rem;color:#ede8d8;font-family:'Nunito',sans-serif;font-size:.93rem;width:100%;outline:none;transition:all .22s;}
        .di:focus{border-color:#2ecc71;box-shadow:0 0 0 3px rgba(46,204,113,.1);}
        .di::placeholder{color:#504c74;}
        .db{width:100%;padding:.9rem;background:linear-gradient(135deg,#2ecc71,#27ae60);color:#05050e;border:none;border-radius:10px;font-family:'Nunito',sans-serif;font-size:.96rem;font-weight:700;cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .db:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(46,204,113,.4);}
        .db:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .dl-lbl{font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#9890c2;display:block;margin-bottom:.42rem;}
        .dl-sp{width:20px;height:20px;border:2.5px solid rgba(5,5,14,.3);border-top-color:#05050e;border-radius:50%;animation:sp .7s linear infinite;}
        .otp-row{display:flex;gap:.5rem;justify-content:center;margin:1.5rem 0;}
        .otp-c{width:46px;height:54px;text-align:center;font-size:1.4rem;font-weight:700;background:rgba(255,255,255,.05);border:1.5px solid rgba(46,204,113,.2);border-radius:9px;color:#ede8d8;font-family:'Nunito',sans-serif;outline:none;transition:all .22s;caret-color:#2ecc71;}
        .otp-c:focus{border-color:#2ecc71;box-shadow:0 0 0 3px rgba(46,204,113,.1);}
        .ghost{background:transparent;border:none;cursor:pointer;color:#504c74;display:flex;align-items:center;gap:4px;font-family:'Nunito',sans-serif;font-size:.8rem;padding:0;}
        .ghost:disabled{opacity:.5;cursor:not-allowed;}
      `}</style>

      {/* Invisible reCAPTCHA anchor */}
      <div id="driver-recaptcha"/>

      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>🚗</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', fontWeight:700, color:'#2ecc71' }}>Driver Portal</div>
        <div style={{ color:'#504c74', fontSize:'.8rem', marginTop:'.2rem' }}>Raid Cabs · Sign in with phone OTP</div>
      </div>

      <div className="dl">

        {/* PHONE */}
        {step === 'phone' && (
          <>
            <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
              <div style={{ fontSize:'2rem', marginBottom:'.5rem' }}>📱</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', fontWeight:700, color:'#ede8d8' }}>Sign In</div>
              <div style={{ color:'#504c74', fontSize:'.82rem', marginTop:'.3rem' }}>Enter your registered number to get OTP</div>
            </div>

            <div style={{ marginBottom:'1.25rem' }}>
              <label className="dl-lbl">Phone Number</label>
              <div style={{ position:'relative' }}>
                <Phone size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
                <input className="di" type="tel" inputMode="numeric" placeholder="98765 43210"
                  value={phone} onChange={e=>setPhone(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&sendOtp()}
                  style={{ paddingLeft:'2.55rem' }} autoFocus/>
              </div>
              <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>Use the number you registered with</p>
            </div>

            <button className="db" onClick={sendOtp} disabled={loading}>
              {loading ? <div className="dl-sp"/> : <><ArrowRight size={16}/> Send OTP</>}
            </button>

            <div style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid rgba(255,255,255,.06)', textAlign:'center' }}>
              <p style={{ color:'#504c74', fontSize:'.78rem' }}>
                Not registered?{' '}
                <Link to="/driver-signup" style={{ color:'#2ecc71', fontWeight:700, textDecoration:'none' }}>Apply here →</Link>
              </p>
            </div>
          </>
        )}

        {/* OTP */}
        {step === 'otp' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.5rem' }}>
              <button className="ghost" onClick={() => { setStep('phone'); setOtp(Array(OTP_LEN).fill('')); setConfirm(null) }}>
                <ChevronLeft size={18}/>
              </button>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', fontWeight:700, color:'#ede8d8' }}>Enter OTP</div>
                <div style={{ color:'#504c74', fontSize:'.8rem', marginTop:2 }}>Sent to {fmt91(phone)}</div>
              </div>
            </div>

            <form onSubmit={verifyOtp}>
              <p style={{ textAlign:'center', color:'#9890c2', fontSize:'.83rem' }}>Enter the 6-digit code</p>
              <div className="otp-row">
                {Array(OTP_LEN).fill(null).map((_,i) => (
                  <input key={`d-otp-${i}`} ref={el=>refs.current[i]=el}
                    type="text" inputMode="numeric" maxLength={1}
                    value={otp[i]||''} onChange={e=>onCell(i,e.target.value)}
                    onKeyDown={e=>onKey(i,e)} onPaste={i===0?onPaste:undefined}
                    className="otp-c" style={{ borderColor:otp[i]?'#2ecc71':'rgba(46,204,113,.2)' }}/>
                ))}
              </div>
              <button type="submit" className="db" disabled={loading||otpStr.length!==OTP_LEN}>
                {loading ? <div className="dl-sp"/> : '✦ Verify & Sign In'}
              </button>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
                <button type="button" className="ghost" onClick={()=>{setStep('phone');setOtp(Array(OTP_LEN).fill(''));setConfirm(null)}}>
                  <ChevronLeft size={13}/> Change number
                </button>
                <button type="button" className="ghost" onClick={sendOtp} disabled={cooldown>0||loading}>
                  <RefreshCw size={12}/>
                  {cooldown>0?`Resend in ${cooldown}s`:'Resend OTP'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <p style={{ color:'#504c74', fontSize:'.75rem', marginTop:'1.5rem' }}>
        Passenger? <Link to="/login" style={{ color:'#ffb347', fontWeight:700, textDecoration:'none' }}>Sign in here →</Link>
      </p>
    </div>
  )
}
