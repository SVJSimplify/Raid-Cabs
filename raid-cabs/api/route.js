// GET /api/route?startLng=&startLat=&endLng=&endLat=
// Server-side proxy for Mapbox Directions API (avoids CORS)
// VITE_MAPBOX_TOKEN must be in Vercel env vars

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { startLng, startLat, endLng, endLat } = req.query
  if (!startLng || !startLat || !endLng || !endLat) {
    return res.status(400).json({ error: 'startLng, startLat, endLng, endLat required' })
  }

  const token = process.env.VITE_MAPBOX_TOKEN
  if (!token) return res.status(200).json({ fallback: true, reason: 'no token' })

  try {
    const coords = `${startLng},${startLat};${endLng},${endLat}`
    const url    = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&steps=false&access_token=${token}`

    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) return res.status(200).json({ fallback: true, reason: `mapbox ${r.status}` })

    const data = await r.json()
    if (!data.routes?.length) return res.status(200).json({ fallback: true, reason: 'no routes' })

    const route = data.routes[0]
    return res.status(200).json({
      geometry: route.geometry,                       // GeoJSON LineString
      distanceKm: +(route.distance / 1000).toFixed(1),
      durationMins: Math.ceil(route.duration / 60),
    })
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message })
  }
}
