import { useNavigate } from 'react-router-dom'
import { Car } from 'lucide-react'
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1.5rem',padding:'2rem',textAlign:'center' }}>
      <div style={{ width:80,height:80,borderRadius:20,background:"rgba(245,166,35,.08)",border:"1px solid var(--b1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto" }}><Car size={34} color="var(--gold)"/></div>
      <h1 style={{ fontFamily:'var(--fd)',fontSize:'3rem',fontWeight:900 }}>404</h1>
      <p style={{ color:'var(--ts)',maxWidth:360,lineHeight:1.65 }}>
        Looks like this page took a wrong turn. Our cabs only go to IIT — let's get you back on route.
      </p>
      <div style={{ display:'flex',gap:'1rem' }}>
        <button className="btn btn-outline" onClick={()=>navigate(-1)}>← Go Back</button>
        <button className="btn btn-primary" onClick={()=>navigate('/dashboard')}>Dashboard</button>
      </div>
    </div>
  )
}
