import { Navigate } from 'react-router-dom'
import { useDriver } from '../contexts/DriverContext'

export function DriverRoute({ children }) {
  const { driver, loading } = useDriver()

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#05050e', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1.25rem', fontFamily:"'Nunito',sans-serif" }}>
      <div style={{ width:36, height:36, border:'2.5px solid rgba(46,204,113,.2)', borderTopColor:'#2ecc71', borderRadius:'50%', animation:'sp .7s linear infinite' }}/>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color:'#504c74', fontSize:'.88rem' }}>Loading…</p>
    </div>
  )

  if (!driver) return <Navigate to="/driver" replace/>
  return children
}
