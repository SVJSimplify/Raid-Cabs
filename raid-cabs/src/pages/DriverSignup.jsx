import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { User, Phone, Hash, Car, ArrowLeft, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const MODELS = ['Toyota Innova','Maruti Swift','Hyundai Creta','Mahindra Xylo','Tata Nexon','Honda City']

export default function DriverSignup() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ name:'', phone:'', vehicle_number:'', vehicle_model:'Toyota Innova' })
  const [rating, setRtg]  = useState(5)
  const [loading, setLd]  = useState(false)
  const [done, setDone]   = useState(null)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const handleSubmit = async e => {
    e.preventDefault()
    setLd(true)
    const { data, error } = await q(() => supabase.from('drivers').insert({
      ...form, rating, status:'available', is_emergency:false,
    }).select().single())
    if (error) {
      if (error.message?.includes('unique')) toast.error('This phone number is already registered.')
      else toast.error(error.message || 'Registration failed')
    } else {
      setDone(data)
      toast.success('Driver registered!')
    }
    setLd(false)
  }

  if (done) return (
    <div className="main" style={{ padding:'4rem 2rem', textAlign:'center' }}>
      <div className="mw480 fu">
        <div style={{ width:80,height:80,background:'rgba(46,204,113,.12)',border:'2px solid rgba(46,204,113,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.5rem',color:'var(--green)' }}>
          <CheckCircle size={40}/>
        </div>
        <h1 className="h2 mb1">Welcome to the Team!</h1>
        <p className="sub mb3"><strong style={{ color:'var(--gold)' }}>{done.name}</strong> has been registered. The admin will assign rides to you.</p>
        <div className="card mb3">
          {[['Name',done.name],['Phone',done.phone],['Vehicle',done.vehicle_number||'—'],['Model',done.vehicle_model]].map(([l,v])=>(
            <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ fontWeight:600 }}>{v}</span></div>
          ))}
        </div>
        <div className="flex g2r">
          <button className="btn btn-outline w100" onClick={()=>{ setDone(null); setForm({name:'',phone:'',vehicle_number:'',vehicle_model:'Toyota Innova'}); setRtg(5) }}>Register Another</button>
          <button className="btn btn-primary w100" onClick={()=>navigate('/login')}>Go to Login</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="main" style={{ padding:'2.5rem 2rem' }}>
      <div className="mw480">
        <button className="btn btn-ghost btn-sm mb3" onClick={()=>navigate('/login')}><ArrowLeft size={14}/> Back to Login</button>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'2rem' }}>
          <div style={{ width:50,height:50,background:'rgba(255,179,71,.12)',border:'1px solid var(--b2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--gold)' }}><Car size={22}/></div>
          <div><h1 className="h2">Driver Registration</h1><p className="sub">Join the Raid Cabs fleet</p></div>
        </div>

        <div className="card fu">
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.35rem' }}>
            <div className="fg">
              <label className="label">Full Name</label>
              <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Driver's full name" value={form.name} onChange={set('name')} required/></div>
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
              <label className="label">Vehicle Model</label>
              <select className="input" value={form.vehicle_model} onChange={set('vehicle_model')}>
                {MODELS.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="label">Initial Rating</label>
              <div style={{ display:'flex', gap:'.4rem' }}>
                {[1,2,3,4,5].map(s=>(
                  <span key={`star-${s}`} onClick={()=>setRtg(s)} style={{ fontSize:'1.8rem', cursor:'pointer', color:s<=rating?'var(--gold)':'var(--tm)', transition:'color .15s, transform .15s', transform:s<=rating?'scale(1.1)':'scale(1)', display:'inline-block' }}>★</span>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading}>
              {loading ? <span className="spinner"/> : '🚗 Register Driver'}
            </button>
            <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--tm)' }}>
              Admin? <Link to="/login" style={{ color:'var(--gold)', fontWeight:700 }}>Sign in here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
