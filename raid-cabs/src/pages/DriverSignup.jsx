import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User, Phone, Hash, Car, CheckCircle, Clock, ArrowLeft, Camera, Upload, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'

function formatPlate(raw) {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g,'')
  const p = []
  if (c.length>0) p.push(c.slice(0,2))
  if (c.length>2) p.push(c.slice(2,4))
  if (c.length>4) p.push(c.slice(4,6))
  if (c.length>6) p.push(c.slice(6,10))
  return p.join(' ')
}

const isValidPlate = p => /^[A-Z]{2}\s\d{2}\s[A-Z]{1,3}\s\d{4}$/.test(p.trim())

function UploadField({ label, hint, accept, file, preview, onFile, icon: Icon, isImage, required }) {
  const ref = useRef(null)
  return (
    <div>
      <label className="label mb1">{label} {required&&<span style={{color:'var(--red)'}}>*</span>}</label>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
        <div onClick={()=>ref.current?.click()}
          style={{ width:isImage?80:60, height:isImage?80:60, borderRadius:isImage?'50%':'var(--rs)', background:preview?'transparent':'rgba(255,255,255,.03)', border:`2px dashed ${file?'var(--gold)':'var(--b1)'}`, overflow:'hidden', flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {preview && isImage ? <img src={preview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> :
           preview ? <span style={{fontSize:'2rem'}}>📄</span> :
           <Icon size={22} style={{color:'var(--tm)'}}/>}
        </div>
        <div style={{flex:1}}>
          <button type="button" className="btn btn-outline btn-sm" onClick={()=>ref.current?.click()}>
            <Upload size={13}/> {file?'Change':'Upload '}{label}
          </button>
          <p className="hint mt1">{hint}</p>
          {file&&<p style={{fontSize:'.73rem',color:'var(--green)',marginTop:'.25rem',display:'flex',alignItems:'center',gap:4}}><CheckCircle size={11}/> {file.name}</p>}
        </div>
      </div>
      <input ref={ref} type="file" accept={accept} onChange={e=>onFile(e.target.files?.[0])} style={{display:'none'}}/>
    </div>
  )
}

export default function DriverSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', phone:'', vehicle_number:'', vehicle_model:'', login_pin:'' })
  const [photoFile,  setPhotoFile]  = useState(null)
  const [photoPreview,setPhotoPreview]=useState(null)
  const [govFile,    setGovFile]    = useState(null)
  const [govPreview, setGovPreview] = useState(null)
  const [uploading,  setUploading]  = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [done,       setDone]       = useState(false)

  const set = k => e => setForm(f=>({...f, [k]: k==='vehicle_number'?formatPlate(e.target.value):e.target.value}))

  const handlePhoto = f => {
    if (!f) return
    if (f.size > 5*1024*1024) { toast.error('Photo must be under 5MB'); return }
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
  }

  const handleGovId = f => {
    if (!f) return
    if (f.size > 10*1024*1024) { toast.error('Document must be under 10MB'); return }
    setGovFile(f)
    setGovPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '/doc-icon.png')
  }

  const upload = async (file, path) => {
    const { error } = await supabase.storage.from('drivers').upload(path, file, { contentType: file.type, upsert: true })
    if (error) { toast.error('Upload failed: '+error.message); return null }
    return supabase.storage.from('drivers').getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!photoFile)   { toast.error('Please add your photo — passengers use it to verify you'); return }
    if (!govFile)     { toast.error('Please upload a government ID (Aadhaar, licence, or passport)'); return }
    if (!isValidPlate(form.vehicle_number)) { toast.error('Enter a valid plate number e.g. TS 09 AB 1234'); return }
    if (form.phone.replace(/\D/g,'').length < 10) { toast.error('Enter a valid 10-digit phone number'); return }

    setLoading(true)
    setUploading(true)

    const ts       = Date.now()
    const phoneStr = form.phone.replace(/\D/g,'').slice(-10)
    const photoExt = photoFile.name.split('.').pop()
    const govExt   = govFile.name.split('.').pop()

    const [photoUrl, govUrl] = await Promise.all([
      upload(photoFile, `photos/${ts}-${phoneStr}.${photoExt}`),
      upload(govFile,   `gov-ids/${ts}-${phoneStr}.${govExt}`),
    ])

    setUploading(false)
    if (!photoUrl || !govUrl) { setLoading(false); return }

    const { error } = await supabase.from('drivers').insert({
      name:           form.name.trim(),
      phone:          phoneStr,
      vehicle_number: form.vehicle_number.trim(),
      vehicle_model:  form.vehicle_model.trim(),
      photo_url:      photoUrl,
      gov_id_url:     govUrl,
      rating:         5.0,
      total_ratings:  0,
      status:         'available',
      is_approved:    false,
      is_emergency:   false,
    })

    if (error) {
      if (error.message?.includes('unique') || error.message?.includes('duplicate'))
        toast.error('Phone number already registered.')
      else
        toast.error(error.message || 'Registration failed. Try again.')
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  const plateValid = isValidPlate(form.vehicle_number)
  const pinOk      = form.login_pin.replace(/\D/g,'').length === 4
  const formOk     = form.name && form.phone.replace(/\D/g,'').length>=10 && plateValid && form.vehicle_model && photoFile && govFile && pinOk

  if (done) return (
    <div className="main" style={{padding:'4rem 2rem',display:'flex',justifyContent:'center'}}>
      <div style={{maxWidth:460,width:'100%',textAlign:'center'}}>
        <div style={{width:88,height:88,background:'rgba(255,179,71,.12)',border:'2px solid rgba(255,179,71,.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.5rem',color:'var(--gold)'}}><Clock size={44}/></div>
        <h1 className="h2 mb2">Application Submitted!</h1>
        <p style={{color:'var(--ts)',lineHeight:1.75,marginBottom:'2rem'}}>Admin will review your application and documents. Once approved, log in using your phone number and the PIN you just set.</p>
        {photoPreview&&<img src={photoPreview} alt="" style={{width:90,height:90,borderRadius:'50%',objectFit:'cover',border:'3px solid var(--gold)',margin:'0 auto 1.5rem',display:'block'}}/>}
        <div className="card mb3" style={{textAlign:'left'}}>
          {[['Name',form.name],['Phone',form.phone],['Vehicle',form.vehicle_number],['Model',form.vehicle_model],['Photo','✓ Uploaded'],['Gov ID','✓ Uploaded'],['Status','⏳ Pending Approval']].map(([l,v])=>(
            <div key={l} className="fare-r"><span style={{color:'var(--tm)'}}>{l}</span><span style={{fontWeight:600,color:l==='Status'?'var(--gold)':l.includes('✓')||v.includes('✓')?'var(--green)':'var(--tp)'}}>{v}</span></div>
          ))}
        </div>
        <Link to="/driver" className="btn btn-primary btn-blk">Go to Driver Login →</Link>
      </div>
    </div>
  )

  return (
    <div className="main page-pad">
      <div style={{maxWidth:560,margin:'0 auto'}}>
        <button className="btn btn-ghost btn-sm mb3" onClick={()=>navigate('/driver')}><ArrowLeft size={14}/> Back</button>
        <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'2rem'}}>
          <div style={{width:52,height:52,background:'rgba(255,179,71,.12)',border:'1px solid var(--b2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--gold)',flexShrink:0}}><Car size={22}/></div>
          <div>
            <h1 className="h2">Driver Application</h1>
            <p className="sub">Join the Raid Cabs fleet — admin approval required</p>
          </div>
        </div>

        <div className="card fu">
          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'1.5rem'}}>

            {/* Photo */}
            <UploadField label="Your Photo" hint="Clear face photo. Passengers verify you using this before boarding." accept="image/*" file={photoFile} preview={photoPreview} onFile={handlePhoto} icon={Camera} isImage required/>

            {/* Government ID */}
            <UploadField label="Government ID" hint="Aadhaar card, Driving Licence, or Passport. PDF or image accepted." accept="image/*,application/pdf" file={govFile} preview={govFile?.type?.startsWith('image/')?govPreview:null} onFile={handleGovId} icon={CreditCard} isImage={false} required/>

            <div style={{padding:'.75rem 1rem',background:'rgba(74,144,217,.06)',border:'1px solid rgba(74,144,217,.15)',borderRadius:'var(--rs)',fontSize:'.8rem',color:'var(--blue)',display:'flex',gap:8}}>
              🔒 Your ID is stored securely and only visible to admin. Never shared with passengers.
            </div>

            {/* Name */}
            <div className="fg">
              <label className="label">Full Name <span style={{color:'var(--red)'}}>*</span></label>
              <div className="input-wrap"><User size={15} className="ico"/><input className="input" type="text" placeholder="Your full name" value={form.name} onChange={set('name')} required/></div>
            </div>

            {/* Phone */}
            <div className="fg">
              <label className="label">Phone Number <span style={{color:'var(--red)'}}>*</span></label>
              <div className="input-wrap"><Phone size={15} className="ico"/><input className="input" type="tel" inputMode="numeric" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} required/></div>
              <p className="hint">You'll sign in with this number using your admin-assigned PIN</p>
            </div>

            {/* Plate */}
            <div className="fg">
              <label className="label">Registration Number <span style={{color:'var(--red)'}}>*</span></label>
              <div className="input-wrap"><Hash size={15} className="ico"/><input className="input" type="text" placeholder="TS 09 AB 1234" value={form.vehicle_number} onChange={set('vehicle_number')} maxLength={13} required style={{fontFamily:'monospace',letterSpacing:'.08em',textTransform:'uppercase',borderColor:form.vehicle_number?(plateValid?'rgba(0,200,150,.5)':'rgba(255,71,87,.5)'):undefined}}/></div>
              {form.vehicle_number && !plateValid && <p className="err">Invalid format — should match TS 09 AB 1234</p>}
              {form.vehicle_number && plateValid  && <p style={{fontSize:'.73rem',color:'var(--green)',marginTop:'.2rem',display:'flex',alignItems:'center',gap:4}}><CheckCircle size={11}/> Valid plate number</p>}
            </div>

            {/* Model */}
            <div className="fg">
              <label className="label">Vehicle Make & Model <span style={{color:'var(--red)'}}>*</span></label>
              <div className="input-wrap"><Car size={15} className="ico"/><input className="input" type="text" placeholder="e.g. Maruti Suzuki Swift 2022" value={form.vehicle_model} onChange={set('vehicle_model')} required/></div>
            </div>

            {/* PIN */}
            <div className="fg">
              <label className="label">Set Your 4-Digit Login PIN <span style={{color:'var(--red)'}}>*</span></label>
              <div className="input-wrap">
                <Lock size={15} className="ico"/>
                <input
                  className="input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Choose a 4-digit PIN"
                  value={form.login_pin}
                  onChange={e => setForm(f=>({...f, login_pin: e.target.value.replace(/\D/g,'').slice(0,4)}))}
                  required
                  style={{ letterSpacing: form.login_pin ? '.4em' : 'normal', fontWeight:700 }}
                />
              </div>
              {form.login_pin.length > 0 && form.login_pin.length < 4 && (
                <p className="err">PIN must be exactly 4 digits</p>
              )}
              {pinOk && <p style={{ fontSize:'.73rem', color:'var(--green)', display:'flex', alignItems:'center', gap:4, marginTop:'.2rem' }}>✓ PIN set — remember it!</p>}
              <p className="hint">You'll use this PIN every time you log in to the Driver Portal. Admin can reset it if needed.</p>
            </div>

            <div className="info-box"><Clock size={14} style={{flexShrink:0}}/> Admin will review your application and documents. Once approved, you can log in using your phone number and PIN.</div>

            <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={loading||uploading||!formOk}>
              {uploading?<><span className="spinner"/> Uploading documents…</>:loading?<span className="spinner"/>:'🚗 Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
