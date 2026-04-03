import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { useDriver } from '../contexts/DriverContext'
import { Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

// Normalize to last 10 digits for comparison
const last10 = p => p.replace(/\D/g, '').slice(-10)

export default function DriverLogin() {
  const [phone,   setPhone]   = useState('')
  const [pin,     setPin]     = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const { driver, loading: driverLoading, fetchDriver } = useDriver()
  const navigate = useNavigate()

  // Already logged in → go to home
  useEffect(() => {
    if (!driverLoading && driver) {
      navigate('/driver/home', { replace: true })
    }
  }, [driver, driverLoading, navigate])

  const handleLogin = async e => {
    e.preventDefault()
    const phoneLast10 = last10(phone)
    if (phoneLast10.length !== 10) {
      toast.error('Enter a valid 10-digit phone number')
      return
    }
    const pinClean = pin.replace(/\D/g, '')
    if (pinClean.length < 4) {
      toast.error('Enter your 4-digit PIN')
      return
    }

    setLoading(true)

    try {
      // Fetch ALL approved drivers and match client-side
      // (avoids RLS issues with filtering by phone substring)
      const { data, error } = await q(() =>
        supabase
          .from('drivers')
          .select('*')
          .eq('is_approved', true)
      )

      if (error) {
        console.error('Driver fetch error:', error)
        toast.error('Could not connect. Check your internet.')
        setLoading(false)
        return
      }

      const drivers = data || []

      // Find driver matching phone (last 10 digits) AND pin
      const match = drivers.find(d =>
        last10(d.phone || '') === phoneLast10 &&
        (d.login_pin || '').replace(/\D/g, '') === pinClean
      )

      if (!match) {
        // Give specific errors to help debug
        const phoneMatch = drivers.find(d => last10(d.phone || '') === phoneLast10)
        if (!phoneMatch) {
          toast.error('Phone number not found. Make sure you are registered and approved.')
        } else {
          toast.error('Wrong PIN. Contact admin to reset your PIN.')
        }
        setLoading(false)
        return
      }

      // Save session and navigate
      sessionStorage.setItem('driver_session', JSON.stringify(match))
      await fetchDriver() // refresh context
      toast.success(`Welcome, ${match.name}! 🚗`)
      navigate('/driver/home')

    } catch (err) {
      console.error('Login error:', err)
      toast.error('Something went wrong. Try again.')
    }
    setLoading(false)
  }

  if (driverLoading) return (
    <div style={{ minHeight:'100vh', background:'#05050e', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:'2.5px solid rgba(46,204,113,.2)', borderTopColor:'#2ecc71', borderRadius:'50%', animation:'sp .7s linear infinite' }}/>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#05050e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:"'Nunito',sans-serif", background:'radial-gradient(ellipse at 50% 0%,rgba(46,204,113,.06) 0%,transparent 60%),#05050e' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap');
        .dl-card{background:#0e0e20;border:1px solid rgba(46,204,113,.2);border-radius:20px;padding:2.4rem;width:100%;max-width:420px;box-shadow:0 24px 70px rgba(0,0,0,.65);}
        .dl-input{background:rgba(255,255,255,.04);border:1px solid rgba(46,204,113,.18);border-radius:9px;padding:.82rem 1rem;color:#ede8d8;font-family:'Nunito',sans-serif;font-size:.93rem;width:100%;outline:none;transition:all .22s;}
        .dl-input:focus{border-color:#2ecc71;box-shadow:0 0 0 3px rgba(46,204,113,.1);}
        .dl-input::placeholder{color:#504c74;}
        .dl-btn{width:100%;padding:.9rem;background:linear-gradient(135deg,#2ecc71,#27ae60);color:#05050e;border:none;border-radius:10px;font-family:'Nunito',sans-serif;font-size:.96rem;font-weight:700;cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:.25rem;}
        .dl-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(46,204,113,.4);}
        .dl-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .dl-lbl{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#9890c2;display:block;margin-bottom:.42rem;}
        .dl-sp{width:20px;height:20px;border:2.5px solid rgba(5,5,14,.3);border-top-color:#05050e;border-radius:50%;animation:sp .7s linear infinite;}
      `}</style>

      {/* Brand */}
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <img src="/logo.png" alt="" style={{ width:60, marginBottom:'.75rem', filter:'drop-shadow(0 0 14px rgba(46,204,113,.4))' }} onError={e => e.target.style.display='none'}/>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', fontWeight:700, color:'#2ecc71' }}>Driver Portal</div>
        <div style={{ color:'#504c74', fontSize:'.8rem', marginTop:'.25rem' }}>Raid Cabs · Sign in to start driving</div>
      </div>

      <div className="dl-card">
        {/* Icon */}
        <div style={{ width:54, height:54, background:'rgba(46,204,113,.1)', border:'1px solid rgba(46,204,113,.25)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', fontSize:'1.5rem' }}>
          🚗
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>

          {/* Phone */}
          <div>
            <label className="dl-lbl">Phone Number</label>
            <div style={{ position:'relative' }}>
              <Phone size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
              <input
                className="dl-input"
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                style={{ paddingLeft:'2.55rem' }}
                inputMode="numeric"
              />
            </div>
            <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>Enter your registered 10-digit number</p>
          </div>

          {/* PIN */}
          <div>
            <label className="dl-lbl">Your PIN</label>
            <div style={{ position:'relative' }}>
              <Lock size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
              <input
                className="dl-input"
                type={showPin ? 'text' : 'password'}
                placeholder="4-digit PIN"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                required
                minLength={4}
                style={{ paddingLeft:'2.55rem', paddingRight:'2.8rem', letterSpacing:'.2em', fontSize:'1.2rem' }}
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                style={{ position:'absolute', right:'.85rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#504c74', display:'flex', padding:0 }}
              >
                {showPin ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>
              PIN is set by admin when your account is approved
            </p>
          </div>

          <button type="submit" className="dl-btn" disabled={loading}>
            {loading ? <div className="dl-sp"/> : <><ArrowRight size={16}/> Sign In</>}
          </button>
        </form>

        <div style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid rgba(255,255,255,.06)', textAlign:'center' }}>
          <p style={{ color:'#504c74', fontSize:'.78rem' }}>
            Not registered?{' '}
            <Link to="/driver-signup" style={{ color:'#2ecc71', fontWeight:700, textDecoration:'none' }}>
              Apply to drive →
            </Link>
          </p>
        </div>
      </div>

      <p style={{ color:'#504c74', fontSize:'.75rem', marginTop:'1.5rem', textAlign:'center' }}>
        Passenger?{' '}
        <Link to="/login" style={{ color:'#ffb347', fontWeight:700, textDecoration:'none' }}>
          Sign in here →
        </Link>
      </p>
    </div>
  )
}
