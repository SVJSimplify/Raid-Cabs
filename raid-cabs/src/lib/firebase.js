import { initializeApp, getApps } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

const config = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Only init once (hot reload safe)
const app  = getApps().length ? getApps()[0] : initializeApp(config)
export const firebaseAuth = getAuth(app)

export const FIREBASE_OK = Boolean(
  config.apiKey && config.projectId &&
  !config.apiKey.includes('your_') &&
  !config.projectId.includes('your_')
)

// ─── Send OTP ─────────────────────────────────────────────────────────────
let recaptchaVerifier = null

export async function sendFirebaseOtp(phoneNumber, buttonId = 'recaptcha-btn') {
  if (!FIREBASE_OK) throw new Error('Firebase not configured')

  // Clean up old verifier
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear() } catch {}
    recaptchaVerifier = null
  }

  const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber.replace(/\D/g,'').slice(-10)}`

  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, buttonId, {
    size:     'invisible',
    callback: () => {},
  })

  const result = await signInWithPhoneNumber(firebaseAuth, formatted, recaptchaVerifier)
  return result   // call result.confirm(otp) to verify
}

// ─── Verify OTP ────────────────────────────────────────────────────────────
export async function verifyFirebaseOtp(confirmationResult, otp) {
  const result = await confirmationResult.confirm(otp.replace(/\D/g,''))
  return result.user   // Firebase user with .phoneNumber
}
