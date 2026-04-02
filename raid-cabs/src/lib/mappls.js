// Mappls API utilities — all CORS-safe via Vite/Vercel proxy

const KEY = import.meta.env.VITE_MAPPLS_KEY || ''

// ─── Load SDK ────────────────────────────────────────────────────────────────
let sdkLoaded = false
let sdkPromise = null

export function loadMapplsSDK() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.mappls) { sdkLoaded = true; return Promise.resolve(true) }
  if (!KEY) return Promise.resolve(false)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise(resolve => {
    const s = document.createElement('script')
    s.src = `https://apis.mappls.com/advancedmaps/api/${KEY}/map_sdk?v=3.0&layer=vector`
    s.async = true
    s.defer = true
    s.onload  = () => { sdkLoaded = true; resolve(true) }
    s.onerror = () => { sdkPromise = null; resolve(false) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

// ─── Distance Matrix (road distance + duration) ──────────────────────────────
// Uses Vite proxy → /mappls-api → apis.mappls.com (fixes CORS in dev + prod)
export async function getRouteInfo(origin, dest) {
  if (!KEY) return haversineFallback(origin, dest)

  try {
    const url = `/mappls-api/advancedmaps/v1/${KEY}/distance_matrix/driving/` +
      `${origin.lng},${origin.lat};${dest.lng},${dest.lat}?region=IND&rtype=1`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()

    const distM = json?.results?.distances?.[0]?.[1]
    const durS  = json?.results?.durations?.[0]?.[1]
    if (!distM || distM <= 0) throw new Error('invalid distance')

    return {
      distKm:    +(distM / 1000).toFixed(1),
      tripMins:  Math.max(1, Math.ceil(durS / 60)),
      driverEta: Math.ceil(4 + Math.random() * 9),
      source:    'mappls',
    }
  } catch (err) {
    console.warn('[Mappls distance fallback]', err.message)
    return haversineFallback(origin, dest)
  }
}

// ─── Place Autocomplete ────────────────────────────────────────────────────
export async function searchPlaces(query) {
  if (!KEY || !query || query.length < 3) return []
  try {
    const url = `/mappls-api/advancedmaps/v1/${KEY}/textsearch?` +
      `query=${encodeURIComponent(query)}&region=IND&tokenizeAddress=true&pod=CITY`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return []
    const json = await res.json()
    return (json?.suggestedLocations || []).slice(0, 6).map(p => ({
      id:      p.eLoc || p.placeName,
      name:    p.placeName,
      address: p.placeAddress || p.placeName,
      lat:     p.latitude  ? parseFloat(p.latitude)  : null,
      lng:     p.longitude ? parseFloat(p.longitude) : null,
      city:    p.city || '',
      type:    p.type || 'place',
    }))
  } catch { return [] }
}

// ─── Reverse Geocode ───────────────────────────────────────────────────────
export async function reverseGeocode(lat, lng) {
  if (!KEY) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  try {
    const url = `/mappls-api/advancedmaps/v1/${KEY}/rev_geocode?lat=${lat}&lng=${lng}&region=IND`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const json = await res.json()
    return json?.results?.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

// ─── Haversine fallback (straight-line × 1.40 road factor) ──────────────────
function haversineFallback(o, d) {
  const R = 6371
  const dLat = (d.lat - o.lat) * Math.PI / 180
  const dLon = (d.lng - o.lng) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(o.lat * Math.PI/180) * Math.cos(d.lat * Math.PI/180) * Math.sin(dLon/2)**2
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const km = +(straight * 1.40).toFixed(1)
  return {
    distKm:    km,
    tripMins:  Math.max(5, Math.ceil(km / 0.50)),  // ~30km/h avg city speed
    driverEta: Math.ceil(5 + Math.random() * 9),
    source:    'estimate',
  }
}

// ─── Fare calculation ─────────────────────────────────────────────────────
export const FARE_RATE = 12   // ₹ per km
export const FARE_MIN  = 80   // minimum fare

export function calcFare(km, discountPct = 0) {
  const base     = Math.max(FARE_MIN, Math.round(km * FARE_RATE))
  const discount = Math.round(base * discountPct / 100)
  return { base, discount, final: base - discount }
}

// ─── Map marker SVGs ─────────────────────────────────────────────────────
export const markers = {
  user:   (sz=40) => svgIcon(sz, '#3498db', '📍'),
  driver: (sz=44) => svgIcon(sz, '#2ecc71', '🚗'),
  iit:    () => ({
    url: 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50" viewBox="0 0 38 50">
        <path d="M19 0C8.5 0 0 8.5 0 19c0 14.2 19 31 19 31S38 33.2 38 19C38 8.5 29.5 0 19 0z"
              fill="#ffb347" stroke="#ff6b35" stroke-width="1.5"/>
        <text x="19" y="26" font-size="15" text-anchor="middle">🎓</text>
      </svg>`
    ),
    width: 38, height: 50, offset: [19, 50],
  }),
}

function svgIcon(sz, fill, emoji) {
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-2}" fill="${fill}" stroke="#fff" stroke-width="2.5"/>
        <text x="${sz/2}" y="${sz/2+5}" font-size="${sz*0.36}" text-anchor="middle">${emoji}</text>
      </svg>`
    ),
    width: sz, height: sz, offset: [sz/2, sz/2],
  }
}

export const HAS_KEY = Boolean(KEY)
