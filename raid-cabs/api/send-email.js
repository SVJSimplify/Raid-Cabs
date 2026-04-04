// POST /api/send-email
// Sends transactional emails via Gmail SMTP (free, no external service)
// Uses Supabase service role for DB queries
//
// Required Vercel env vars:
//   GMAIL_USER          — your Gmail address e.g. yourname@gmail.com
//   GMAIL_APP_PASSWORD  — Gmail App Password (not your normal password)
//   SUPABASE_SERVICE_KEY — from Supabase → Settings → API → service_role

const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Transporter created lazily — only when Gmail is configured
function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

function baseTemplate(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#f0eefc;">
<div style="max-width:520px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:28px;">
    <div style="font-size:26px;font-weight:900;color:#f5a623;letter-spacing:-0.02em;">🚖 RaidCabs</div>
    <div style="color:#8b87b0;font-size:13px;margin-top:4px;">IIT Hyderabad Campus Cabs</div>
  </div>
  ${content}
  <div style="text-align:center;color:#4a4768;font-size:12px;margin-top:28px;line-height:1.7;">
    <p>RaidCabs · IIT Hyderabad · Do not reply to this email</p>
  </div>
</div></body></html>`
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, bookingId, userId, email, data } = req.body || {}
  if (!type) return res.status(400).json({ error: 'type required' })

  const transporter = getTransporter()
  if (!transporter) {
    // Email not configured yet — silently skip, app works fine without it
    return res.status(200).json({ skipped: true, reason: 'Email not configured' })
  }

  let mailOptions = null

  // ── RIDE BOOKED ────────────────────────────────────────────────────────────
  if (type === 'ride_booked') {
    const { data: booking } = await supabase.from('bookings')
      .select('*,drivers(name,vehicle_number,vehicle_model,phone)')
      .eq('id', bookingId).single()
    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    const toEmail = email
    if (!toEmail || toEmail.includes('@raidcabs.local')) return res.status(200).json({ skipped: true })

    mailOptions = {
      from:    `"RaidCabs" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: '🚖 Your cab has been booked — RaidCabs',
      html: baseTemplate(`
        <div style="background:#14141d;border:1px solid rgba(245,166,35,.2);border-radius:14px;padding:22px;margin-bottom:18px;text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">🚗</div>
          <div style="font-size:20px;font-weight:800;">Cab Booked!</div>
          <div style="color:#8b87b0;font-size:13px;margin-top:5px;">Your driver is on the way</div>
        </div>
        <div style="background:#14141d;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;margin-bottom:16px;">
          ${[
            ['📍 Pickup',   booking.pickup_address || '—'],
            ['🎓 Drop',     booking.drop_address || 'IIT Hyderabad'],
            ['🚗 Driver',   `${booking.drivers?.name || '—'} · ${booking.drivers?.phone || '—'}`],
            ['🚘 Vehicle',  `${booking.drivers?.vehicle_model || '—'} · ${booking.drivers?.vehicle_number || '—'}`],
            ['⏱ ETA',      booking.eta_pickup || '—'],
            ['💰 Fare',     `₹${booking.final_fare}`],
          ].map(([l,v])=>`
            <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
              <span style="color:#8b87b0;font-size:13px;">${l}</span>
              <span style="color:#f0eefc;font-size:13px;font-weight:600;">${v}</span>
            </div>
          `).join('')}
        </div>
        <div style="background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.15);border-radius:12px;padding:16px;text-align:center;">
          <div style="color:#8b87b0;font-size:12px;margin-bottom:6px;">Your Ride Code</div>
          <div style="font-size:32px;font-weight:900;color:#f5a623;letter-spacing:.2em;">${booking.ride_code || data?.rideCode || '----'}</div>
          <div style="color:#8b87b0;font-size:11px;margin-top:6px;">Show this to your driver to start the ride</div>
        </div>
      `)
    }
  }

  // ── DRIVER ARRIVED ──────────────────────────────────────────────────────────
  if (type === 'driver_arrived') {
    mailOptions = {
      from:    `"RaidCabs" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: '🚗 Your driver has arrived — RaidCabs',
      html: baseTemplate(`
        <div style="background:#14141d;border:1px solid rgba(0,200,150,.25);border-radius:14px;padding:24px;text-align:center;margin-bottom:18px;">
          <div style="font-size:40px;margin-bottom:12px;">🎉</div>
          <div style="font-size:20px;font-weight:800;color:#00c896;">Driver Has Arrived!</div>
          <div style="color:#8b87b0;font-size:13px;margin-top:6px;">Head to your pickup point now</div>
        </div>
        <div style="background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.15);border-radius:12px;padding:16px;text-align:center;">
          <div style="color:#8b87b0;font-size:12px;margin-bottom:6px;">Your Ride Code</div>
          <div style="font-size:32px;font-weight:900;color:#f5a623;letter-spacing:.2em;">${data?.rideCode || '----'}</div>
          <div style="color:#8b87b0;font-size:11px;margin-top:6px;">Give this to your driver before getting in</div>
        </div>
      `)
    }
  }

  // ── TRIP RECEIPT ────────────────────────────────────────────────────────────
  if (type === 'receipt') {
    const { data: booking } = await supabase.from('bookings')
      .select('*,drivers(name,vehicle_number,vehicle_model)')
      .eq('id', bookingId).single()
    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    const toEmail = email
    if (!toEmail || toEmail.includes('@raidcabs.local')) return res.status(200).json({ skipped: true })

    const date = new Date(booking.created_at).toLocaleString('en-IN',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})

    mailOptions = {
      from:    `"RaidCabs" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: `Trip Receipt — ₹${booking.final_fare} | RaidCabs`,
      html: baseTemplate(`
        <div style="background:#14141d;border:1px solid rgba(245,166,35,.2);border-radius:14px;padding:22px;text-align:center;margin-bottom:18px;">
          <div style="font-size:36px;margin-bottom:10px;">✅</div>
          <div style="font-size:20px;font-weight:800;">Trip Completed</div>
          <div style="color:#8b87b0;font-size:13px;margin-top:4px;">${date}</div>
          <div style="font-size:38px;font-weight:900;color:#f5a623;margin-top:14px;">₹${booking.final_fare}</div>
        </div>
        <div style="background:#14141d;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;margin-bottom:16px;">
          ${[
            ['📍 Pickup',    booking.pickup_address || '—'],
            ['🎓 Drop',      booking.drop_address || 'IIT Hyderabad'],
            ['📏 Distance',  `${booking.distance_km || '—'} km`],
            ['🚗 Driver',    `${booking.drivers?.name || '—'}`],
            ['🚘 Vehicle',   `${booking.drivers?.vehicle_model || '—'} · ${booking.drivers?.vehicle_number || '—'}`],
            ['💰 Base Fare', `₹${booking.base_fare || booking.final_fare}`],
            ...(booking.discount_amount > 0 ? [['🎁 Discount', `-₹${booking.discount_amount}`]] : []),
          ].map(([l,v])=>`
            <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
              <span style="color:#8b87b0;font-size:13px;">${l}</span>
              <span style="color:#f0eefc;font-size:13px;font-weight:600;">${v}</span>
            </div>
          `).join('')}
          <div style="display:flex;justify-content:space-between;padding:12px 0;margin-top:4px;border-top:1px solid rgba(245,166,35,.2);">
            <span style="color:#f0eefc;font-weight:800;font-size:15px;">Total Paid</span>
            <span style="color:#f5a623;font-weight:900;font-size:22px;">₹${booking.final_fare}</span>
          </div>
        </div>
        <div style="text-align:center;color:#8b87b0;font-size:13px;">Thank you for riding with RaidCabs 🙏</div>
      `)
    }
  }

  if (!mailOptions) return res.status(400).json({ error: 'Unknown email type: ' + type })

  try {
    await transporter.sendMail(mailOptions)
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[email] Send failed:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
