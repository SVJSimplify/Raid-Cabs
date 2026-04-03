import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LayoutDashboard, History, User, ChevronDown, LogOut, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  const at  = p => location.pathname === p ? 'nav-link active' : 'nav-link'
  const ini = () => {
    if (profile?.full_name) return profile.full_name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
    if (user?.email)  return user.email[0].toUpperCase()
    if (user?.phone)  return user.phone.slice(-2)
    return '?'
  }

  if (!user) return (
    <nav className="nav">
      <Link to="/login" className="nav-brand">
        <img src="/logo.png" alt="" className="nav-logo" onError={e=>e.target.style.display='none'}/>
        <span className="nav-name">RaidCabs</span>
      </Link>
      {location.pathname !== '/login' && (
        <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>
      )}
    </nav>
  )

  return (
    <nav className="nav">
      <Link to="/dashboard" className="nav-brand">
        <img src="/logo.png" alt="" className="nav-logo" onError={e=>{e.target.style.display='none'}}/>
        <span className="nav-name">RaidCabs</span>
      </Link>

      <div className="nav-links">
        <Link to="/dashboard" className={at('/dashboard') + ' hide-mob'}><LayoutDashboard size={14}/> Home</Link>
        <Link to="/book"      className={at('/book')      + ' hide-mob'}>🚖 Book</Link>
        <Link to="/history"   className={at('/history')   + ' hide-mob'}><History size={14}/> Trips</Link>

        <div style={{ position:'relative' }} ref={ref}>
          <button onClick={() => setOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:5, background:'transparent', border:'none', cursor:'pointer', padding:'4px 5px', borderRadius:'var(--rs)' }}>
            <div className="nav-avatar">{ini()}</div>
            <ChevronDown size={13} style={{ color:'var(--tm)', transition:'transform .2s', transform:open?'rotate(180deg)':'none' }}/>
          </button>

          {open && (
            <div className="nav-drop">
              <div style={{ padding:'.85rem 1rem', borderBottom:'1px solid var(--b1)', background:'rgba(255,255,255,.02)' }}>
                <div style={{ fontWeight:600, fontSize:'.87rem' }}>{profile?.full_name || 'User'}</div>
                <div style={{ color:'var(--tm)', fontSize:'.73rem', marginTop:1 }}>{user?.email || user?.phone || ''}</div>
                {(profile?.discount_percent||0) > 0 && (
                  <span className="badge b-gold" style={{ marginTop:5, fontSize:'.62rem' }}>
                    {profile.discount_percent}% concession active
                  </span>
                )}
              </div>

              {[
                ['/dashboard',  <LayoutDashboard size={13}/>, 'Dashboard'],
                ['/book',       '🚖',                         'Book a Cab'],
                ['/deposit',    <CreditCard size={13}/>,      'Deposit Money'],
                ['/history',    <History size={13}/>,         'My Trips'],
                ['/profile',    <User size={13}/>,            'Profile & Safety'],
              ].map(([to, icon, label]) => (
                <Link key={to} to={to} onClick={()=>setOpen(false)} className="nav-drop-item">
                  {icon} {label}
                </Link>
              ))}

              <div style={{ borderTop:'1px solid var(--b1)', padding:'.4rem' }}>
                <button onClick={handleSignOut} className="nav-drop-item" style={{ color:'var(--red)', width:'100%', textAlign:'left' }}>
                  <LogOut size={13}/> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
