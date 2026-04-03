import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import EmergencySetup from '../pages/EmergencySetup'

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh', flexDirection:'column', gap:'1.25rem' }}>
        <div className="spinner" style={{ width:46, height:46 }}/>
        <p style={{ color:'var(--ts)', fontSize:'.9rem' }}>Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace/>
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/dashboard" replace/>

  // Emergency contact is mandatory for all users before accessing the app
  // Skip for admins — they don't book rides
  if (
    profile &&
    profile.role !== 'admin' &&
    !adminOnly &&
    (!profile.emergency_contact_name || !profile.emergency_contact_phone)
  ) {
    return <EmergencySetup/>
  }

  return children
}
