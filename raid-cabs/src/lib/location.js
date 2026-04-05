// ─── Location, Geocoding & Routing ────────────────────────────────────────
// All free services, no API key required.
// Geocoding: Nominatim (OpenStreetMap) — biased to IIT Hyderabad area
// Routing ETA: Haversine × 1.40 road factor

// IIT Hyderabad bounding box — Nominatim prioritizes results in this area
const VIEWBOX = '77.9,17.3,78.5,17.8' // lng_min,lat_min,lng_max,lat_max
const IIT = { lat: 17.5934, lng: 78.1270 }

// ─── Distance ─────────────────────────────────────────────────────────────
export function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat/2)**2
    + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

// Routing via Mapbox Directions API (proxied through /api/route)

export async function getRouteInfo(origin, dest) {
  try {
    const res = await fetch(
      `/api/route?startLng=${origin.lng}&startLat=${origin.lat}&endLng=${dest.lng}&endLat=${dest.lat}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      if (!data.fallback && data.distanceKm) {
        return {
          distKm:    data.distanceKm,
          tripMins:  Math.max(3, data.durationMins),
          driverEta: Math.ceil(3 + Math.random() * 7),
          source:    'mapbox',
          geometry:  data.geometry,
        }
      }
    }
  } catch {}
  // Fallback: haversine × 1.40 road factor
  const km = +(haversineKm(origin, dest) * 1.40).toFixed(1)
  return {
    distKm:    km,
    tripMins:  Math.max(3, Math.ceil(km / 0.45)),
    driverEta: Math.ceil(3 + Math.random() * 7),
    source:    'estimate',
    geometry:  null,
  }
}

// Get actual route geometry (returns GeoJSON LineString or null)
export async function getRouteGeometry(origin, dest) {
  const info = await getRouteInfo(origin, dest)
  return info.geometry || null
}

// ─── Fare ─────────────────────────────────────────────────────────────────
// Concession formula: floor(totalDeposited / 1000) * 10 = fixed ₹ off per ride
// e.g. ₹5,000 deposited → ₹50 off every ride
//      ₹10,000 deposited → ₹100 off every ride
export function calcConcession(totalDeposited) {
  return Math.floor((totalDeposited || 0) / 1000) * 10
}

export function calcFare(km, concessionAmount = 0, ratePerKm = 12, minFare = 80) {
  const base     = Math.max(minFare, Math.round(km * ratePerKm))
  const discount = Math.min(concessionAmount, base) // can't discount more than fare
  return { base, discount, final: Math.max(0, base - discount) }
}

// ─── Nominatim search — high accuracy with IIT area bias ──────────────────
let _lastCall = 0

export async function searchPlaces(query) {
  const q = query?.trim()
  if (!q || q.length < 2) return []

  // Rate limit: 1 req/sec (Nominatim policy)
  const wait = 1100 - (Date.now() - _lastCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  _lastCall = Date.now()

  try {
    const params = new URLSearchParams({
      q,
      format:         'json',
      addressdetails: '1',
      extratags:      '1',
      namedetails:    '1',
      countrycodes:   'IN',
      viewbox:        VIEWBOX,
      bounded:        '0',    // 0 = prefer viewbox but also show outside
      limit:          '8',
      dedupe:         '1',
    })

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        signal:  AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'RaidCabs/1.0 (IIT Hyderabad campus cab service)' },
      }
    )
    if (!res.ok) return []

    const data = await res.json()
    if (!data?.length) return []

    return data
      .map(p => {
        const a    = p.address || {}
        const name = p.namedetails?.name || p.namedetails?.['name:en']
          || a.road || a.neighbourhood || a.suburb
          || p.display_name.split(',')[0]

        const parts = [
          a.road || a.neighbourhood || a.suburb,
          a.city || a.town || a.village || a.county,
          a.state,
        ].filter(Boolean)

        const shortAddr = parts.length > 1
          ? parts.slice(0, 3).join(', ')
          : p.display_name.split(',').slice(0, 3).join(',').trim()

        return {
          id:       String(p.place_id),
          name:     name || shortAddr,
          address:  shortAddr,
          full:     p.display_name,
          lat:      parseFloat(p.lat),
          lng:      parseFloat(p.lon),
          type:     p.type,
          class:    p.class,
          // Boost score for results near IIT
          _dist:    haversineKm({ lat: parseFloat(p.lat), lng: parseFloat(p.lon) }, IIT),
        }
      })
      // Sort: exact name matches first, then by distance to IIT
      .sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const qLower = q.toLowerCase()
        const aStarts = aName.startsWith(qLower) ? -1 : 0
        const bStarts = bName.startsWith(qLower) ? -1 : 0
        if (aStarts !== bStarts) return aStarts - bStarts
        return a._dist - b._dist // closer to IIT first
      })
      .slice(0, 6)

  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[location] search error:', err.message)
    return []
  }
}

// ─── Known campus locations (instant, no API call) ────────────────────────
export const CAMPUS_PLACES = [
  { id: 'iit-main-gate',   name: 'IIT Hyderabad Main Gate',    address: 'Kandi, Sangareddy, Telangana',      lat: 17.5942, lng: 78.1245 },
  { id: 'iit-academic',    name: 'IIT Hyderabad Academic Block',address: 'IIT Hyderabad Campus',              lat: 17.5934, lng: 78.1270 },
  { id: 'iit-hostel-a',    name: 'Hostel A — IIT Hyderabad',   address: 'IIT Hyderabad Campus',              lat: 17.5918, lng: 78.1282 },
  { id: 'iit-hostel-b',    name: 'Hostel B — IIT Hyderabad',   address: 'IIT Hyderabad Campus',              lat: 17.5922, lng: 78.1295 },
  { id: 'sangareddy-bus',  name: 'Sangareddy Bus Stand',        address: 'Sangareddy, Telangana 502001',      lat: 17.6208, lng: 78.0882 },
  { id: 'patancheru',      name: 'Patancheru',                  address: 'Patancheru, Telangana 502319',      lat: 17.5328, lng: 78.2637 },
  { id: 'lingampally',     name: 'Lingampally Station',         address: 'Lingampally, Hyderabad',            lat: 17.4932, lng: 78.3163 },
  { id: 'hyd-airport',     name: 'Rajiv Gandhi International Airport',address:'Shamshabad, Hyderabad 501218', lat: 17.2403, lng: 78.4294 },
  { id: 'secunderabad',    name: 'Secunderabad Railway Station', address: 'Secunderabad, Telangana 500003',   lat: 17.4399, lng: 78.4983 },
  { id: 'hyderabad-central',name:'Hyderabad Central Station',   address: 'Nampally, Hyderabad 500001',       lat: 17.3840, lng: 78.4742 },
]

export function searchCampusPlaces(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return CAMPUS_PLACES.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.address.toLowerCase().includes(q)
  )
}

// ─── Reverse geocode ───────────────────────────────────────────────────────
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      {
        signal:  AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'RaidCabs/1.0' },
      }
    )
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const data = await res.json()
    const a    = data?.address || {}

    const parts = [
      a.building || a.amenity || a.road || a.neighbourhood || a.suburb,
      a.city || a.town || a.village || a.county,
      a.state,
    ].filter(Boolean)

    return parts.length >= 2
      ? parts.slice(0, 3).join(', ')
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}
