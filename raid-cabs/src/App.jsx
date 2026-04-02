import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { OpsRoute } from './components/OpsRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import SetupScreen from './components/SetupScreen'
import Navbar from './components/Navbar'
import OfflineBar from './components/OfflineBar'
import { ENV_OK } from './lib/supabase'
import { OPS_PATH } from './config'

import Login           from './pages/Login'
import Dashboard       from './pages/Dashboard'
import Deposit         from './pages/Deposit'
import BookCab         from './pages/BookCab'
import History         from './pages/History'
import Profile         from './pages/Profile'
import DriverSignup    from './pages/DriverSignup'
import EmergencyDriver from './pages/EmergencyDriver'
import NotFound        from './pages/NotFound'
import OpsLogin        from './pages/OpsLogin'
import OpsDashboard    from './pages/OpsDashboard'

import './index.css'

function Shell({ children }) {
  return (
    <div className="shell">
      <div className="orb orb1"/>
      <div className="orb orb2"/>
      <Navbar/>
      <div className="main">{children}</div>
      <OfflineBar/>
    </div>
  )
}

const TOAST = {
  style: {
    background: '#10101e', color: '#ede8d8',
    border: '1px solid rgba(255,165,40,.18)',
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.89rem', borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,.6)',
  },
  success: { iconTheme: { primary: '#2ecc71', secondary: '#10101e' }, duration: 3000 },
  error:   { iconTheme: { primary: '#e74c3c', secondary: '#10101e' }, duration: 5000 },
}

export default function App() {
  if (!ENV_OK) return <SetupScreen/>

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" containerStyle={{ top: 72 }} toastOptions={TOAST}/>
          <Routes>

            {/* ── Public ── */}
            <Route path="/login"         element={<Login/>}/>
            <Route path="/driver-signup" element={<Shell><DriverSignup/></Shell>}/>

            {/* ── User app ── */}
            <Route path="/dashboard" element={<ProtectedRoute><Shell><Dashboard/></Shell></ProtectedRoute>}/>
            <Route path="/deposit"   element={<ProtectedRoute><Shell><Deposit/></Shell></ProtectedRoute>}/>
            <Route path="/book"      element={<ProtectedRoute><Shell><BookCab/></Shell></ProtectedRoute>}/>
            <Route path="/history"   element={<ProtectedRoute><Shell><History/></Shell></ProtectedRoute>}/>
            <Route path="/profile"   element={<ProtectedRoute><Shell><Profile/></Shell></ProtectedRoute>}/>
            <Route path="/emergency-driver" element={<OpsRoute><Shell><EmergencyDriver/></Shell></OpsRoute>}/>

            {/* ── Admin portal — path set in src/config.js ── */}
            <Route path={`/${OPS_PATH}`}           element={<OpsLogin/>}/>
            <Route path={`/${OPS_PATH}/dashboard`} element={<OpsRoute><OpsDashboard/></OpsRoute>}/>

            {/* ── Fallback ── */}
            <Route path="/"  element={<Navigate to="/dashboard" replace/>}/>
            <Route path="*"  element={<Shell><NotFound/></Shell>}/>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
