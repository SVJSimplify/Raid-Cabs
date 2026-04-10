// DriverSignup — disabled, drivers created by admin via Ops Dashboard
import { useNavigate } from 'react-router-dom'

export default function DriverSignup() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight:'60vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', padding:'2rem', textAlign:'center' }}>
      <div style={{ fontSize:'3rem' }}>🚗</div>
      <h2 style={{ fontFamily:'var(--fd)', fontSize:'1.4rem', fontWeight:700 }}>Driver Applications Closed</h2>
      <p style={{ color:'var(--ts)', maxWidth:300, lineHeight:1.65 }}>
        Driver accounts are created by the admin. Contact the RaidCabs team to apply as a driver.
      </p>
      <button className="btn btn-outline" onClick={() => navigate('/')}>Back to Home</button>
    </div>
  )
}
