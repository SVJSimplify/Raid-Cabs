import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { Phone, Lock, Eye, EyeOff, ArrowRight, Car } from 'lucide-react'
import toast from 'react-hot-toast'

const clean = p => p.replace(/\D/g, '').slice(-10)

export default function DriverLogin() {
  const [phone,   setPhone]   = useState('')
  const [pin,     setPin]     = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Check if already logged in as driver
  useEffect(() => {
    const saved = sessionStorage.getItem('driver_session')
    if (saved) {
      try {
        const d = JSON.parse(saved)
        if (d?.id) navigate('/driver/home', { replace: true })
      } catch {}
    }
  }, [navigate])

  const handleLogin = async e => {
    e.preventDefault()
    const digits = clean(phone)
    if (digits.length !== 10) { toast.error('Enter a valid 10-digit phone number'); return }
    if (!pin || pin.length < 4)  { toast.error('Enter your 4-digit PIN'); return }

    setLoading(true)

    // Look up driver by last 10 digits of phone + PIN
    const { data, error } = await q(() =>
      supabase.from('drivers')
        .select('*')
        .eq('login_pin', pin)
        .eq('is_approved', true)
        .limit(10)
    )

    if (error) { toast.error('Login error. Try again.'); setLoading(false); return }

    // Match phone (last 10 digits)
    const driver = (data || []).find(d => clean(d.phone) === digits)

    if (!driver) {
      toast.error('Wrong phone or PIN. Contact admin if you forgot your PIN.')
      setLoading(false)
      return
    }

    // Save driver session
    sessionStorage.setItem('driver_session', JSON.stringify(driver))
    toast.success(`Welcome, ${driver.name}! 🚗`)
    navigate('/driver/home')
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#05050e', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:"'Nunito',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap');
        .dl-card{background:#0e0e20;border:1px solid rgba(46,204,113,.2);border-radius:20px;padding:2.4rem;width:100%;max-width:420px;box-shadow:0 24px 70px rgba(0,0,0,.65);}
        .dl-input{background:rgba(255,255,255,.04);border:1px solid rgba(46,204,113,.18);border-radius:9px;padding:.82rem 1rem;color:#ede8d8;font-family:'Nunito',sans-serif;font-size:.93rem;width:100%;outline:none;transition:all .22s;}
        .dl-input:focus{border-color:#2ecc71;box-shadow:0 0 0 3px rgba(46,204,113,.1);}
        .dl-input::placeholder{color:#504c74;}
        .dl-btn{width:100%;padding:.9rem;background:linear-gradient(135deg,#2ecc71,#27ae60);color:#05050e;border:none;border-radius:10px;font-family:'Nunito',sans-serif;font-size:.96rem;font-weight:700;cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .dl-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(46,204,113,.4);}
        .dl-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .dl-lbl{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#9890c2;display:block;margin-bottom:.42rem;}
        .dl-spinner{width:20px;height:20px;border:2.5px solid rgba(5,5,14,.3);border-top-color:#05050e;border-radius:50%;animation:dls .7s linear infinite;}
        @keyframes dls{to{transform:rotate(360deg)}}
      `}</style>

      {/* Logo + brand */}
      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <img src="/logo.png" alt="" style={{ width:60, marginBottom:'.75rem', filter:'drop-shadow(0 0 14px rgba(46,204,113,.4))' }} onError={e=>e.target.style.display='none'}/>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', fontWeight:700, color:'#2ecc71' }}>Driver Portal</div>
        <div style={{ color:'#504c74', fontSize:'.8rem', marginTop:'.25rem' }}>Raid Cabs · Sign in to start driving</div>
      </div>

      <div className="dl-card">
        {/* Icon */}
        <div style={{ width:54, height:54, background:'rgba(46,204,113,.1)', border:'1px solid rgba(46,204,113,.25)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', fontSize:'1.5rem' }}>🚗</div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          <div>
            <label className="dl-lbl">Phone Number</label>
            <div style={{ position:'relative' }}>
              <Phone size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
              <input className="dl-input" type="tel" placeholder="98765 43210" value={phone}
                onChange={e => setPhone(e.target.value)} required style={{ paddingLeft:'2.55rem' }}/>
            </div>
            <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>Enter your 10-digit mobile number</p>
          </div>

          <div>
            <label className="dl-lbl">Your PIN</label>
            <div style={{ position:'relative' }}>
              <Lock size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
              <input className="dl-input" type={showPin ? 'text' : 'password'} placeholder="4-digit PIN" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                required minLength={4} style={{ paddingLeft:'2.55rem', paddingRight:'2.8rem', letterSpacing:'.2em', fontSize:'1.2rem' }}/>
              <button type="button" onClick={() => setShowPin(v=>!v)}
                style={{ position:'absolute', right:'.85rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#504c74', display:'flex', padding:0 }}>
                {showPin ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>PIN is set by admin. Contact admin if you forgot it.</p>
          </div>

          <button type="submit" className="dl-btn" disabled={loading} style={{ marginTop:'.2rem' }}>
            {loading ? <div className="dl-spinner"/> : <><ArrowRight size={16}/> Sign In</>}
          </button>
        </form>

        <div style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid rgba(255,255,255,.06)', textAlign:'center' }}>
          <p style={{ color:'#504c74', fontSize:'.78rem' }}>
            Not registered yet? <Link to="/driver-signup" style={{ color:'#2ecc71', fontWeight:700, textDecoration:'none' }}>Apply to drive →</Link>
          </p>
        </div>
      </div>

      <p style={{ color:'#504c74', fontSize:'.75rem', marginTop:'1.5rem', textAlign:'center' }}>
        Passenger? <Link to="/login" style={{ color:'var(--gold, #ffb347)', fontWeight:700, textDecoration:'none' }}>Sign in here →</Link>
      </p>
    </div>
  )
}
