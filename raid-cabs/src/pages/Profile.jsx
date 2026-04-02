import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { User, Phone, Save, ArrowLeft, Shield, CreditCard, Lock, Bell, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, profile, updateProfile, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name:profile?.full_name||'', phone:profile?.phone||'' })
  const [pw, setPw]     = useState({ next:'', confirm:'' })
  const [saving, setSv] = useState(false)
  const [savingPw, setSvPw] = useState(false)
  const [notif, setNotif]   = useState(Notification?.permission==='granted')

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const saveProfile = async e => {
    e.preventDefault(); setSv(true)
    const {error} = await updateProfile(form)
    if(error) toast.error(error.message)
    else toast.success('Profile updated! ✓')
    setSv(false)
  }

  const changePassword = async e => {
    e.preventDefault()
    if(pw.next!==pw.confirm){toast.error('Passwords do not match');return}
    if(pw.next.length<6){toast.error('Min. 6 characters');return}
    setSvPw(true)
    const {error} = await updatePassword(pw.next)
    if(error) toast.error(error.message)
    else { toast.success('Password updated!'); setPw({next:'',confirm:''}) }
    setSvPw(false)
  }

  const requestNotif = async () => {
    const p = await Notification.requestPermission()
    setNotif(p==='granted')
    if(p==='granted') toast.success('Notifications enabled!')
    else toast.error('Notifications blocked by browser')
  }

  const tier = () => {
    const d = profile?.discount_percent||0
    if(d>=25) return {label:'💎 Diamond',color:'#a29bfe'}
    if(d>=20) return {label:'🏆 Platinum',color:'#74b9ff'}
    if(d>=15) return {label:'🥇 Gold',color:'var(--gold)'}
    if(d>=10) return {label:'🥈 Silver',color:'#b2bec3'}
    return {label:'🌱 Basic',color:'var(--ts)'}
  }
  const t = tier()

  return (
    <div className="main" style={{ padding:'2rem' }}>
      <div style={{ maxWidth:680,margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb2" onClick={()=>navigate('/dashboard')}><ArrowLeft size={14}/> Back</button>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',gap:'1.25rem',marginBottom:'2rem' }}>
          <div style={{ width:70,height:70,borderRadius:'50%',background:'linear-gradient(135deg,var(--gold),var(--orange))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--fd)',fontSize:'2rem',fontWeight:700,color:'#06060f',border:'3px solid rgba(255,179,71,.3)',flexShrink:0 }}>
            {profile?.full_name?.[0]?.toUpperCase()||'?'}
          </div>
          <div>
            <h1 className="h1">{profile?.full_name||'Your Profile'}</h1>
            <div style={{ display:'flex',gap:'.75rem',alignItems:'center',marginTop:'.4rem',flexWrap:'wrap' }}>
              <span style={{ color:t.color,fontWeight:700,fontSize:'.86rem' }}>{t.label}</span>
              {profile?.role==='admin'&&<span className="badge b-gold"><Shield size={8}/> Admin</span>}
              <span style={{ color:'var(--tm)',fontSize:'.8rem' }}>{user?.email||user?.phone||profile?.phone}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="g3 mb3">
          {[
            [<CreditCard size={17}/>,`₹${(profile?.balance||0).toLocaleString()}`,'Wallet','var(--gold)'],
            [<span style={{ fontSize:'1rem' }}>%</span>,`${profile?.discount_percent||0}%`,'Discount','var(--green)'],
            [<Shield size={17}/>,profile?.role==='admin'?'Admin':'Passenger','Role','var(--blue)'],
          ].map(([ic,v,l,c])=>(
            <div key={l} className="card2" style={{ textAlign:'center' }}>
              <div style={{ color:c,display:'flex',justifyContent:'center',marginBottom:'.4rem' }}>{ic}</div>
              <div style={{ fontFamily:'var(--fd)',fontSize:'1.35rem',fontWeight:700,color:c }}>{v}</div>
              <div style={{ fontSize:'.72rem',color:'var(--tm)',textTransform:'uppercase',letterSpacing:'.07em',marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Edit profile */}
        <div className="card mb3">
          <h2 className="h3 mb3"><User size={17} style={{ display:'inline',marginRight:8,verticalAlign:'middle' }}/>Edit Profile</h2>
          <form onSubmit={saveProfile} style={{ display:'flex',flexDirection:'column',gap:'1.1rem' }}>
            <div className="fg">
              <label className="label">Full Name</label>
              <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" value={form.full_name} onChange={set('full_name')} required placeholder="Your full name"/></div>
            </div>
            <div className="fg">
              <label className="label">Phone Number</label>
              <div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210"/></div>
            </div>
            <div className="fg">
              <label className="label">Email / Account ID</label>
              <input className="input" value={user?.email||user?.phone||'Phone account'} readOnly/>
              <p className="hint">Primary identifier cannot be changed.</p>
            </div>
            <button type="submit" className="btn btn-primary" style={{ alignSelf:'flex-start' }} disabled={saving}>
              {saving?<span className="spinner"/>:<><Save size={14}/> Save Changes</>}
            </button>
          </form>
        </div>

        {/* Change password (only for email accounts) */}
        {user?.email&&(
          <div className="card mb3">
            <h2 className="h3 mb3"><Lock size={17} style={{ display:'inline',marginRight:8,verticalAlign:'middle' }}/>Change Password</h2>
            <form onSubmit={changePassword} style={{ display:'flex',flexDirection:'column',gap:'1.1rem' }}>
              <div className="fg">
                <label className="label">New Password</label>
                <input className="input" type="password" placeholder="Min. 6 characters" value={pw.next} onChange={e=>setPw(p=>({...p,next:e.target.value}))} required minLength={6}/>
              </div>
              <div className="fg">
                <label className="label">Confirm Password</label>
                <input className="input" type="password" placeholder="Repeat new password" value={pw.confirm} onChange={e=>setPw(p=>({...p,confirm:e.target.value}))} required/>
                {pw.confirm&&pw.next!==pw.confirm&&<p className="err">Passwords do not match</p>}
              </div>
              <button type="submit" className="btn btn-outline" style={{ alignSelf:'flex-start' }} disabled={savingPw||pw.next!==pw.confirm}>
                {savingPw?<span className="spinner"/>:<><Lock size={14}/> Update Password</>}
              </button>
            </form>
          </div>
        )}

        {/* Notifications */}
        <div className="card">
          <h2 className="h3 mb2"><Bell size={17} style={{ display:'inline',marginRight:8,verticalAlign:'middle' }}/>Notifications</h2>
          <p style={{ color:'var(--ts)',fontSize:'.86rem',marginBottom:'1rem' }}>Get browser notifications when your cab is confirmed or arrives.</p>
          {notif
            ? <div className="good-box"><CheckCircle size={15} style={{ flexShrink:0 }}/> Push notifications are enabled.</div>
            : <button className="btn btn-outline" onClick={requestNotif}><Bell size={14}/> Enable Notifications</button>
          }
        </div>
      </div>
    </div>
  )
}
