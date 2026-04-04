import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Save, ArrowLeft, Shield, Lock, Bell, CheckCircle, Heart, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, profile, updateProfile, updatePassword } = useAuth()
  const navigate = useNavigate()

  const [form,     setForm]    = useState({
    full_name:               profile?.full_name  || '',
    phone:                   profile?.phone      || '',
    emergency_contact_name:  profile?.emergency_contact_name  || '',
    emergency_contact_phone: profile?.emergency_contact_phone || '',
  })
  const [pw,       setPw]      = useState({ next:'', confirm:'' })
  const [saving,   setSv]      = useState(false)
  const [savingPw, setSvPw]    = useState(false)
  const [notif,    setNotif]   = useState(Notification?.permission === 'granted')
  const [tab,      setTab]     = useState('profile') // profile|safety|password

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const saveProfile = async e => {
    e.preventDefault()
    setSv(true)
    const { error } = await updateProfile(form)
    if (error) toast.error(error.message || 'Failed to save')
    else       toast.success('Profile saved ✓')
    setSv(false)
  }

  const savePw = async e => {
    e.preventDefault()
    if (pw.next !== pw.confirm) { toast.error('Passwords do not match'); return }
    if (pw.next.length < 6)    { toast.error('Password must be 6+ characters'); return }
    setSvPw(true)
    const { error } = await updatePassword(pw.next)
    if (error) toast.error(error.message)
    else { toast.success('Password updated ✓'); setPw({ next:'', confirm:'' }) }
    setSvPw(false)
  }

  const enableNotif = async () => {
    const perm = await Notification.requestPermission()
    setNotif(perm === 'granted')
    if (perm === 'granted') toast.success('Notifications enabled ✓')
    else toast.error('Notifications blocked — allow in browser settings')
  }

  const hasEmergencyContact = Boolean(form.emergency_contact_name && form.emergency_contact_phone)

  return (
    <div className="main page-pad">
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb3" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={14}/> Back
        </button>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'1.1rem', marginBottom:'2rem' }}>
          <div style={{ width:58, height:58, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--orange))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--fd)', fontSize:'1.5rem', fontWeight:900, color:'#05050e', flexShrink:0 }}>
            {(profile?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <h1 className="h2">{profile?.full_name || 'Your Profile'}</h1>
            <p className="sub">{user?.email || user?.phone || ''}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs mb3">
          {[['profile', <User size={14}/>, 'Profile'],['safety', <Shield size={14}/>, 'Safety'],['password', <Lock size={14}/>, 'Password']].map(([id, icon, label]) => (
            <button key={id} className={`tab ${tab===id?'on':''}`} onClick={() => setTab(id)}>
              {icon} {label}
              {id === 'safety' && !hasEmergencyContact && (
                <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--red)', display:'inline-block', marginLeft:4 }}/>
              )}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ─────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="card fu">
            <form onSubmit={saveProfile} style={{ display:'flex', flexDirection:'column', gap:'1.35rem' }}>
              <div className="fg">
                <label className="label">Full Name</label>
                <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Your full name" value={form.full_name} onChange={set('full_name')}/></div>
              </div>
              <div className="fg">
                <label className="label">Phone</label>
                <div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')}/></div>
              </div>

              <div style={{ paddingTop:'1rem', borderTop:'1px solid var(--b1)' }}>
                <div style={{ fontWeight:700, fontSize:'.88rem', marginBottom:'.75rem', display:'flex', alignItems:'center', gap:7 }}>
                  <Bell size={15} style={{ color:'var(--gold)' }}/> Push Notifications
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem', background:'rgba(255,255,255,.03)', border:'1px solid var(--b1)', borderRadius:'var(--rs)' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'.87rem' }}>Ride updates</div>
                    <div style={{ fontSize:'.75rem', color:'var(--ts)', marginTop:1 }}>Driver assigned, trip started, completed</div>
                  </div>
                  {notif
                    ? <span className="badge b-green"><CheckCircle size={10}/> Enabled</span>
                    : <button type="button" onClick={enableNotif} className="btn btn-outline btn-sm">Enable</button>
                  }
                </div>
              </div>

              <div style={{ paddingTop:'.5rem', borderTop:'1px solid var(--b1)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.5rem' }}>
                  <span style={{ color:'var(--tm)', fontSize:'.83rem' }}>Balance</span>
                  <span style={{ fontFamily:'var(--fd)', fontWeight:700, color:'var(--gold)' }}>₹{Number(profile?.balance||0).toLocaleString()}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--tm)', fontSize:'.83rem' }}>Concession</span>
                  <span className="badge b-gold">{profile?.discount_percent||0}%</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-blk" disabled={saving}>
                {saving ? <span className="spinner"/> : <><Save size={15}/> Save Profile</>}
              </button>
            </form>
          </div>
        )}

        {/* ── SAFETY TAB ──────────────────────────────────────────── */}
        {tab === 'safety' && (
          <div className="fu">
            {/* Emergency contact */}
            <div className="card mb2">
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'1.25rem' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(231,76,60,.1)', border:'1px solid rgba(231,76,60,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Heart size={17} color="var(--red)"/>
                </div>
                <div>
                  <div style={{ fontWeight:700 }}>Emergency Contact</div>
                  <div style={{ fontSize:'.76rem', color:'var(--ts)' }}>Gets notified instantly when you press SOS</div>
                </div>
              </div>

              <form onSubmit={saveProfile} style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
                <div className="fg">
                  <label className="label">Contact Name</label>
                  <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="e.g. Mum, Dad, Roommate" value={form.emergency_contact_name} onChange={set('emergency_contact_name')}/></div>
                </div>
                <div className="fg">
                  <label className="label">Contact Phone</label>
                  <div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" placeholder="+91 98765 43210" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')}/></div>
                  <p className="hint">In an emergency, they'll receive your location + driver details via WhatsApp</p>
                </div>

                {hasEmergencyContact && (
                  <div className="good-box">
                    <CheckCircle size={14} style={{ flexShrink:0 }}/>
                    <span><strong>{form.emergency_contact_name}</strong> will be notified in case of SOS.</span>
                  </div>
                )}
                {!hasEmergencyContact && (
                  <div className="warn-box">
                    <AlertTriangle size={14} style={{ flexShrink:0 }}/>
                    <span>No emergency contact set. Add one to enable automatic SOS notifications.</span>
                  </div>
                )}
                <button type="submit" className="btn btn-primary btn-blk" disabled={saving}>
                  {saving ? <span className="spinner"/> : <><Save size={15}/> Save Emergency Contact</>}
                </button>
              </form>
            </div>

            {/* Safety info cards */}
            <div className="card mb2">
              <div style={{ fontWeight:700, marginBottom:'1rem', display:'flex', alignItems:'center', gap:7 }}>
                <Shield size={15} style={{ color:'var(--gold)' }}/> Safety Features Available
              </div>
              {[
                ['🆘', 'SOS Button',        'In every active booking. Alerts admin + your emergency contact instantly.'],
                ['📲', 'Trip Sharing',       'Share trip details + live location via WhatsApp or copy to clipboard.'],
                ['🚨', 'Emergency Call',     'One tap to call 112 (National Emergency) or IIT Campus Security.'],
                ['👤', 'Driver Verification','Vehicle plate + driver name shown at every step. Verify before boarding.'],
                ['✅', 'Arrive Safe',        'Mark yourself safe after arriving at IIT. Admin notified if not marked.'],
              ].map(([em, title, desc]) => (
                <div key={title} style={{ display:'flex', gap:'.85rem', padding:'.7rem 0', borderBottom:'1px solid var(--b1)' }}>
                  <span style={{ fontSize:'1.3rem', flexShrink:0 }}>{em}</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'.88rem' }}>{title}</div>
                    <div style={{ fontSize:'.76rem', color:'var(--ts)', marginTop:2, lineHeight:1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency numbers */}
            <div className="card">
              <div style={{ fontWeight:700, marginBottom:'1rem' }}>📞 Emergency Numbers</div>
              {[
                ['🚨', '112',          'National Emergency (Police, Fire, Medical)', '#e74c3c'],
                ['🏥', '102',          'Ambulance', '#e74c3c'],
                ['👮', '100',          'Police', '#3498db'],
                ['🔥', '101',          'Fire', '#ff6b35'],
                ['🏫', '040-2301-6000','IIT Hyderabad Campus Security', '#9b59b6'],
                ['🚑', '040-2301-7000','IIT Hyderabad Medical Centre', '#2ecc71'],
              ].map(([em, num, label, c]) => (
                <a key={num} href={`tel:${num.replace(/-/g,'')}`}
                  style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'.65rem 0', borderBottom:'1px solid var(--b1)', textDecoration:'none' }}>
                  <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{em}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:c, fontSize:'.9rem' }}>{num}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--ts)' }}>{label}</div>
                  </div>
                  <Phone size={13} style={{ color:'var(--tm)' }}/>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── PASSWORD TAB ─────────────────────────────────────────── */}
        {tab === 'password' && (
          <div className="card fu">
            <h3 className="h3 mb3"><Lock size={16} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--gold)' }}/>Change Password</h3>
            <form onSubmit={savePw} style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
              <div className="fg">
                <label className="label">New Password</label>
                <input className="input" type="password" placeholder="At least 6 characters" value={pw.next} onChange={e=>setPw(p=>({...p,next:e.target.value}))} required minLength={6}/>
              </div>
              <div className="fg">
                <label className="label">Confirm Password</label>
                <input className="input" type="password" placeholder="Repeat password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))} required/>
                {pw.confirm && pw.next !== pw.confirm && <p className="err">Passwords don't match</p>}
              </div>
              <button type="submit" className="btn btn-primary btn-blk" disabled={savingPw}>
                {savingPw ? <span className="spinner"/> : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
