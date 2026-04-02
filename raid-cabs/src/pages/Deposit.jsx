import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, q } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, CheckCircle, CreditCard, Zap, Shield, RefreshCw, Info } from 'lucide-react'
import toast from 'react-hot-toast'

const UPI_ID = import.meta.env.VITE_UPI_ID || 'raidcabs@upi'
const PRESETS = [5000, 10000, 25000, 50000]

export default function Deposit() {
  const { user, profile, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [tiers,     setTiers]   = useState([])
  const [amount,    setAmount]  = useState(5000)
  const [payRef,    setPayRef]  = useState('')
  const [saving,    setSaving]  = useState(false)
  const [submitted, setSubmit]  = useState(false)
  const [myDeposits,setMyDeps]  = useState([])
  const [loadingDeps,setLdDeps] = useState(true)

  const loadTiers = useCallback(async () => {
    const { data } = await q(() => supabase.from('discount_tiers').select('*').order('min_amount'))
    setTiers(data || [])
  }, [])

  const loadMyDeposits = useCallback(async () => {
    if (!user) return
    const { data } = await q(() =>
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
    )
    setMyDeps(data || [])
    setLdDeps(false)
  }, [user])

  useEffect(() => { loadTiers(); loadMyDeposits() }, [loadTiers, loadMyDeposits])

  const bestTier = tiers.find(t => amount >= t.min_amount && (!t.max_amount || amount <= t.max_amount))

  const upiString = `upi://pay?pa=${UPI_ID}&pn=RaidCabs&am=${amount}&cu=INR&tn=Concession+Deposit`

  const handleSubmit = async e => {
    e.preventDefault()
    if (!payRef.trim()) { toast.error('Enter payment reference / UTR number'); return }
    if (amount < 5000)  { toast.error('Minimum deposit is ₹5,000'); return }
    setSaving(true)
    const { error } = await q(() => supabase.from('deposits').insert({
      user_id:          user.id,
      amount,
      discount_applied: bestTier?.discount_percent || 0,
      payment_ref:      payRef.trim(),
      status:           'pending',
    }))
    if (error) {
      toast.error(error.message || 'Failed to submit')
    } else {
      setSubmit(true)
      toast.success('Deposit submitted! Admin will verify shortly.')
      loadMyDeposits()
    }
    setSaving(false)
  }

  const tierFor = amt => tiers.find(t => amt >= t.min_amount && (!t.max_amount || amt <= t.max_amount))

  if (submitted) return (
    <div className="main" style={{ padding:'3rem 2rem', display:'flex', justifyContent:'center' }}>
      <div className="mw480 tc fu">
        <div style={{ width:88, height:88, background:'rgba(46,204,113,.12)', border:'2px solid rgba(46,204,113,.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem', color:'var(--green)' }}>
          <CheckCircle size={44}/>
        </div>
        <h1 className="h2 mb1">Deposit Submitted!</h1>
        <p className="sub mb3">
          Your deposit of <strong style={{ color:'var(--gold)' }}>₹{amount.toLocaleString()}</strong> is pending admin verification.
          {bestTier && <> Once approved, you'll get <strong style={{ color:'var(--green)' }}>{bestTier.discount_percent}% off</strong> every ride.</>}
        </p>
        <div className="card mb3">
          {[['Amount',`₹${amount.toLocaleString()}`,'var(--gold)'],['Discount',`${bestTier?.discount_percent||0}%`,'var(--green)'],['Ref.',payRef,null],['Status','Pending Admin Review','var(--gold)']].map(([l,v,c])=>(
            <div key={l} className="fare-r"><span style={{ color:'var(--tm)' }}>{l}</span><span style={{ fontWeight:600, color:c||'var(--tp)' }}>{v}</span></div>
          ))}
        </div>
        <div className="flex g2r">
          <button className="btn btn-outline w100" onClick={()=>{ setSubmit(false); setPayRef('') }}>Make Another</button>
          <button className="btn btn-primary w100" onClick={()=>navigate('/dashboard')}>Dashboard →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="main" style={{ padding:'2rem' }}>
      <div className="mw960">
        <button className="btn btn-ghost btn-sm mb2" onClick={()=>navigate('/dashboard')}><ArrowLeft size={15}/> Back</button>
        <div className="mb3">
          <h1 className="h1">💰 Deposit for Concession</h1>
          <p className="sub">Deposit ₹5,000 or more to unlock ride discounts. The more you deposit, the bigger your discount.</p>
        </div>

        <div className="g2">
          {/* Left */}
          <div>
            <div className="card mb2 fu">
              <h3 className="h3 mb3"><CreditCard size={17} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--gold)' }}/>Choose Amount</h3>

              {/* Preset amounts */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem', marginBottom:'1.1rem' }}>
                {PRESETS.map(a => {
                  const t = tierFor(a)
                  return (
                    <button key={a}
                      onClick={() => setAmount(a)}
                      style={{ padding:'.82rem 1rem', border:`1.5px solid ${amount===a?'var(--gold)':'var(--b1)'}`, borderRadius:'var(--rs)', background: amount===a?'rgba(255,179,71,.08)':'rgba(255,255,255,.025)', cursor:'pointer', textAlign:'center', transition:'all var(--t)', fontFamily:'var(--fb)' }}>
                      <div style={{ fontWeight:800, fontSize:'.97rem', color: amount===a?'var(--gold)':'var(--tp)' }}>₹{a.toLocaleString()}</div>
                      <div style={{ fontSize:'.74rem', color: t?'var(--green)':'var(--tm)', marginTop:2, fontWeight:600 }}>{t?`${t.discount_percent}% off`:'No discount'}</div>
                    </button>
                  )
                })}
              </div>

              <div className="fg mb2">
                <label className="label">Custom Amount (₹)</label>
                <input className="input" type="number" min={1000} step={500} value={amount} onChange={e=>setAmount(Math.max(0,Number(e.target.value)))}/>
                {amount>0 && amount<5000 && <p className="err">⚠ Minimum deposit for discount is ₹5,000</p>}
              </div>

              {bestTier && (
                <div className="good-box mt2">
                  <Zap size={15} style={{ flexShrink:0 }}/>
                  <span><strong>{bestTier.label}</strong> — You'll save {bestTier.discount_percent}% on every ride after this deposit is approved.</span>
                </div>
              )}
            </div>

            {/* Tier table */}
            <div className="card fu d2">
              <h3 className="h3 mb3"><Info size={16} style={{ display:'inline', marginRight:8, verticalAlign:'middle', color:'var(--ts)' }}/>All Discount Tiers</h3>
              {tiers.length === 0
                ? <div className="skel" style={{ height:80 }}/>
                : (
                  <table className="tbl">
                    <thead><tr><th>Deposit Range</th><th>Discount</th><th>Tier</th></tr></thead>
                    <tbody>
                      {tiers.map(t => (
                        <tr key={t.id} style={ bestTier?.id===t.id ? { background:'rgba(255,179,71,.05)' } : {} }>
                          <td style={{ color:'var(--tp)', fontWeight:600 }}>
                            ₹{Number(t.min_amount).toLocaleString()}{t.max_amount?`–₹${Number(t.max_amount).toLocaleString()}`:'+'}
                          </td>
                          <td><span className="badge b-gold">{t.discount_percent}%</span></td>
                          <td style={{ color:'var(--ts)', fontSize:'.83rem' }}>{t.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              }
            </div>

            {/* My past deposits */}
            {myDeposits.length > 0 && (
              <div className="card mt2 fu d3">
                <div className="flex aic jcb mb2">
                  <h3 className="h3">My Deposits</h3>
                  <button className="btn btn-ghost btn-sm" onClick={loadMyDeposits}><RefreshCw size={12}/></button>
                </div>
                <table className="tbl">
                  <thead><tr><th>Amount</th><th>Ref</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {myDeposits.map(d => (
                      <tr key={d.id}>
                        <td style={{ color:'var(--gold)', fontWeight:700 }}>₹{Number(d.amount).toLocaleString()}</td>
                        <td style={{ fontSize:'.78rem', color:'var(--tm)', fontFamily:'monospace' }}>{d.payment_ref||'—'}</td>
                        <td><span className={`badge ${d.status==='confirmed'?'b-green':d.status==='rejected'?'b-red':'b-gold'}`}>{d.status}</span></td>
                        <td style={{ fontSize:'.76rem', color:'var(--tm)' }}>{new Date(d.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right — QR + form */}
          <div>
            <div className="card fu d1">
              <h3 className="h3 mb1">📱 Scan & Pay</h3>
              <p className="sub mb3">Scan with any UPI app to pay ₹{amount.toLocaleString()}</p>

              {/* QR Code */}
              <div style={{ display:'flex', justifyContent:'center', marginBottom:'1.25rem' }}>
                <div style={{ background:'#fff', borderRadius:14, padding:14, display:'inline-block', boxShadow:'0 4px 24px rgba(0,0,0,.3)' }}>
                  <QRCodeSVG value={amount>=5000?upiString:`upi://pay?pa=${UPI_ID}&pn=RaidCabs`} size={190} fgColor="#05050e" bgColor="#ffffff" level="H"/>
                </div>
              </div>

              <div style={{ textAlign:'center', marginBottom:'1.25rem' }}>
                <div style={{ fontFamily:'var(--fd)', fontSize:'2rem', fontWeight:900, color:'var(--gold)' }}>₹{amount.toLocaleString()}</div>
                <div style={{ color:'var(--ts)', fontSize:'.83rem', marginTop:3 }}>UPI ID: <code style={{ color:'var(--gold)', background:'rgba(255,179,71,.1)', padding:'2px 6px', borderRadius:4 }}>{UPI_ID}</code></div>
              </div>

              {/* UPI apps */}
              <div style={{ display:'flex', justifyContent:'center', gap:'.65rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
                {['GPay','PhonePe','Paytm','BHIM'].map(app => (
                  <div key={app} style={{ background:'rgba(255,255,255,.04)', border:'1px solid var(--b1)', borderRadius:8, padding:'.35rem .75rem', fontSize:'.74rem', color:'var(--ts)' }}>{app}</div>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="fg mb3">
                  <label className="label">Payment Reference / UTR Number</label>
                  <input className="input" type="text" placeholder="e.g. 424100982341" value={payRef} onChange={e=>setPayRef(e.target.value)} required/>
                  <p className="hint">Find this 12-digit number in your UPI app after payment.</p>
                </div>

                <button type="submit" className="btn btn-primary btn-blk btn-lg" disabled={saving||amount<5000}>
                  {saving ? <span className="spinner"/> : '✦ Confirm Deposit'}
                </button>
              </form>

              <div className="flex aic g1 mt2" style={{ color:'var(--tm)', fontSize:'.76rem' }}>
                <Shield size={12} style={{ flexShrink:0 }}/>
                Discount applied after admin verification · Usually within 2 hours
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
