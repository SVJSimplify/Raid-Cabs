import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OpsLogin() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const { signIn, signOut, profile, user } = useAuth()
  const navigate = useNavigate()

  // If already signed in as admin, go straight to dashboard
  useEffect(() => {
    if (user && profile?.role === 'admin') {
      navigate('/ops/dashboard', { replace: true })
    }
  }, [user, profile, navigate])

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn({ email, password })
    if (error) {
      toast.error(error.message || 'Sign in failed')
      setLoading(false)
      return
    }
    // onAuthStateChange will update profile, useEffect above will redirect
    setLoading(false)
  }

  // Signed in but not admin
  if (user && profile && profile.role !== 'admin') {
    return (
      <div style={{ minHeight:'100vh', background:'#03030a', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Nunito',sans-serif", padding:'2rem' }}>
        <div style={{ maxWidth:380, textAlign:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🔒</div>
          <h2 style={{ color:'#ede8d8', fontFamily:"'Playfair Display',serif", fontSize:'1.5rem', marginBottom:'.75rem' }}>Access Denied</h2>
          <p style={{ color:'#9890c2', lineHeight:1.65, fontSize:'.9rem' }}>This account does not have the required access level.</p>
          <button
            onClick={async () => { await signOut(); setLoading(true) }}
            style={{ marginTop:'1.5rem', background:'transparent', border:'1px solid rgba(255,165,40,.25)', color:'#ffb347', borderRadius:8, padding:'.6rem 1.5rem', cursor:'pointer', fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:'.88rem' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#03030a', fontFamily:"'Nunito',sans-serif" }}>
      <style>{`
        .ol { flex:1; display:flex; flex-direction:column; justify-content:center; padding:4rem; background:linear-gradient(160deg,#0a0a1e 0%,#05050e 100%); border-right:1px solid rgba(255,165,40,.1); position:relative; overflow:hidden; }
        .ol::before { content:''; position:absolute; top:-30%; right:-20%; width:500px; height:500px; background:radial-gradient(ellipse,rgba(255,179,71,.06) 0%,transparent 70%); pointer-events:none; }
        .ol::after  { content:''; position:absolute; bottom:-20%; left:-10%; width:400px; height:400px; background:radial-gradient(ellipse,rgba(255,107,53,.05) 0%,transparent 70%); pointer-events:none; }
        .or { width:460px; display:flex; align-items:center; justify-content:center; padding:3rem; }
        .oc { background:#0e0e20; border:1px solid rgba(255,165,40,.15); border-radius:20px; padding:2.5rem; width:100%; box-shadow:0 24px 80px rgba(0,0,0,.7); }
        .oi { background:rgba(255,255,255,.04); border:1px solid rgba(255,165,40,.15); border-radius:8px; padding:.8rem 1rem; color:#ede8d8; font-family:'Nunito',sans-serif; font-size:.91rem; width:100%; outline:none; transition:all .22s; }
        .oi:focus { border-color:#ffb347; background:rgba(255,179,71,.04); box-shadow:0 0 0 3px rgba(255,179,71,.1); }
        .oi::placeholder { color:#504c74; }
        .ol-lbl { font-size:.76rem; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:#9890c2; display:block; margin-bottom:.42rem; }
        .ob { width:100%; padding:.9rem; background:linear-gradient(135deg,#ffb347,#ff6b35); color:#03030a; border:none; border-radius:10px; font-family:'Nunito',sans-serif; font-size:.95rem; font-weight:700; cursor:pointer; transition:all .22s; display:flex; align-items:center; justify-content:center; gap:8px; }
        .ob:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 7px 24px rgba(255,179,71,.4); }
        .ob:disabled { opacity:.55; cursor:not-allowed; transform:none; }
        .os { width:20px; height:20px; border:2.5px solid rgba(3,3,10,.3); border-top-color:#03030a; border-radius:50%; animation:sp .7s linear infinite; }
        @keyframes sp { to { transform:rotate(360deg); } }
        .feat { display:flex; align-items:center; gap:.65rem; font-size:.84rem; color:#504c74; margin-bottom:.55rem; }
        .feat em { font-style:normal; font-size:.95rem; }
        @media(max-width:800px) { .ol { display:none; } .or { width:100%; } }
      `}</style>

      {/* Left panel */}
      <div className="ol">
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.85rem', marginBottom:'2.5rem' }}>
            <div style={{ width:42, height:42, background:'rgba(255,179,71,.15)', border:'1px solid rgba(255,179,71,.3)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Shield size={20} color="#ffb347"/>
            </div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', fontWeight:700, color:'#ffb347' }}>Raid Cabs</div>
              <div style={{ fontSize:'.7rem', color:'#504c74', letterSpacing:'.08em', textTransform:'uppercase' }}>Operations Centre</div>
            </div>
          </div>

          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'2.5rem', fontWeight:900, color:'#ede8d8', lineHeight:1.15, marginBottom:'1.25rem' }}>
            Admin<br/>
            <span style={{ background:'linear-gradient(135deg,#ffb347,#ff6b35)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Operations<br/>Portal</span>
          </h1>

          <p style={{ color:'#9890c2', lineHeight:1.7, fontSize:'.93rem', maxWidth:320, marginBottom:'2.5rem' }}>
            Full control over the Raid Cabs platform — manage drivers, bookings, deposits, discounts, and users.
          </p>

          <div>
            {[
              ['🚗','Driver Management & Status'],
              ['💳','Deposit Approvals & Discounts'],
              ['📊','Revenue & Booking Overview'],
              ['🎯','Real-Time Booking Control'],
              ['👥','User Role Administration'],
              ['⚡','Live Updates via Supabase'],
            ].map(([em, l]) => (
              <div key={l} className="feat"><em>{em}</em> {l}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="or">
        <div className="oc">
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ width:52, height:52, background:'rgba(255,179,71,.12)', border:'1px solid rgba(255,179,71,.3)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto .9rem' }}>
              <Lock size={22} color="#ffb347"/>
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', fontWeight:700, color:'#ede8d8' }}>Admin Sign In</h2>
            <p style={{ color:'#504c74', fontSize:'.81rem', marginTop:'.3rem' }}>Restricted access · Authorised personnel only</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.15rem' }}>
            <div>
              <label className="ol-lbl">Email Address</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:'.82rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
                <input className="oi" type="email" placeholder="admin@raidcabs.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ paddingLeft:'2.5rem' }}/>
              </div>
            </div>

            <div>
              <label className="ol-lbl">Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={15} style={{ position:'absolute', left:'.82rem', top:'50%', transform:'translateY(-50%)', color:'#504c74', pointerEvents:'none' }}/>
                <input className="oi" type={showPw?'text':'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ paddingLeft:'2.5rem', paddingRight:'2.8rem' }}/>
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:'.82rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#504c74', display:'flex', padding:0 }}>
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            <button type="submit" className="ob" disabled={loading} style={{ marginTop:'.3rem' }}>
              {loading ? <div className="os"/> : <><Shield size={16}/> Access Operations Portal</>}
            </button>
          </form>

          {/* No back link — /ops should not be discoverable from the main site */}
        </div>
      </div>
    </div>
  )
}
