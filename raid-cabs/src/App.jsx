import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import OfflineBar from './components/OfflineBar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Deposit from './pages/Deposit'
import BookCab from './pages/BookCab'
import Admin from './pages/Admin'
import DriverSignup from './pages/DriverSignup'
import EmergencyDriver from './pages/EmergencyDriver'
import Profile from './pages/Profile'
import History from './pages/History'
import NotFound from './pages/NotFound'
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

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            containerStyle={{ top: 72 }}
            toastOptions={{
              style: {
                background: '#10101e',
                color: '#ede8d8',
                border: '1px solid rgba(255,165,40,.18)',
                fontFamily: "'Nunito', sans-serif",
                fontSize: '.89rem',
                borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,.6)',
              },
              success: { iconTheme: { primary: '#2ecc71', secondary: '#10101e' }, duration: 3000 },
              error:   { iconTheme: { primary: '#e74c3c', secondary: '#10101e' }, duration: 5000 },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/login"         element={<Login/>}/>
            <Route path="/driver-signup" element={<Shell><DriverSignup/></Shell>}/>

            {/* Protected — user */}
            <Route path="/dashboard"     element={<ProtectedRoute><Shell><Dashboard/></Shell></ProtectedRoute>}/>
            <Route path="/deposit"       element={<ProtectedRoute><Shell><Deposit/></Shell></ProtectedRoute>}/>
            <Route path="/book"          element={<ProtectedRoute><Shell><BookCab/></Shell></ProtectedRoute>}/>
            <Route path="/history"       element={<ProtectedRoute><Shell><History/></Shell></ProtectedRoute>}/>
            <Route path="/profile"       element={<ProtectedRoute><Shell><Profile/></Shell></ProtectedRoute>}/>

            {/* Protected — admin */}
            <Route path="/admin"             element={<ProtectedRoute adminOnly><Shell><Admin/></Shell></ProtectedRoute>}/>
            <Route path="/emergency-driver"  element={<ProtectedRoute adminOnly><Shell><EmergencyDriver/></Shell></ProtectedRoute>}/>

            <Route path="/"  element={<Navigate to="/dashboard" replace/>}/>
            <Route path="*"  element={<Shell><NotFound/></Shell>}/>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
