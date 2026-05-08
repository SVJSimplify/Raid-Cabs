import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth callback landing page.
 *
 * Supabase redirects here after Google OAuth. It's a public, unprotected
 * route so ProtectedRoute never runs before the PKCE code is exchanged.
 *
 * Flow:
 *  1. Page mounts — Supabase detects the ?code= param via detectSessionInUrl
 *  2. onAuthStateChange fires SIGNED_IN once the exchange succeeds
 *  3. We navigate to /dashboard
 *  4. If Supabase returned an error in the URL (?error=...) we surface it
 *     and redirect the user back to /login after a brief delay.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    // Check for OAuth error params first (e.g. bad_oauth_state, access_denied)
    const params = new URLSearchParams(window.location.search)
    const err    = params.get('error')
    const desc   = params.get('error_description')

    if (err) {
      const msg = desc
        ? decodeURIComponent(desc).replace(/\+/g, ' ')
        : 'Google sign-in failed. Please try again.'
      setErrorMsg(msg)
      setTimeout(() => navigate('/login', { replace: true }), 3500)
      return
    }

    // No error — wait for Supabase to exchange the code and fire SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        navigate('/dashboard', { replace: true })
      }
    })

    // Safety net: if the event never fires (e.g. code already expired),
    // check for an existing session and navigate accordingly.
    const timeout = setTimeout(async () => {
      subscription.unsubscribe()
      const { data: { session } } = await supabase.auth.getSession()
      navigate(session ? '/dashboard' : '/login', { replace: true })
    }, 6000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', background: '#05050e', color: '#ede8d8',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1.25rem', fontFamily: 'sans-serif',
      padding: '2rem', textAlign: 'center',
    }}>
      {errorMsg ? (
        <>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(231,76,60,.1)', border: '1px solid rgba(231,76,60,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="#e74c3c" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p style={{ color: '#e74c3c', fontWeight: 700, fontSize: '1rem' }}>
            Sign-in failed
          </p>
          <p style={{ color: '#8b87b0', fontSize: '.85rem', maxWidth: 300, lineHeight: 1.7 }}>
            {errorMsg}
          </p>
          <p style={{ color: '#555', fontSize: '.78rem' }}>
            Redirecting you back to login…
          </p>
        </>
      ) : (
        <>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '2px solid rgba(245,166,35,.25)',
            borderTopColor: '#f5a623',
            animation: 'spin 0.8s linear infinite',
          }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: '#8b87b0', fontSize: '.88rem' }}>
            Signing you in…
          </p>
        </>
      )}
    </div>
  )
}
