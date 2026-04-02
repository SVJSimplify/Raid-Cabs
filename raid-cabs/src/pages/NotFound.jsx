import { useNavigate } from 'react-router-dom'
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight:'80vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1.5rem',padding:'2rem',textAlign:'center' }}>
      <div style={{ fontSize:'5rem',lineHeight:1 }}>🚖</div>
      <h1 style={{ fontFamily:'var(--fd)',fontSize:'3rem',fontWeight:900 }}>404</h1>
      <p style={{ color:'var(--ts)',maxWidth:360,lineHeight:1.65 }}>
        Looks like this page took a wrong turn. Our cabs only go to IIT — let's get you back on route.
      </p>
      <div style={{ display:'flex',gap:'1rem' }}>
        <button className="btn btn-outline" onClick={()=>navigate(-1)}>← Go Back</button>
        <button className="btn btn-primary" onClick={()=>navigate('/dashboard')}>🏠 Dashboard</button>
      </div>
    </div>
  )
}
