import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDriver } from '../contexts/DriverContext'
import { Phone, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const normalizePhone = raw => {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `+91${d}`
  if (d.startsWith('91') && d.length === 12) return `+${d}`
  if (raw.trim().startsWith('+')) return raw.trim()
  return `+91${d}`
}

const OTP_LEN = 6

export default function DriverLogin() {
  const [step,      setStep]     = useState('phone') // phone | otp
  const [phone,     setPhone]    = useState('')
  const [otp,       setOtp]      = useState(Array(OTP_LEN).fill(''))
  const [loading,   setLoading]  = useState(false)
  const [cooldown,  setCooldown] = useState(0)
  const otpRefs = useRef([])

  const { sendPhoneOtp, verifyPhoneOtp, user } = useAuth()
  const { driver, linkError, loading: driverLoading, fetchDriver } = useDriver()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && driver) navigate('/driver/home', { replace: true })
  }, [user, driver, navigate])

  const startCooldown = s => {
    setCooldown(s)
    const iv = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(iv); return 0 } return c - 1 }), 1000)
  }

  const otpStr = otp.join('')

  const handleCell = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = v; setOtp(next)
    if (v && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus()
  }

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
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
    if (!phone.replace(/\D/g, '')) { toast.error('Enter your phone number'); return }
    setLoading(true)
    const formatted = normalizePhone(phone)
    const { error } = await sendPhoneOtp(formatted)
    if (error) {
      toast.error(error.message?.includes('not supported')
        ? 'Phone OTP not set up in Supabase. Contact admin.'
        : error.message)
    } else {
      toast.success(`Code sent to ${formatted}`)
      setStep('otp')
      startCooldown(60)
    }
    setLoading(false)
  }

  const verifyOtp = async e => {
    e.preventDefault()
    if (otpStr.length !== OTP_LEN) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    const { error } = await verifyPhoneOtp(normalizePhone(phone), otpStr)
    if (error) {
      toast.error('Invalid code. Try again.')
      setOtp(Array(OTP_LEN).fill(''))
      otpRefs.current[0]?.focus()
    } else {
      await fetchDriver()
    }
    setLoading(false)
  }

  // After auth success, check driver status
  if (user && !driverLoading && linkError === 'no_driver') {
    return (
      <div style={S.page}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚗</div>
          <h2 style={S.h2}>Not Registered</h2>
          <p style={S.sub}>Your phone number is not registered as a Raid Cabs driver, or your application is still pending approval.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem', justifyContent: 'center' }}>
            <a href="/driver-signup" style={{ ...S.btn, background: 'linear-gradient(135deg,#2ecc71,#27ae60)', color: '#fff', textDecoration: 'none' }}>
              Apply as Driver
            </a>
            <button style={{ ...S.btn, background: 'transparent', border: '1px solid rgba(255,255,255,.15)', color: '#9890c2' }}
              onClick={async () => { const { signOut } = await import('../contexts/AuthContext'); navigate('/driver') }}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <style>{`
        .dc { background:#0e0e20; border:1px solid rgba(46,204,113,.2); border-radius:20px; padding:2.25rem; width:100%; max-width:420px; box-shadow:0 24px 70px rgba(0,0,0,.65); }
        .di { background:rgba(255,255,255,.04); border:1px solid rgba(46,204,113,.2); border-radius:9px; padding:.8rem 1rem; color:#ede8d8; font-family:'Nunito',sans-serif; font-size:.93rem; width:100%; outline:none; transition:all .22s; }
        .di:focus { border-color:#2ecc71; box-shadow:0 0 0 3px rgba(46,204,113,.1); }
        .di::placeholder { color:#504c74; }
        .db { width:100%; padding:.88rem; background:linear-gradient(135deg,#2ecc71,#27ae60); color:#05050e; border:none; border-radius:10px; font-family:'Nunito',sans-serif; font-size:.95rem; font-weight:700; cursor:pointer; transition:all .22s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .db:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 7px 22px rgba(46,204,113,.4); }
        .db:disabled { opacity:.5; cursor:not-allowed; transform:none; }
        .ds { width:20px; height:20px; border:2.5px solid rgba(5,5,14,.3); border-top-color:#05050e; border-radius:50%; animation:ds .7s linear infinite; }
        @keyframes ds { to { transform:rotate(360deg); } }
        .otp-wrap { display:flex; gap:.5rem; justify-content:center; margin:1.5rem 0; }
        .otp-cell { width:46px; height:54px; text-align:center; font-size:1.4rem; font-weight:700; background:rgba(255,255,255,.05); border:1.5px solid rgba(46,204,113,.2); border-radius:9px; color:#ede8d8; font-family:'Nunito',sans-serif; outline:none; transition:all .22s; }
        .otp-cell:focus { border-color:#2ecc71; box-shadow:0 0 0 3px rgba(46,204,113,.1); }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <img src="/logo.png" alt="Raid Cabs" style={{ width: 64, marginBottom: '.75rem', filter: 'drop-shadow(0 0 12px rgba(46,204,113,.35))' }} onError={e => e.target.style.display='none'}/>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.5rem', fontWeight: 700, color: '#2ecc71' }}>Driver Portal</div>
        <div style={{ color: '#504c74', fontSize: '.82rem', marginTop: '.25rem' }}>Raid Cabs · Our Wheels Take You to Fly</div>
      </div>

      <div className="dc">
        {step === 'phone' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{ width: 52, height: 52, background: 'rgba(46,204,113,.12)', border: '1px solid rgba(46,204,113,.3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .85rem', fontSize: '1.5rem' }}>🚗</div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.35rem', fontWeight: 700, color: '#ede8d8' }}>Driver Sign In</h2>
              <p style={{ color: '#504c74', fontSize: '.82rem', marginTop: '.3rem' }}>Enter your registered phone number</p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: '#9890c2', display: 'block', marginBottom: '.42rem' }}>
                Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={15} style={{ position: 'absolute', left: '.82rem', top: '50%', transform: 'translateY(-50%)', color: '#504c74', pointerEvents: 'none' }}/>
                <input className="di" type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} style={{ paddingLeft: '2.5rem' }} onKeyDown={e => e.key === 'Enter' && sendOtp()}/>
              </div>
              <p style={{ fontSize: '.73rem', color: '#504c74', marginTop: '.25rem' }}>Use the phone number you registered with</p>
            </div>

            <button className="db" onClick={sendOtp} disabled={loading}>
              {loading ? <div className="ds"/> : <><ArrowRight size={16}/> Send OTP</>}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <p style={{ color: '#504c74', fontSize: '.78rem' }}>
                Not a driver yet? <a href="/driver-signup" style={{ color: '#2ecc71', fontWeight: 700, textDecoration: 'none' }}>Apply here →</a>
              </p>
            </div>
          </>
        )}

        {step === 'otp' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.5rem' }}>
              <button onClick={() => { setStep('phone'); setOtp(Array(OTP_LEN).fill('')) }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#504c74', display: 'flex', padding: 0 }}>
                <ChevronLeft size={20}/>
              </button>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '1.3rem', fontWeight: 700, color: '#ede8d8' }}>Enter Code</div>
                <div style={{ color: '#504c74', fontSize: '.8rem', marginTop: 2 }}>Sent to {normalizePhone(phone)}</div>
              </div>
            </div>

            <form onSubmit={verifyOtp}>
              <p style={{ textAlign: 'center', color: '#9890c2', fontSize: '.83rem' }}>Enter the 6-digit code</p>
              <div className="otp-wrap">
                {Array(OTP_LEN).fill(null).map((_, i) => (
                  <input key={`driver-otp-${i}`}
                    ref={el => otpRefs.current[i] = el}
                    type="text" inputMode="numeric" maxLength={1}
                    value={otp[i] || ''}
                    onChange={e => handleCell(i, e.target.value)}
                    onKeyDown={e => handleKey(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    className="otp-cell"
                    style={{ borderColor: otp[i] ? '#2ecc71' : 'rgba(46,204,113,.2)' }}
                  />
                ))}
              </div>

              <button type="submit" className="db" disabled={loading || otpStr.length !== OTP_LEN}>
                {loading ? <div className="ds"/> : '✦ Verify & Enter Portal'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button type="button"
                  style={{ background: 'transparent', border: 'none', cursor: cooldown > 0 ? 'not-allowed' : 'pointer', color: '#504c74', fontSize: '.8rem', fontFamily: "'Nunito',sans-serif", display: 'flex', alignItems: 'center', gap: 5, opacity: cooldown > 0 ? .5 : 1 }}
                  onClick={sendOtp} disabled={cooldown > 0 || loading}>
                  <RefreshCw size={12}/> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: '#05050e',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '2rem', fontFamily: "'Nunito',sans-serif",
    background: 'radial-gradient(ellipse at 50% 0%, rgba(46,204,113,.06) 0%, transparent 60%), #05050e',
  },
  h2:  { fontFamily: "'Playfair Display',serif", fontSize: '1.5rem', fontWeight: 700, color: '#ede8d8', marginBottom: '.75rem' },
  sub: { color: '#9890c2', lineHeight: 1.7, fontSize: '.9rem', maxWidth: 340 },
  btn: { padding: '.72rem 1.5rem', borderRadius: 10, fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', fontFamily: "'Nunito',sans-serif" },
}
