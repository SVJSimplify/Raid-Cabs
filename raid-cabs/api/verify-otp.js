// POST /api/verify-otp
// Verifies OTP from otp_codes table — works for both users and drivers

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const last10 = p => p.replace(/\D/g, '').slice(-10)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { phone, otp, userType = 'user' } = req.body || {}
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' })

  const clean    = last10(phone)
  const cleanOtp = otp.replace(/\D/g, '')

  // Check OTP
  const { data: record } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', clean)
    .eq('otp', cleanOtp)
    .eq('user_type', userType)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!record) {
    return res.status(401).json({ error: 'Invalid or expired code. Request a new one.' })
  }

  // Mark as used
  await supabase.from('otp_codes').update({ used: true }).eq('id', record.id)

  // For drivers — return the driver record
  if (userType === 'driver') {
    const { data: drivers } = await supabase
      .from('drivers').select('*').eq('is_approved', true)

    const driver = (drivers || []).find(d => last10(d.phone || '') === clean)
    if (!driver) {
      return res.status(404).json({ error: 'No approved driver found for this number. Contact admin.' })
    }
    return res.status(200).json({ success: true, userType: 'driver', driver })
  }

  // For users — just confirm verification (Supabase handles their session separately)
  // We create/confirm a Supabase profile for them
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('phone', clean)
    .maybeSingle()

  return res.status(200).json({ success: true, userType: 'user', phone: clean, profile })
}
