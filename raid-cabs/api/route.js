// GET /api/route?start=lng,lat&end=lng,lat
// Proxies OpenRouteService from server to avoid CORS block
// VITE_ORS_KEY must be set in Vercel env vars

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { start, end } = req.query
  if (!start || !end) return res.status(400).json({ error: 'start and end required' })

  const key = process.env.VITE_ORS_KEY
  if (!key) return res.status(200).json({ fallback: true })

  try {
    const r = await fetch(
      `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${key}&start=${start}&end=${end}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!r.ok) return res.status(200).json({ fallback: true })
    const data = await r.json()
    return res.status(200).json(data)
  } catch {
    return res.status(200).json({ fallback: true })
  }
}
