import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDriver } from '../contexts/DriverContext'

export function DriverRoute({ children }) {
  const { user, loading: authLoading } = useAuth()
  const { driver, loading: driverLoading, linkError } = useDriver()

  if (authLoading || driverLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#05050e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '1.25rem',
      }}>
        <div style={{ width: 38, height: 38, border: '2.5px solid rgba(46,204,113,.2)', borderTopColor: '#2ecc71', borderRadius: '50%', animation: 'sp .7s linear infinite' }}/>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: '#9890c2', fontFamily: "'Nunito',sans-serif", fontSize: '.9rem' }}>Loading driver portal…</p>
      </div>
    )
  }

  if (!user)  return <Navigate to="/driver" replace/>
  if (!driver) return <Navigate to="/driver" replace/>

  return children
}
