import { Navigate } from 'react-router-dom'
import { OPS_PATH } from '../config'
import { useAuth } from '../contexts/AuthContext'

export function OpsRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#03030a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1.25rem' }}>
      <div style={{ width:36, height:36, border:'2.5px solid rgba(255,179,71,.2)', borderTopColor:'#ffb347', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!user) return <Navigate to={`/${OPS_PATH}`} replace/>
  if (profile?.role !== 'admin') return <Navigate to={`/${OPS_PATH}`} replace/>
  return children
}
