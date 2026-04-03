// POST /api/send-whatsapp-otp
// Sends a 6-digit OTP via WhatsApp using Meta Cloud API
// Free: 1,000 messages/month — no DLT, no Twilio needed
//
// Required Vercel env vars:
//   WHATSAPP_PHONE_NUMBER_ID  — from Meta for Developers
//   WHATSAPP_ACCESS_TOKEN     — permanent token from Meta
//   WHATSAPP_TEMPLATE_NAME    — your approved template name (e.g. "otp_raidcabs")
//   SUPABASE_SERVICE_KEY      — from Supabase → Settings → API → service_role

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

  const { phone, userType = 'user' } = req.body || {}
  if (!phone) return res.status(400).json({ error: 'Phone number required' })

  const clean = last10(phone)
  if (clean.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' })

  // Generate 6-digit OTP
  const otp     = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // Store OTP — wipe old ones for this phone+type first
  await supabase.from('otp_codes').delete()
    .eq('phone', clean).eq('user_type', userType)

  const { error: dbErr } = await supabase.from('otp_codes').insert({
    phone: clean, otp, user_type: userType, expires_at: expires, used: false,
  })
  if (dbErr) return res.status(500).json({ error: 'Database error: ' + dbErr.message })

  // Send via WhatsApp Cloud API
  const PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID
  const TOKEN       = process.env.WHATSAPP_ACCESS_TOKEN
  const TEMPLATE    = process.env.WHATSAPP_TEMPLATE_NAME || 'otp_raidcabs'

  if (!PHONE_ID || !TOKEN) {
    return res.status(500).json({ error: 'WhatsApp not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to Vercel env vars.' })
  }

  try {
    const waRes = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to:   `91${clean}`,
          type: 'template',
          template: {
            name:     TEMPLATE,
            language: { code: 'en' },
            components: [
              {
                type:       'body',
                parameters: [{ type: 'text', text: otp }],
              },
              {
                // "Copy Code" button — only include if your template has one
                type:       'button',
                sub_type:   'url',
                index:      '0',
                parameters: [{ type: 'text', text: otp }],
              },
            ],
          },
        }),
      }
    )

    const waData = await waRes.json()

    if (waData.error) {
      console.error('WhatsApp API error:', JSON.stringify(waData.error))

      // Handle missing button gracefully — retry without button component
      if (waData.error.code === 132000 || waData.error.message?.includes('button')) {
        const waRes2 = await fetch(
          `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
          {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to:   `91${clean}`,
              type: 'template',
              template: {
                name: TEMPLATE,
                language: { code: 'en' },
                components: [{
                  type:       'body',
                  parameters: [{ type: 'text', text: otp }],
                }],
              },
            }),
          }
        )
        const waData2 = await waRes2.json()
        if (waData2.error) {
          return res.status(500).json({ error: waData2.error.message || 'WhatsApp send failed' })
        }
      } else {
        return res.status(500).json({ error: waData.error.message || 'WhatsApp send failed' })
      }
    }

    console.log(`WhatsApp OTP sent to +91${clean} (${userType})`)
    return res.status(200).json({ success: true })

  } catch (err) {
    console.error('WhatsApp fetch error:', err)
    return res.status(500).json({ error: 'Could not reach WhatsApp API: ' + err.message })
  }
}
