import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, ENV_OK } from '../lib/supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async uid => {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data)
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

  async function sendPhoneOtp(phone) {
    return supabase.auth.signInWithOtp({ phone })
  }

  async function verifyPhoneOtp(phone, token) {
    return supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  }

  async function signInWithEmailOtp(email) {
    return supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
  }

  async function verifyEmailOtp(email, token) {
    return supabase.auth.verifyOtp({ email, token, type: 'email' })
  }

  async function signUp({ email, password, fullName, phone }) {
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    })
  }

  async function signIn({ email, password }) {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      const m = result.error.message || ''
      if (m.includes('Email not confirmed'))
        result.error.message = 'Email not confirmed. Use Email OTP login instead, or contact admin.'
      if (m.includes('Invalid login credentials'))
        result.error.message = 'Wrong email or password.'
    }
    return result
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
    <Ctx.Provider value={{ user, profile, loading, isAdmin, fetchProfile, sendPhoneOtp, verifyPhoneOtp, signInWithEmailOtp, verifyEmailOtp, signUp, signIn, signOut, updateProfile, updatePassword }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
