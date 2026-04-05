// GET /api/route?startLng=&startLat=&endLng=&endLat=
// Proxies OpenRouteService to avoid CORS
// Always returns 200 — either route data or { fallback: true }

const https = require('https')

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, body: JSON.parse(body) }) }
        catch { resolve({ ok: false, body: {} }) }
      })
    }).on('error', reject)
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { startLng, startLat, endLng, endLat } = req.query || {}

    if (!startLng || !startLat || !endLng || !endLat)
      return res.status(200).json({ fallback: true, reason: 'missing params' })

    const key = process.env.VITE_ORS_KEY
    if (!key)
      return res.status(200).json({ fallback: true, reason: 'no key' })

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${key}&start=${startLng},${startLat}&end=${endLng},${endLat}`
    const { ok, body } = await httpsGet(url)

    if (!ok) return res.status(200).json({ fallback: true, reason: 'ors error' })

    const seg = body?.features?.[0]?.properties?.segments?.[0]
    const geo = body?.features?.[0]?.geometry

    if (!seg) return res.status(200).json({ fallback: true, reason: 'no route' })

    return res.status(200).json({
      geometry:     geo,
      distanceKm:   +(seg.distance / 1000).toFixed(1),
      durationMins: Math.ceil(seg.duration / 60),
    })
  } catch (err) {
    // Never crash — always return a usable fallback
    return res.status(200).json({ fallback: true, reason: err.message })
  }
}
