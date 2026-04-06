// GET /api/route?startLng=&startLat=&endLng=&endLat=
// Proxies Mappls Route Advance API to avoid CORS
// Same VITE_MAPPLS_KEY used for the map SDK

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

    // Use dedicated REST key if set, otherwise fall back to static key
    const key = process.env.MAPPLS_REST_KEY || process.env.VITE_MAPPLS_KEY
    if (!key)
      return res.status(200).json({ fallback: true, reason: 'no key' })

    // Mappls Route Advance API — same key as the map SDK
    const url = `https://apis.mappls.com/advancedmaps/v1/${key}/route_adv/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full&steps=false`

    const { ok, body } = await httpsGet(url)
    if (!ok) return res.status(200).json({ fallback: true, reason: 'mappls error' })

    const route = body?.routes?.[0]
    if (!route) return res.status(200).json({ fallback: true, reason: 'no route' })

    return res.status(200).json({
      geometry:     route.geometry,
      distanceKm:   +(route.distance / 1000).toFixed(1),
      durationMins: Math.ceil(route.duration / 60),
    })
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message })
  }
}
