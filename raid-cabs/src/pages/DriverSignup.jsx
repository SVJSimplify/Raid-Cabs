import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { User, Phone, Hash, Car, CheckCircle, Clock, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

// Format license plate as user types: TS 09 AB 1234
function formatPlate(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const parts = []
  if (clean.length > 0) parts.push(clean.slice(0, 2))
  if (clean.length > 2) parts.push(clean.slice(2, 4))
  if (clean.length > 4) parts.push(clean.slice(4, 6))
  if (clean.length > 6) parts.push(clean.slice(6, 10))
  return parts.join(' ')
}

// Validate Indian license plate: XX 00 XX 0000  or  XX 00 XXX 0000
function isValidPlate(plate) {
  return /^[A-Z]{2}\s\d{2}\s[A-Z]{1,3}\s\d{4}$/.test(plate.trim())
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10
}

export default function DriverSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name:           '',
    phone:          '',
    vehicle_number: '',
    vehicle_model:  '',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  const set = k => e => {
    const val = k === 'vehicle_number' ? formatPlate(e.target.value) : e.target.value
    setForm(f => ({ ...f, [k]: val }))
  }

  const plateValid  = isValidPlate(form.vehicle_number)
  const phoneValid  = isValidPhone(form.phone)
  const formValid   = form.name.trim() && phoneValid && form.vehicle_number && plateValid && form.vehicle_model.trim()

  const handleSubmit = async e => {
    e.preventDefault()
    if (!plateValid) { toast.error('Enter a valid Indian plate — e.g. TS 09 AB 1234'); return }
    if (!phoneValid)  { toast.error('Enter a valid phone number'); return }

    setLoading(true)
    const { error } = await q(() => supabase.from('drivers').insert({
      name:           form.name.trim(),
      phone:          form.phone.trim(),
      vehicle_number: form.vehicle_number.trim(),
      vehicle_model:  form.vehicle_model.trim(),
      rating:         5.0,
      total_ratings:  0,
      status:         'available',
      is_approved:    false,
      is_emergency:   false,
    }))

    if (error) {
      if (error.message?.includes('unique') || error.message?.includes('duplicate'))
        toast.error('This phone number is already registered.')
      else
        toast.error(error.message || 'Submission failed. Try again.')
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  if (done) return (
    <div className="main" style={{ padding:'4rem 2rem', display:'flex', justifyContent:'center' }}>
      <div style={{ maxWidth:460, width:'100%', textAlign:'center' }}>
        <div style={{ width:88, height:88, background:'rgba(255,179,71,.12)', border:'2px solid rgba(255,179,71,.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', color:'var(--gold)' }}>
          <Clock size={44}/>
        </div>
        <h1 className="h2 mb2">Application Submitted!</h1>
        <p style={{ color:'var(--ts)', lineHeight:1.75, marginBottom:'2rem', fontSize:'.95rem' }}>
          Your driver application has been received. The admin will review and approve it shortly. You'll be able to receive rides once approved.
        </p>

        <div className="card mb3" style={{ textAlign:'left' }}>
          {[
            ['Name',    form.name],
            ['Phone',   form.phone],
            ['Vehicle', form.vehicle_number],
            ['Model',   form.vehicle_model],
            ['Status',  '⏳ Pending admin approval'],
          ].map(([l, v]) => (
            <div key={l} className="fare-r">
              <span style={{ color:'var(--tm)' }}>{l}</span>
              <span style={{ fontWeight:600, color: l==='Status'?'var(--gold)':'var(--tp)' }}>{v}</span>
            </div>
          ))}
        </div>

        <div className="good-box mb3">
          <CheckCircle size={15} style={{ flexShrink:0 }}/>
          <span>Once approved by admin your account will be activated and you'll start receiving ride assignments.</span>
        </div>

        <div style={{ display:'flex', gap:'1rem' }}>
          <button className="btn btn-outline w100" onClick={() => { setDone(false); setForm({ name:'', phone:'', vehicle_number:'', vehicle_model:'' }) }}>
            Submit Another
          </button>
          <Link to="/login" className="btn btn-primary w100">Go to App</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="main" style={{ padding:'2.5rem 2rem' }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb3" onClick={() => navigate('/login')}>
          <ArrowLeft size={14}/> Back
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'2rem' }}>
          <div style={{ width:52, height:52, background:'rgba(255,179,71,.12)', border:'1px solid var(--b2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gold)', flexShrink:0 }}>
            <Car size={22}/>
          </div>
          <div>
            <h1 className="h2">Driver Application</h1>
            <p className="sub">Join the Raid Cabs fleet — admin approval required</p>
          </div>
        </div>

        <div className="card fu">
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.4rem' }}>

            {/* Full Name */}
            <div className="fg">
              <label className="label">Full Name</label>
              <div className="input-wrap">
                <User size={15} className="ico"/>
                <input className="input" type="text" placeholder="Your full name" value={form.name} onChange={set('name')} required/>
              </div>
            </div>

            {/* Phone */}
            <div className="fg">
              <label className="label">Phone Number</label>
              <div className="input-wrap">
                <Phone size={15} className="ico"/>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} required/>
              </div>
              {form.phone && !phoneValid && (
                <p className="err">Enter a valid 10-digit phone number</p>
              )}
            </div>

            {/* License Plate */}
            <div className="fg">
              <label className="label">Vehicle Registration Number</label>
              <div className="input-wrap">
                <Hash size={15} className="ico"/>
                <input
                  className="input"
                  type="text"
                  placeholder="TS 09 AB 1234"
                  value={form.vehicle_number}
                  onChange={set('vehicle_number')}
                  maxLength={13}
                  required
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                    borderColor: form.vehicle_number
                      ? plateValid ? 'rgba(46,204,113,.5)' : 'rgba(231,76,60,.5)'
                      : undefined,
                  }}
                />
              </div>
              <p className="hint">Format: STATE CODE · DISTRICT · SERIES · NUMBER — e.g. <strong>TS 09 AB 1234</strong></p>
              {form.vehicle_number && !plateValid && (
                <p className="err">Invalid format — must be like TS 09 AB 1234</p>
              )}
              {form.vehicle_number && plateValid && (
                <p style={{ fontSize:'.74rem', color:'var(--green)', marginTop:'.2rem', display:'flex', alignItems:'center', gap:4 }}>
                  <CheckCircle size={11}/> Valid plate format
                </p>
              )}
            </div>

            {/* Vehicle Model — free text */}
            <div className="fg">
              <label className="label">Vehicle Make & Model</label>
              <div className="input-wrap">
                <Car size={15} className="ico"/>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. Toyota Innova Crysta 2022"
                  value={form.vehicle_model}
                  onChange={set('vehicle_model')}
                  required
                />
              </div>
              <p className="hint">Enter the full vehicle name as you'd like passengers to see it</p>
            </div>

            {/* Info box */}
            <div className="info-box">
              <Clock size={14} style={{ flexShrink:0 }}/>
              <span>Your application will be reviewed by admin before you can receive ride assignments. You'll be notified once approved.</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-blk btn-lg"
              disabled={loading || !formValid}
            >
              {loading ? <span className="spinner"/> : '🚗 Submit Application'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
