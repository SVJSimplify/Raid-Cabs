import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)

  const fetchProfile = useCallback(async uid => {
    setProfileError(null)
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', uid).maybeSingle()  // maybeSingle won't 406 if no row
    if (error) {
      console.error('[profile fetch]', error)
      setProfileError(error.message)
    }
    setProfile(data)
    setLoading(false)
  }, [])

  useEffect(() => {
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

  // ── Phone OTP ────────────────────────────────────────────────────────────
  async function sendPhoneOtp(phone) {
    const { data, error } = await supabase.auth.signInWithOtp({ phone })
    if (error) console.error('[sendPhoneOtp]', error)
    return { data, error }
  }

  async function verifyPhoneOtp(phone, token) {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) console.error('[verifyPhoneOtp]', error)
    return { data, error }
  }

  // ── Email auth ────────────────────────────────────────────────────────────
  async function signUp({ email, password, fullName, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, phone } },
    })
    return { data, error }
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message?.includes('Email not confirmed'))
        error.message = 'Email not confirmed. Disable "Confirm email" in Supabase → Auth → Settings.'
      if (error.message?.includes('Invalid login'))
        error.message = 'Wrong email or password.'
      if (error.message?.includes('400'))
        error.message = 'Login failed (400). Check credentials or disable email confirmation in Supabase.'
    }
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(updates) {
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (!error) await fetchProfile(user.id)
    return { error }
  }

  async function updatePassword(password) {
    return supabase.auth.updateUser({ password })
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <Ctx.Provider value={{ user, profile, loading, profileError, isAdmin, sendPhoneOtp, verifyPhoneOtp, signUp, signIn, signOut, fetchProfile, updateProfile, updatePassword }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
