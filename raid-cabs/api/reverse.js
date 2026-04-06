// GET /api/reverse?lat=&lng=
// Proxies Mappls Reverse Geocoding API

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
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const { lat, lng } = req.query || {}
    // Use dedicated REST key if set, otherwise fall back to static key
    const key = process.env.MAPPLS_REST_KEY || process.env.VITE_MAPPLS_KEY

    if (!lat || !lng) return res.status(200).json({ fallback: true })
    if (!key)         return res.status(200).json({ fallback: true })

    const url = `https://apis.mappls.com/advancedmaps/v1/${key}/rev_geocode?lat=${lat}&lng=${lng}&region=IND`
    const { ok, body } = await httpsGet(url)

    if (!ok) return res.status(200).json({ fallback: true })

    const info = body?.results?.address_components
    const area = body?.results?.formatted_address
    if (!area) return res.status(200).json({ fallback: true })

    // Return clean short address
    const parts = area.split(',').slice(0, 3).join(',').trim()
    return res.status(200).json({ address: parts })
  } catch (err) {
    return res.status(200).json({ fallback: true, reason: err.message })
  }
}
