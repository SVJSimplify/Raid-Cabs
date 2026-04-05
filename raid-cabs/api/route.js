// GET /api/route?startLng=&startLat=&endLng=&endLat=
// Proxies OpenRouteService Directions API (avoids CORS)
// VITE_ORS_KEY must be in Vercel env vars
// Sign up free at openrouteservice.org (email only, 2000 req/day)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { startLng, startLat, endLng, endLat } = req.query
  if (!startLng || !startLat || !endLng || !endLat)
    return res.status(400).json({ error: 'startLng, startLat, endLng, endLat required' })

  const key = process.env.VITE_ORS_KEY
  if (!key) return res.status(200).json({ fallback: true, reason: 'no key' })

  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${key}&start=${startLng},${startLat}&end=${endLng},${endLat}`
    const r   = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return res.status(200).json({ fallback: true, reason: `ors ${r.status}` })

    const data = await r.json()
    const seg  = data?.features?.[0]?.properties?.segments?.[0]
    const geo  = data?.features?.[0]?.geometry

    if (!seg) return res.status(200).json({ fallback: true, reason: 'no route' })

    return res.status(200).json({
      geometry:    geo,
      distanceKm:  +(seg.distance / 1000).toFixed(1),
      durationMins: Math.ceil(seg.duration / 60),
    })
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message })
  }
}
