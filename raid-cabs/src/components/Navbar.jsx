import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Settings, LayoutDashboard, History, User, ChevronDown, AlertTriangle, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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

  const isAdmin = profile?.role === 'admin'
  const initials = profile?.full_name?.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
    || user?.email?.[0]?.toUpperCase() || user?.phone?.[user.phone.length-2]?.toUpperCase() || '?'

  const at = p => location.pathname === p ? 'nav-link active' : 'nav-link'

  if (!user) return (
    <nav className="nav">
      <Link to="/login" className="nav-brand">
        <img src="/logo.png" alt="" className="nav-logo" onError={e=>e.target.style.display='none'}/>
        <span className="nav-name">Raid Cabs</span>
      </Link>
      {location.pathname !== '/login' && <Link to="/login" className="btn btn-primary btn-sm">Sign In</Link>}
    </nav>
  )

  return (
    <nav className="nav">
      <Link to="/dashboard" className="nav-brand">
        <img src="/logo.png" alt="" className="nav-logo" onError={e=>e.target.style.display='none'}/>
        <span className="nav-name">Raid Cabs</span>
      </Link>

      <div className="nav-links">
        <Link to="/dashboard" className={at('/dashboard') + ' hide-mob'}><LayoutDashboard size={14}/> Home</Link>
        <Link to="/book"      className={at('/book')      + ' hide-mob'}>🚖 Book</Link>
        <Link to="/history"   className={at('/history')   + ' hide-mob'}><History size={14}/> Trips</Link>
        {isAdmin && (
          <Link to="/admin" className={at('/admin') + ' hide-mob'} style={{ color:'var(--gold)' }}><Shield size={14}/> Admin</Link>
        )}

        {/* Avatar dropdown */}
        <div style={{ position:'relative' }} ref={ref}>
          <button onClick={() => setOpen(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:'var(--rs)' }}>
            <div className="nav-avatar">{initials}</div>
            <ChevronDown size={13} style={{ color:'var(--tm)', transition:'transform .2s', transform:open?'rotate(180deg)':'none' }}/>
          </button>

          {open && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:230, background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', boxShadow:'0 20px 60px rgba(0,0,0,.75)', zIndex:500, overflow:'hidden', animation:'scaleIn .18s var(--ease)' }}>
              <div style={{ padding:'.95rem 1rem', borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,.02)' }}>
                <div style={{ fontWeight:700, fontSize:'.88rem' }}>{profile?.full_name || 'User'}</div>
                <div style={{ color:'var(--tm)', fontSize:'.75rem', marginTop:2 }}>
                  {profile?.phone || user?.email || user?.phone}
                </div>
                {isAdmin && <span className="badge b-gold mt1" style={{ fontSize:'.64rem' }}><Shield size={8}/> Admin</span>}
              </div>

              {[
                ['/dashboard', <LayoutDashboard size={14}/>, 'Dashboard'],
                ['/book',      '🚖', 'Book a Cab'],
                ['/history',   <History size={14}/>, 'My Trips'],
                ['/profile',   <User size={14}/>, 'Profile'],
                isAdmin && ['/admin', <Shield size={14}/>, 'Admin Panel', 'var(--gold)'],
                isAdmin && ['/emergency-driver', <AlertTriangle size={14}/>, 'Emergency Driver', 'var(--red)'],
              ].filter(Boolean).map(([to,icon,label,color]) => (
                <Link key={to} to={to} onClick={()=>setOpen(false)}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'.72rem 1rem', color:color||'var(--ts)', textDecoration:'none', fontSize:'.86rem', fontWeight:600 }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {icon} {label}
                </Link>
              ))}

              <div style={{ borderTop:'1px solid var(--border)', padding:'.4rem' }}>
                <button onClick={handleSignOut}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'.62rem .75rem', color:'var(--red)', background:'transparent', border:'none', cursor:'pointer', width:'100%', fontSize:'.86rem', borderRadius:'var(--rx)', fontWeight:600, fontFamily:'var(--fb)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(231,76,60,.08)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <LogOut size={14}/> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
