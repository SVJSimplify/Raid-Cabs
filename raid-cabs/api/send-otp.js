const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const last10 = p => p.replace(/\D/g,'').slice(-10)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'Phone required' })

  const clean = last10(phone)
  if (clean.length !== 10) return res.status(400).json({ error: 'Invalid phone number' })

  const otp     = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // Wipe old OTPs for this phone, store new one
  await supabase.from('driver_otps').delete().eq('phone', clean)
  const { error: dbErr } = await supabase.from('driver_otps').insert({
    phone: clean, otp, expires_at: expires, used: false,
  })
  if (dbErr) return res.status(500).json({ error: 'DB error: ' + dbErr.message })

  // Send via Fast2SMS
  const apiKey = process.env.FAST2SMS_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'SMS not configured — add FAST2SMS_API_KEY to Vercel env vars' })

  try {
    const smsRes = await fetch(
      `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=otp&variables_values=${otp}&flash=0&numbers=${clean}`,
      { method: 'GET', headers: { 'cache-control': 'no-cache' } }
    )
    const smsJson = await smsRes.json()
    if (!smsJson.return) {
      console.error('Fast2SMS error:', smsJson)
      return res.status(500).json({ error: smsJson.message?.[0] || 'SMS failed' })
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: 'SMS unreachable: ' + err.message })
  }
}
