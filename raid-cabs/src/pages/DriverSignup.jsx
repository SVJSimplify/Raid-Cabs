// DriverSignup — disabled, drivers created by admin via Ops Dashboard
import { useNavigate } from 'react-router-dom'
import { Car, ArrowLeft, Mail } from 'lucide-react'

export default function DriverSignup() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'2rem' }}>
      <div style={{ maxWidth:420, width:'100%', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,rgba(245,166,35,.12),rgba(255,107,43,.08))', border:'1px solid rgba(245,166,35,.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.75rem' }}>
          <Car size={30} color="var(--gold)"/>
        </div>
        <h1 style={{ fontFamily:'var(--fd)', fontSize:'1.65rem', fontWeight:800, marginBottom:'.6rem' }}>Driver Applications</h1>
        <p style={{ color:'var(--ts)', lineHeight:1.7, maxWidth:320, margin:'0 auto 2rem', fontSize:'.9rem' }}>
          Driver accounts are created directly by the RaidCabs admin team. To apply, reach out to us via the contact below.
        </p>
        <div style={{ background:'var(--card)', border:'1px solid var(--b1)', borderRadius:14, padding:'1.25rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'.85rem' }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'rgba(52,152,219,.1)', border:'1px solid rgba(52,152,219,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Mail size={18} color="#3b82f6"/>
          </div>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:'.74rem', color:'var(--ts)', marginBottom:2 }}>Contact Admin</div>
            <div style={{ fontWeight:600, fontSize:'.88rem' }}>admin@raidcabs.in</div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ display:'inline-flex', alignItems:'center', gap:6 }} onClick={() => navigate('/login')}>
          <ArrowLeft size={15}/> Back to Sign In
        </button>
      </div>
    </div>
  )
}
