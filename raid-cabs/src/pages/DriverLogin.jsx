import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDriver } from '../contexts/DriverContext'
import { supabase } from '../lib/supabase'
import { Lock, Phone, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const last10 = p => p.replace(/\D/g, '').slice(-10)

export default function DriverLogin() {
  const [phone,   setPhone]   = useState('')
  const [pin,     setPin]     = useState('')
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const { driver, loading: dLoading, fetchDriver } = useDriver()
  const navigate = useNavigate()

  useEffect(() => {
    if (!dLoading && driver) navigate('/driver/home', { replace: true })
  }, [driver, dLoading, navigate])

  const handleLogin = async e => {
    e.preventDefault()
    const digits = last10(phone)
    if (digits.length !== 10) { toast.error('Enter a valid 10-digit number'); return }
    const pinClean = pin.replace(/\D/g, '')
    if (pinClean.length < 4)  { toast.error('Enter your 4-digit PIN'); return }

    setLoading(true)

    const { data: drivers, error } = await supabase
      .from('drivers').select('*').eq('is_approved', true)

    if (error) {
      toast.error('Connection error. Check your internet.')
      setLoading(false)
      return
    }

    const match = (drivers || []).find(d =>
      last10(d.phone || '') === digits &&
      (d.login_pin || '').replace(/\D/g, '') === pinClean
    )

    if (!match) {
      const phoneMatch = (drivers || []).find(d => last10(d.phone || '') === digits)
      if (!phoneMatch) toast.error('Number not found. Are you registered and approved?')
      else             toast.error('Wrong PIN. Contact admin to reset it.')
      setLoading(false)
      return
    }

    sessionStorage.setItem('driver_session', JSON.stringify(match))
    await fetchDriver()
    toast.success(`Welcome, ${match.name}! 🚗`)
    navigate('/driver/home')
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
      `}</style>

      <div style={{ textAlign:'center', marginBottom:'2rem' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:'.5rem' }}>🚗</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', fontWeight:700, color:'#2ecc71' }}>Driver Portal</div>
        <div style={{ color:'#504c74', fontSize:'.8rem', marginTop:'.2rem' }}>Raid Cabs</div>
      </div>

      <div className="dl">
        <div style={{ width:52, height:52, background:'rgba(46,204,113,.1)', border:'1px solid rgba(46,204,113,.25)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', fontSize:'1.5rem' }}>🚗</div>

        <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', fontWeight:700, color:'#ede8d8' }}>Sign In</div>
          <div style={{ color:'#504c74', fontSize:'.82rem', marginTop:'.3rem' }}>Enter your phone and PIN set by admin</div>
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
          <div>
            <label className="dl-lbl">Phone Number</label>
            <div style={{ position:'relative' }}>
              <Phone size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
              <input className="di" type="tel" inputMode="numeric" placeholder="98765 43210"
                value={phone} onChange={e => setPhone(e.target.value)} required style={{ paddingLeft:'2.55rem' }} autoFocus/>
            </div>
            <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>Use the number you registered with</p>
          </div>

          <div>
            <label className="dl-lbl">Your PIN</label>
            <div style={{ position:'relative' }}>
              <Lock size={15} style={{ position:'absolute', left:'.85rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
              <input className="di" type={showPin ? 'text' : 'password'} inputMode="numeric"
                placeholder="4-digit PIN" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                required minLength={4}
                style={{ paddingLeft:'2.55rem', paddingRight:'2.8rem', letterSpacing:'.2em', fontSize:'1.2rem' }}/>
              <button type="button" onClick={() => setShowPin(v => !v)}
                style={{ position:'absolute', right:'.85rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#504c74', display:'flex', padding:0 }}>
                {showPin ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            <p style={{ fontSize:'.72rem', color:'#504c74', marginTop:'.28rem' }}>Admin sets your PIN when your account is approved</p>
          </div>

          <button type="submit" className="db" disabled={loading} style={{ marginTop:'.25rem' }}>
            {loading ? <div className="dl-sp"/> : <><ArrowRight size={16}/> Sign In</>}
          </button>
        </form>

        <div style={{ marginTop:'1.5rem', paddingTop:'1.25rem', borderTop:'1px solid rgba(255,255,255,.06)', textAlign:'center' }}>
          <p style={{ color:'#504c74', fontSize:'.78rem' }}>
            Not registered? <Link to="/driver-signup" style={{ color:'#2ecc71', fontWeight:700, textDecoration:'none' }}>Apply to drive →</Link>
          </p>
        </div>
      </div>

      <p style={{ color:'#504c74', fontSize:'.75rem', marginTop:'1.5rem' }}>
        Passenger? <Link to="/login" style={{ color:'#ffb347', fontWeight:700, textDecoration:'none' }}>Sign in here →</Link>
      </p>
    </div>
  )
}
