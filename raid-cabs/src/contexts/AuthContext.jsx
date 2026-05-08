import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, ENV_OK } from '../lib/supabase'

const Ctx = createContext(null)

// Phone-only users get a fake internal email — never shown to them
const phoneToEmail = phone => `${phone.replace(/\D/g,'').slice(-10)}@raidcabs.local`

// Generate 4-digit ride code
const makeRideCode = () => String(Math.floor(1000 + Math.random() * 9000))

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (uid, authUser) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()

    if (data) {
      // Backfill avatar/name from Google metadata if still missing
      const meta = authUser?.user_metadata || {}
      const updates = {}
      if (!data.full_name && (meta.full_name || meta.name))
        updates.full_name  = meta.full_name || meta.name
      if (!data.avatar_url && (meta.avatar_url || meta.picture))
        updates.avatar_url = meta.avatar_url || meta.picture
      if (Object.keys(updates).length) {
        const { data: updated } = await supabase
          .from('profiles').update(updates).eq('id', uid).select().maybeSingle()
        setProfile(updated || data)
      } else {
        setProfile(data)
      }
    } else if (authUser) {
      // First-ever login (Google OAuth or otherwise) — create the profile row
      const meta = authUser.user_metadata || {}
      const rideCode = makeRideCode()
      const { data: created } = await supabase
        .from('profiles')
        .upsert({
          id:         uid,
          full_name:  meta.full_name || meta.name || '',
          avatar_url: meta.avatar_url || meta.picture || null,
          ride_code:  rideCode,
        }, { onConflict: 'id' })
        .select()
        .maybeSingle()
      setProfile(created || null)
    } else {
      setProfile(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (!ENV_OK) { setLoading(false); return }

    // onAuthStateChange fires INITIAL_SESSION immediately — covers both
    // fresh loads and post-OAuth redirects, so we don't need getSession too.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') {
        // Let the reset-password page handle this; don't redirect
        setLoading(false)
        return
      }
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id, session.user)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // ── Google OAuth ────────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      // /auth/callback is an unprotected route — ProtectedRoute never runs
      // before Supabase can exchange the PKCE code, preventing bad_oauth_state.
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  // ── Email OTP ───────────────────────────────────────────────────────────────
  async function signInWithEmailOtp(email) {
    return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  }

  async function verifyEmailOtp(email, token) {
    return supabase.auth.verifyOtp({ email, token, type: 'email' })
  }

  // ── Email + Password ────────────────────────────────────────────────────────
  async function signUp({ email, password, fullName, phone, securityQuestion, securityAnswer }) {
    const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone } } })
    if (!result.error && result.data?.user) {
      const rideCode = makeRideCode()
      await supabase.from('profiles').update({
        phone:             phone || null,
        security_question: securityQuestion || null,
        security_answer:   securityAnswer?.toLowerCase().trim() || null,
        ride_code:         rideCode,
      }).eq('id', result.data.user.id)
    }
    return result
  }

  async function signIn({ email, password }) {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      const m = result.error.message || ''
      if (m.includes('Email not confirmed'))
        result.error.message = 'Email not confirmed yet. Use "Email OTP" login instead — no password needed.'
      else if (m.includes('Invalid login credentials') || result.error.status === 400)
        result.error.message = 'Wrong email or password. Forgot it? Use Email OTP to sign in without a password.'
      else if (m.includes('too many requests'))
        result.error.message = 'Too many attempts. Please wait a few minutes and try again.'
    }
    return result
  }

  // ── Phone + Password ────────────────────────────────────────────────────────
  async function signUpWithPhone({ phone, password, fullName, securityQuestion, securityAnswer }) {
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) return { error: { message: 'Enter a valid 10-digit phone number' } }
    const result = await supabase.auth.signUp({
      email:    phoneToEmail(digits),
      password,
      options:  { data: { full_name: fullName, phone: digits } },
    })
    if (result.data?.user?.identities?.length === 0)
      return { error: { message: 'This phone number is already registered. Try signing in.' } }
    if (!result.error && result.data?.user) {
      const rideCode = makeRideCode()
      await supabase.from('profiles').update({
        phone:             digits,
        security_question: securityQuestion || null,
        security_answer:   securityAnswer?.toLowerCase().trim() || null,
        ride_code:         rideCode,
      }).eq('id', result.data.user.id)
    }
    return result
  }

  async function signInWithPhone({ phone, password }) {
    const digits = phone.replace(/\D/g, '').slice(-10)
    const result = await supabase.auth.signInWithPassword({ email: phoneToEmail(digits), password })
    if (result.error) {
      const m = result.error.message || ''
      if (m.includes('Invalid login credentials') || result.error.status === 400)
        result.error.message = 'Wrong phone number or password. Check the number you registered with.'
      else if (m.includes('Email not confirmed'))
        result.error.message = 'Account not confirmed. Please contact admin.'
    }
    return result
  }

  // ── Common ──────────────────────────────────────────────────────────────────
  async function signOut() { await supabase.auth.signOut() }

  async function updateProfile(updates) {
    if (!user) return { error: { message: 'Not logged in' } }
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (!error) await fetchProfile(user.id)
    return { error }
  }

  async function updatePassword(password) { return supabase.auth.updateUser({ password }) }

  // ── Password Reset ──────────────────────────────────────────────────────────
  async function sendPasswordReset(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <Ctx.Provider value={{
      user, profile, loading, isAdmin, fetchProfile,
      signInWithGoogle,
      signInWithEmailOtp, verifyEmailOtp,
      signUp, signIn,
      signUpWithPhone, signInWithPhone,
      signOut, updateProfile, updatePassword, sendPasswordReset,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
