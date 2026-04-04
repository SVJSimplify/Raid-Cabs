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

  const fetchProfile = useCallback(async uid => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!ENV_OK) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [fetchProfile])

  // ── Google OAuth ────────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
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
