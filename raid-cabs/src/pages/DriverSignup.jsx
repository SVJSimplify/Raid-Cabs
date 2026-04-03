import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, q } from '../lib/supabase'
import { User, Phone, Hash, Car, CheckCircle, Clock, ArrowLeft, Camera, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

function formatPlate(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const parts = []
  if (clean.length > 0) parts.push(clean.slice(0,2))
  if (clean.length > 2) parts.push(clean.slice(2,4))
  if (clean.length > 4) parts.push(clean.slice(4,6))
  if (clean.length > 6) parts.push(clean.slice(6,10))
  return parts.join(' ')
}

function isValidPlate(p) {
  return /^[A-Z]{2}\s\d{2}\s[A-Z]{1,3}\s\d{4}$/.test(p.trim())
}

export default function DriverSignup() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [form, setForm] = useState({
    name: '', phone: '', vehicle_number: '', vehicle_model: '',
  })
  const [photoFile,    setPhotoFile]    = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [done,         setDone]         = useState(false)

  const set = k => e => {
    const val = k === 'vehicle_number' ? formatPlate(e.target.value) : e.target.value
    setForm(f => ({ ...f, [k]: val }))
  }

  const handlePhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadPhoto = async () => {
    if (!photoFile) return null
    setUploading(true)
    const ext  = photoFile.name.split('.').pop()
    const path = `${Date.now()}-${form.phone.replace(/\D/g,'')}.${ext}`
    const { error } = await supabase.storage.from('drivers').upload(path, photoFile, {
      contentType: photoFile.type,
      upsert: true,
    })
    setUploading(false)
    if (error) { toast.error('Photo upload failed: ' + error.message); return null }
    const { data } = supabase.storage.from('drivers').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!photoFile) { toast.error('Please add your photo — passengers need to verify you'); return }
    if (!isValidPlate(form.vehicle_number)) { toast.error('Enter a valid plate — e.g. TS 09 AB 1234'); return }
    if (form.phone.replace(/\D/g,'').length < 10) { toast.error('Enter a valid 10-digit phone number'); return }

    setLoading(true)

    const photoUrl = await uploadPhoto()
    if (!photoUrl) { setLoading(false); return }

    const { error } = await q(() => supabase.from('drivers').insert({
      name:           form.name.trim(),
      phone:          form.phone.trim(),
      vehicle_number: form.vehicle_number.trim(),
      vehicle_model:  form.vehicle_model.trim(),
      photo_url:      photoUrl,
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
        toast.error(error.message || 'Registration failed. Try again.')
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  const plateValid = isValidPlate(form.vehicle_number)
  const formOk     = form.name && form.phone.replace(/\D/g,'').length >= 10 && plateValid && form.vehicle_model && photoFile

  if (done) return (
    <div className="main" style={{ padding:'4rem 2rem', display:'flex', justifyContent:'center' }}>
      <div style={{ maxWidth:460, width:'100%', textAlign:'center' }}>
        <div style={{ width:88, height:88, background:'rgba(255,179,71,.12)', border:'2px solid rgba(255,179,71,.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', color:'var(--gold)' }}>
          <Clock size={44}/>
        </div>
        <h1 className="h2 mb2">Application Submitted!</h1>
        <p style={{ color:'var(--ts)', lineHeight:1.75, marginBottom:'2rem' }}>
          Your application is with admin for review. You'll be able to log in once approved.
        </p>
        {photoPreview && (
          <img src={photoPreview} alt="" style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--gold)', margin:'0 auto 1.5rem', display:'block' }}/>
        )}
        <div className="card mb3" style={{ textAlign:'left' }}>
          {[['Name',form.name],['Phone',form.phone],['Vehicle',form.vehicle_number],['Model',form.vehicle_model],['Photo','✓ Uploaded'],['Status','⏳ Pending Approval']].map(([l,v]) => (
            <div key={l} className="fare-r">
              <span style={{ color:'var(--tm)' }}>{l}</span>
              <span style={{ fontWeight:600, color: l==='Status'?'var(--gold)':l==='Photo'?'var(--green)':'var(--tp)' }}>{v}</span>
            </div>
          ))}
        </div>
        <Link to="/driver" className="btn btn-primary btn-blk">Go to Driver Login →</Link>
      </div>
    </div>
  )

  return (
    <div className="main" style={{ padding:'2.5rem 2rem' }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        <button className="btn btn-ghost btn-sm mb3" onClick={() => navigate('/driver')}>
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

            {/* ── PHOTO UPLOAD ─────────────────────────────────── */}
            <div>
              <label className="label" style={{ marginBottom:'.75rem', display:'block' }}>
                Your Photo <span style={{ color:'var(--red)' }}>*</span>
              </label>

              <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
                {/* Preview circle */}
                <div style={{ width:90, height:90, borderRadius:'50%', background: photoPreview ? 'transparent' : 'rgba(255,255,255,.04)', border:`2px dashed ${photoPreview ? 'var(--gold)' : 'var(--b1)'}`, overflow:'hidden', flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                  onClick={() => fileRef.current?.click()}>
                  {photoPreview
                    ? <img src={photoPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <Camera size={28} style={{ color:'var(--tm)' }}/>
                  }
                </div>

                <div style={{ flex:1 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                    <Upload size={13}/> {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  <p style={{ fontSize:'.75rem', color:'var(--ts)', marginTop:'.5rem', lineHeight:1.55 }}>
                    Clear face photo. Passengers use this to verify their driver before getting in the cab.
                  </p>
                  {!photoPreview && (
                    <p style={{ fontSize:'.73rem', color:'var(--red)', marginTop:'.25rem', display:'flex', alignItems:'center', gap:4 }}>
                      ⚠ Photo is required — max 5MB
                    </p>
                  )}
                  {photoPreview && (
                    <p style={{ fontSize:'.73rem', color:'var(--green)', marginTop:'.25rem', display:'flex', alignItems:'center', gap:4 }}>
                      <CheckCircle size={11}/> Photo ready to upload
                    </p>
                  )}
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhoto}
                style={{ display:'none' }}
              />
            </div>

            {/* ── FULL NAME ─────────────────────────────────────── */}
            <div className="fg">
              <label className="label">Full Name <span style={{ color:'var(--red)' }}>*</span></label>
              <div className="input-wrap">
                <User size={15} className="ico"/>
                <input className="input" type="text" placeholder="Your full name" value={form.name} onChange={set('name')} required/>
              </div>
            </div>

            {/* ── PHONE ─────────────────────────────────────────── */}
            <div className="fg">
              <label className="label">Phone Number <span style={{ color:'var(--red)' }}>*</span></label>
              <div className="input-wrap">
                <Phone size={15} className="ico"/>
                <input className="input" type="tel" inputMode="numeric" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} required/>
              </div>
              <p className="hint">This is the number you'll use to log in via OTP</p>
            </div>

            {/* ── VEHICLE PLATE ──────────────────────────────────── */}
            <div className="fg">
              <label className="label">Vehicle Registration Number <span style={{ color:'var(--red)' }}>*</span></label>
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
                  style={{ fontFamily:'monospace', fontSize:'1rem', letterSpacing:'.08em', textTransform:'uppercase',
                    borderColor: form.vehicle_number ? plateValid ? 'rgba(46,204,113,.5)' : 'rgba(231,76,60,.5)' : undefined }}
                />
              </div>
              <p className="hint">Format: TS 09 AB 1234</p>
              {form.vehicle_number && !plateValid && <p className="err">Invalid format — must match TS 09 AB 1234</p>}
              {form.vehicle_number && plateValid  && <p style={{ fontSize:'.74rem', color:'var(--green)', marginTop:'.2rem', display:'flex', alignItems:'center', gap:4 }}><CheckCircle size={11}/> Valid plate</p>}
            </div>

            {/* ── VEHICLE MODEL ──────────────────────────────────── */}
            <div className="fg">
              <label className="label">Vehicle Make & Model <span style={{ color:'var(--red)' }}>*</span></label>
              <div className="input-wrap">
                <Car size={15} className="ico"/>
                <input className="input" type="text" placeholder="e.g. Toyota Innova Crysta 2022" value={form.vehicle_model} onChange={set('vehicle_model')} required/>
              </div>
            </div>

            {/* ── INFO BOX ───────────────────────────────────────── */}
            <div className="info-box">
              <Clock size={14} style={{ flexShrink:0 }}/>
              <span>Your application will be reviewed by admin. Once approved, you can log in at <strong>the Driver Portal</strong> using phone OTP.</span>
            </div>

            <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading || uploading || !formOk}>
              {uploading ? <><span className="spinner"/> Uploading photo…</>
               : loading  ? <span className="spinner"/>
               : '🚗 Submit Application'}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
