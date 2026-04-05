// Firebase — Phone SMS OTP Authentication
// Used only for phone number verification via SMS
// All other auth (email, password, Google) stays on Supabase

import { initializeApp, getApps } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Only init if all vars are present
const FIREBASE_OK = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
)

let firebaseApp = null
let firebaseAuth = null

if (FIREBASE_OK) {
  firebaseApp  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  firebaseAuth = getAuth(firebaseApp)
}

export { firebaseAuth, FIREBASE_OK }

// ── reCAPTCHA (required by Firebase Phone Auth — invisible mode) ────────────
let recaptchaVerifier = null

export function getRecaptcha(buttonId = 'sms-send-btn') {
  if (!firebaseAuth) return null
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear() } catch {}
  }
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, buttonId, {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => { recaptchaVerifier = null },
  })
  return recaptchaVerifier
}

// ── Send SMS OTP ─────────────────────────────────────────────────────────────
export async function sendSmsOtp(phone, buttonId) {
  if (!FIREBASE_OK) return { error: { message: 'Firebase not configured' } }
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return { error: { message: 'Enter a valid 10-digit number' } }
  const e164 = `+91${digits}`
  try {
    const captcha     = getRecaptcha(buttonId)
    const confirmation = await signInWithPhoneNumber(firebaseAuth, e164, captcha)
    return { confirmation, error: null }
  } catch (err) {
    return { error: { message: err.message || 'Failed to send OTP' } }
  }
}

// ── Verify SMS OTP ───────────────────────────────────────────────────────────
export async function verifySmsOtp(confirmation, code) {
  if (!confirmation) return { error: { message: 'No OTP session — resend the code' } }
  try {
    const result = await confirmation.confirm(code)
    return { user: result.user, error: null }
  } catch (err) {
    return { error: { message: 'Incorrect OTP — try again' } }
  }
}
