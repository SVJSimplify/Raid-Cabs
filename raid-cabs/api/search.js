// GET /api/search?q=query
// Multi-source geocoding for maximum place coverage:
// 1. Mappls Autosuggest (primary — Indian places, very accurate)
// 2. Nominatim/OSM (fallback — global coverage, finds obscure places)
// Both results merged and deduplicated

const https = require('https')

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { Accept: 'application/json', ...headers },
      timeout: 5000,
    }
    https.get(url, opts, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, body: JSON.parse(body) }) }
        catch { resolve({ ok: false, body: {} }) }
      })
    })
    .on('error', () => resolve({ ok: false, body: {} }))
    .on('timeout', () => resolve({ ok: false, body: {} }))
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const q   = (req.query?.q || '').trim()
    if (!q) return res.status(200).json({ results: [] })

    const mapplsKey = process.env.MAPPLS_REST_KEY || process.env.VITE_MAPPLS_KEY
    const results   = []
    const seen      = new Set() // deduplicate by name+approx location

    // ── 1. Mappls Autosuggest (primary, biased to Hyderabad) ─────────
    if (mapplsKey) {
      const mapplsUrl = `https://apis.mappls.com/advancedmaps/v1/${mapplsKey}/auto_suggest` +
        `?query=${encodeURIComponent(q)}&location=17.5934,78.1270&region=IND&pod=SLC&bridge=true&cap=8`

      const { ok, body } = await httpsGet(mapplsUrl)
      if (ok && body?.suggestedLocations?.length) {
        for (const p of body.suggestedLocations) {
          if (!p.latitude || !p.longitude) continue
          const key = `${Number(p.latitude).toFixed(3)},${Number(p.longitude).toFixed(3)}`
          if (seen.has(key)) continue
          seen.add(key)
          results.push({
            id:      p.eLoc || key,
            name:    p.placeName || p.placeAddress?.split(',')[0] || q,
            address: p.placeAddress || p.placeName || '',
            lat:     parseFloat(p.latitude),
            lng:     parseFloat(p.longitude),
            source:  'mappls',
          })
        }
      }
    }

    // ── 2. Nominatim / OSM (fallback + obscure places) ───────────────
    // Biased to India, viewbox around Hyderabad/Telangana but not bounded
    // so it finds places anywhere in India
    const nomUrl = `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}` +
      `&format=json&addressdetails=1&namedetails=1` +
      `&countrycodes=IN&limit=8&dedupe=1` +
      `&viewbox=77.5,16.5,79.5,18.5&bounded=0`

    const { ok: nomOk, body: nomBody } = await httpsGet(nomUrl, {
      'User-Agent': 'RaidCabs/1.0 (campus cab service, IIT Hyderabad)',
    })

    if (nomOk && Array.isArray(nomBody)) {
      for (const p of nomBody) {
        const lat = parseFloat(p.lat)
        const lng = parseFloat(p.lon)
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
        if (seen.has(key)) continue
        seen.add(key)

        const a    = p.address || {}
        const name = p.namedetails?.name
          || p.namedetails?.['name:en']
          || a.amenity || a.building || a.road
          || a.neighbourhood || a.suburb
          || p.display_name.split(',')[0]

        const addrParts = [
          a.road || a.neighbourhood || a.suburb || a.village,
          a.city || a.town || a.county,
          a.state,
        ].filter(Boolean)

        results.push({
          id:      String(p.place_id),
          name:    name || addrParts[0] || q,
          address: addrParts.join(', ') || p.display_name.split(',').slice(0,3).join(','),
          lat,
          lng,
          source:  'osm',
        })
      }
    }

    // Sort: Mappls results first (more accurate for India), then by
    // distance to IIT Hyderabad (17.5934, 78.127)
    results.sort((a, b) => {
      if (a.source === 'mappls' && b.source !== 'mappls') return -1
      if (b.source === 'mappls' && a.source !== 'mappls') return  1
      // Within same source, sort by distance to IIT
      const distA = Math.hypot(a.lat - 17.5934, a.lng - 78.127)
      const distB = Math.hypot(b.lat - 17.5934, b.lng - 78.127)
      return distA - distB
    })

    return res.status(200).json({ results: results.slice(0, 8) })
  } catch (err) {
    return res.status(200).json({ results: [], error: err.message })
  }
}
