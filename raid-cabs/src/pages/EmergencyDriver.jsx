import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { AlertTriangle, Phone, User, Car, Hash, CheckCircle, ArrowLeft, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EmergencyDriver() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', phone:'', vehicle_number:'', vehicle_model:'' })
  const [loading, setLd] = useState(false)
  const [done, setDone]  = useState(null)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const handleSubmit = async e => {
    e.preventDefault()
    setLd(true)
    const { data, error } = await q(() => supabase.from('drivers').insert({
      ...form, rating:4.0, status:'available', is_emergency:true,
    }).select().single())
    if (error) {
      if (error.message?.includes('unique')) toast.error('Phone number already registered.')
      else toast.error(error.message||'Failed')
    } else {
      setDone(data); toast.success('Emergency driver created!')
    }
    setLd(false)
  }

  if (done) return (
    <div className="main" style={{ padding:'4rem 2rem', textAlign:'center' }}>
      <div className="mw480 fu">
        <div style={{ width:80,height:80,background:'rgba(255,179,71,.15)',border:'2px solid rgba(255,179,71,.4)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.5rem',color:'var(--gold)' }}>
          <CheckCircle size={40}/>
        </div>
        <h1 className="h2 mb1">Emergency Driver Created</h1>
        <p className="sub mb3"><strong style={{ color:'var(--gold)' }}>{done.name}</strong> is now available. Assign from Admin → Drivers.</p>
        <div className="card mb3">
          {[['Name',done.name],['Phone',done.phone],['Vehicle',done.vehicle_number||'—'],['Model',done.vehicle_model||'—'],['Type','Emergency ⚠️']].map(([l,v])=>(
            <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ fontWeight:600, color:l==='Type'?'var(--red)':'var(--tp)' }}>{v}</span></div>
          ))}
        </div>
        <div className="flex g2r">
          <button className="btn btn-outline w100" onClick={()=>{ setDone(null); setForm({name:'',phone:'',vehicle_number:'',vehicle_model:''}) }}>Create Another</button>
          <button className="btn btn-primary w100" onClick={()=>navigate('/admin')}>Go to Admin</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="main" style={{ padding:'2.5rem 2rem' }}>
      <div className="mw480">
        <button className="btn btn-ghost btn-sm mb3" onClick={()=>navigate('/admin')}><ArrowLeft size={14}/> Admin Panel</button>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem' }}>
          <div style={{ width:50,height:50,background:'rgba(231,76,60,.12)',border:'1px solid rgba(231,76,60,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--red)' }}><AlertTriangle size={22}/></div>
          <div><h1 className="h2">Emergency Driver</h1><p className="sub">Temporary emergency account</p></div>
        </div>

        <div className="err-box mb3">
          <AlertTriangle size={16} style={{ flexShrink:0 }}/>
          <span>Use only when no regular drivers are available. These accounts are clearly marked <strong>Emergency</strong> in the system.</span>
        </div>

        <div className="card fu">
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.35rem' }}>
            <div className="fg">
              <label className="label">Full Name</label>
              <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Emergency driver name" value={form.name} onChange={set('name')} required/></div>
            </div>
            <div className="fg">
              <label className="label">Phone Number</label>
              <div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} required/></div>
            </div>
            <div className="fg">
              <label className="label">Vehicle Number</label>
              <div className="input-wrap"><Hash size={15} className="ico"/><input className="input" type="text" placeholder="e.g. TS 09 AB 1234" value={form.vehicle_number} onChange={set('vehicle_number')} required/></div>
            </div>
            <div className="fg">
              <label className="label">Vehicle Model (optional)</label>
              <div className="input-wrap"><Car size={15} className="ico"/><input className="input" type="text" placeholder="e.g. Toyota Innova" value={form.vehicle_model} onChange={set('vehicle_model')}/></div>
            </div>
            <div className="warn-box">
              <Zap size={14} style={{ flexShrink:0 }}/>
              <span>Will be marked as <strong style={{ color:'var(--red)' }}>Emergency Driver</strong> with red badge throughout the system.</span>
            </div>
            <button type="submit" disabled={loading}
              className="btn btn-blk btn-lg btn-danger"
              style={{ background:'linear-gradient(135deg,var(--red),#c0392b)', color:'#fff', border:'none', boxShadow:'0 4px 20px rgba(231,76,60,.3)' }}>
              {loading ? <span className="spinner"/> : <><AlertTriangle size={17}/> Create Emergency Driver</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
