// Firebase — Phone SMS OTP only
// Fully lazy — nothing runs at import time
// Firebase auth worker only initializes when user actually clicks "Send OTP"

export const FIREBASE_OK = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
)

// Everything is lazy — only loaded when sendSmsOtp() is called
let _app  = null
let _auth = null
let _recaptcha = null

async function getFirebase() {
  if (_auth) return { auth: _auth, ok: true }
  if (!FIREBASE_OK) return { ok: false }
  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getAuth }                = await import('firebase/auth')
    _app  = getApps().length ? getApps()[0] : initializeApp({
      apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId:      import.meta.env.VITE_FIREBASE_APP_ID,
    })
    _auth = getAuth(_app)
    return { auth: _auth, ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export async function sendSmsOtp(phone, buttonId) {
  if (!FIREBASE_OK) return { error: { message: 'Firebase not configured' } }
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length !== 10) return { error: { message: 'Enter a valid 10-digit number' } }

  try {
    const { auth, ok } = await getFirebase()
    if (!ok) return { error: { message: 'Firebase failed to load' } }

    const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth')

    // Reset old recaptcha
    if (_recaptcha) { try { _recaptcha.clear() } catch {} _recaptcha = null }

    _recaptcha = new RecaptchaVerifier(auth, buttonId, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => { _recaptcha = null },
    })

    const confirmation = await signInWithPhoneNumber(auth, `+91${digits}`, _recaptcha)
    return { confirmation, error: null }
  } catch (err) {
    return { error: { message: err.message || 'Failed to send OTP' } }
  }
}

export async function verifySmsOtp(confirmation, code) {
  if (!confirmation) return { error: { message: 'No OTP session — resend the code' } }
  try {
    const result = await confirmation.confirm(code)
    return { user: result.user, error: null }
  } catch {
    return { error: { message: 'Incorrect OTP — try again' } }
  }
}
