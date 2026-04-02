// ─── Maps & Location Library ──────────────────────────────────────────────
// Map display  → Leaflet + OpenStreetMap  (FREE — no key, no account)
// Autocomplete → OpenStreetMap Nominatim  (FREE — no key)
// Reverse geo  → OpenStreetMap Nominatim  (FREE — no key)
// Distance     → Haversine × 1.40 road factor
//
// Mappls has been removed entirely. No VITE_MAPPLS_KEY needed.

export const HAS_KEY  = true   // always true — no key required
export const HAS_REST = false

// ─── Distance (Haversine × 1.40 road factor) ─────────────────────────────
export async function getRouteInfo(origin, dest) {
  const R    = 6371
  const dLat = (dest.lat - origin.lat) * Math.PI / 180
  const dLon = (dest.lng - origin.lng) * Math.PI / 180
  const a    = Math.sin(dLat/2)**2
    + Math.cos(origin.lat * Math.PI/180)
    * Math.cos(dest.lat   * Math.PI/180)
    * Math.sin(dLon/2)**2
  const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const km       = +(straight * 1.40).toFixed(1)
  return {
    distKm:    km,
    tripMins:  Math.max(5, Math.ceil(km / 0.50)),
    driverEta: Math.ceil(4 + Math.random() * 9),
    source:    'estimate',
  }
}

// ─── Place autocomplete — OpenStreetMap Nominatim ─────────────────────────
let _lastSearch = 0

export async function searchPlaces(query) {
  if (!query || query.trim().length < 3) return []
  const now  = Date.now()
  const wait = 1100 - (now - _lastSearch)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  _lastSearch = Date.now()
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search`
      + `?q=${encodeURIComponent(query)}`
      + `&format=json&addressdetails=1&countrycodes=IN&limit=6`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'RaidCabs/1.0' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.map(p => {
      const a = p.address || {}
      const short = [a.road||a.neighbourhood||a.suburb, a.city||a.town||a.village, a.state]
        .filter(Boolean).join(', ')
      return {
        id:      p.place_id?.toString() || `${p.lat},${p.lon}`,
        name:    short || p.display_name?.split(',')[0],
        address: p.display_name,
        lat:     parseFloat(p.lat),
        lng:     parseFloat(p.lon),
      }
    })
  } catch { return [] }
}

// ─── Reverse geocode — OpenStreetMap Nominatim ────────────────────────────
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'RaidCabs/1.0' } }
    )
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const data = await res.json()
    const a    = data?.address || {}
    return [a.road||a.neighbourhood||a.suburb, a.city||a.town||a.village, a.state]
      .filter(Boolean).join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}` }
}

// ─── Fare calculation ─────────────────────────────────────────────────────
export const FARE_RATE = 12
export const FARE_MIN  = 80

export function calcFare(km, discountPct = 0) {
  const base     = Math.max(FARE_MIN, Math.round(km * FARE_RATE))
  const discount = Math.round(base * discountPct / 100)
  return { base, discount, final: base - discount }
}
