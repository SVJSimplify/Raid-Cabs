// ─── Location, Geocoding & Routing ────────────────────────────────────────
// Search    : Google Places Autocomplete → Nominatim fallback
// Geocoding : Google Geocoder (resolves place_id → lat/lng on selection)
// ETA       : Google Maps DirectionsService → ORS proxy → haversine fallback

const IIT     = { lat: 17.5934, lng: 78.1270 }
const VIEWBOX  = '77.9000,17.1000,78.7000,18.1000'

// ─── Distance ─────────────────────────────────────────────────────────────
export function haversineKm(a, b) {
  const R    = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const x    = Math.sin(dLat/2)**2
    + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

// ─── ETA Persistence ──────────────────────────────────────────────────────
const ETA_TTL_MS = 6 * 3600 * 1000

export function saveEta(bookingId, data) {
  try { localStorage.setItem(`eta_${bookingId}`, JSON.stringify({ ...data, _ts: Date.now() })) } catch {}
}

export function loadEta(bookingId) {
  try {
    const raw = localStorage.getItem(`eta_${bookingId}`)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (Date.now() - d._ts > ETA_TTL_MS) { localStorage.removeItem(`eta_${bookingId}`); return null }
    return d
  } catch { return null }
}

export function clearEta(bookingId) {
  try { localStorage.removeItem(`eta_${bookingId}`) } catch {}
}

// ─── Route info: Google Maps → ORS proxy → haversine ─────────────────────
export async function getRouteInfo(origin, dest) {
  if (window.google?.maps?.DirectionsService) {
    try {
      const result = await new Promise((resolve, reject) => {
        new window.google.maps.DirectionsService().route(
          {
            origin:      { lat: origin.lat, lng: origin.lng },
            destination: { lat: dest.lat,   lng: dest.lng   },
            travelMode:  window.google.maps.TravelMode.DRIVING,
          },
          (res, status) => status === 'OK' ? resolve(res) : reject(status)
        )
      })
      const leg    = result.routes[0].legs[0]
      const distKm = +(leg.distance.value / 1000).toFixed(1)
      const secs   = leg.duration_in_traffic?.value ?? leg.duration.value
      return {
        distKm,
        tripMins:         Math.max(5, Math.ceil(secs / 60)),
        driverEta:        Math.ceil(8 + Math.random() * 12),
        source:           'gmaps',
        directionsResult: result,
        geometry:         null,
      }
    } catch { /* fall through */ }
  }

  try {
    const res = await fetch(
      `/api/route?startLng=${origin.lng}&startLat=${origin.lat}&endLng=${dest.lng}&endLat=${dest.lat}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const data = await res.json()
      if (!data.fallback && data.distanceKm) {
        return {
          distKm:           data.distanceKm,
          tripMins:         Math.max(5, Math.ceil(data.durationMins * 1.25)),
          driverEta:        Math.ceil(8 + Math.random() * 12),
          source:           'ors',
          directionsResult: null,
          geometry:         data.geometry,
        }
      }
    }
  } catch { /* fall through */ }

  const km = +(haversineKm(origin, dest) * 1.45).toFixed(1)
  return {
    distKm:           km,
    tripMins:         Math.max(5, Math.ceil((km / 0.333) * 1.15)),
    driverEta:        Math.ceil(8 + Math.random() * 12),
    source:           'estimate',
    directionsResult: null,
    geometry:         null,
  }
}

export async function getRouteGeometry(origin, dest) {
  const info = await getRouteInfo(origin, dest)
  return info.geometry || null
}

// ─── Fare ─────────────────────────────────────────────────────────────────
export function calcConcession(totalDeposited) {
  return Math.floor((totalDeposited || 0) / 1000) * 10
}

export function calcFare(km, concessionAmount = 0, ratePerKm = 12, minFare = 80) {
  const base     = Math.max(minFare, Math.round(km * ratePerKm))
  const discount = Math.min(concessionAmount, base)
  return { base, discount, final: Math.max(0, base - discount) }
}

// ─── Google Places Autocomplete search ────────────────────────────────────
// Returns prediction objects immediately (no lat/lng yet).
// Call getPlaceCoords(result.placeId) when the user *selects* a result
// to resolve the coordinates — this avoids geocoding every suggestion.
//
// Requires: libraries=geometry,places in your Maps JS script URL (LiveMap.jsx)
// Requires: Places API enabled in Google Cloud Console

let _autocompleteService = null

async function searchPlacesGoogle(query) {
  // Lazily init the service (Maps API must be loaded first)
  if (!_autocompleteService) {
    _autocompleteService = new window.google.maps.places.AutocompleteService()
  }

  const predictions = await new Promise((resolve) => {
    _autocompleteService.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: 'in' },
        // Bias results toward IIT Hyderabad (50 km radius)
        location: new window.google.maps.LatLng(IIT.lat, IIT.lng),
        radius: 50000,
      },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results)
        } else {
          resolve([])
        }
      }
    )
  })

  return predictions.slice(0, 6).map(p => ({
    id:       p.place_id,
    placeId:  p.place_id,                          // pass to getPlaceCoords()
    name:     p.structured_formatting.main_text,
    address:  p.structured_formatting.secondary_text || '',
    full:     p.description,
    lat:      null,                                 // resolved on selection
    lng:      null,
    source:   'google',
  }))
}

// ─── Resolve a Google place_id → { lat, lng, address } ────────────────────
// Call this when the user actually selects a result from the dropdown.
// Uses the Geocoder (part of base Maps JS API — no extra library needed).

let _geocoder = null

export async function getPlaceCoords(placeId) {
  if (!window.google?.maps?.Geocoder) return null

  if (!_geocoder) _geocoder = new window.google.maps.Geocoder()

  return new Promise((resolve) => {
    _geocoder.geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location
        resolve({
          lat:     loc.lat(),
          lng:     loc.lng(),
          address: results[0].formatted_address,
        })
      } else {
        resolve(null)
      }
    })
  })
}

// ─── Nominatim fallback (used when Google Maps API hasn't loaded yet) ──────
let _lastCall = 0

async function searchPlacesNominatim(query) {
  const wait = 1100 - (Date.now() - _lastCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  _lastCall = Date.now()

  try {
    const params = new URLSearchParams({
      q: query, format:'json', addressdetails:'1', extratags:'1', namedetails:'1',
      countrycodes:'IN', viewbox:VIEWBOX, bounded:'0', limit:'8', dedupe:'1',
    })
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'RaidCabs/1.0 (IIT Hyderabad)' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!data?.length) return []

    return data.map(p => {
      const a    = p.address || {}
      const name = p.namedetails?.name || p.namedetails?.['name:en']
        || a.road || a.neighbourhood || a.suburb || p.display_name.split(',')[0]
      const parts = [
        a.road || a.neighbourhood || a.suburb,
        a.city || a.town || a.village || a.county,
        a.state,
      ].filter(Boolean)
      const shortAddr = parts.length > 1
        ? parts.slice(0,3).join(', ')
        : p.display_name.split(',').slice(0,3).join(',').trim()
      return {
        id:      String(p.place_id),
        placeId: null,
        name:    name || shortAddr,
        address: shortAddr,
        full:    p.display_name,
        lat:     parseFloat(p.lat),
        lng:     parseFloat(p.lon),
        source:  'nominatim',
        _dist:   haversineKm({ lat:parseFloat(p.lat), lng:parseFloat(p.lon) }, IIT),
      }
    }).sort((a, b) => {
      const qL = query.toLowerCase()
      const aS = a.name.toLowerCase().startsWith(qL) ? -1 : 0
      const bS = b.name.toLowerCase().startsWith(qL) ? -1 : 0
      return aS !== bS ? aS - bS : a._dist - b._dist
    }).slice(0, 6)
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('[location] Nominatim error:', err.message)
    return []
  }
}

// ─── Main search entry point ───────────────────────────────────────────────
// Merges campus places (instant, always shown) with API results.
// Google Places is used when the Maps API is loaded; Nominatim otherwise.

export async function searchPlaces(query) {
  const q = query?.trim()
  if (!q || q.length < 2) return []

  // Always include matching campus places first (they have coords immediately)
  const campus = searchCampusPlaces(q).map(p => ({ ...p, source: 'campus' }))

  const apiResults = window.google?.maps?.places
    ? await searchPlacesGoogle(q)
    : await searchPlacesNominatim(q)

  // Merge: campus first, then API results, deduplicated by name
  const campusNames = new Set(campus.map(p => p.name.toLowerCase()))
  const merged = [
    ...campus,
    ...apiResults.filter(p => !campusNames.has(p.name.toLowerCase())),
  ]

  return merged.slice(0, 7)
}

// ─── Known campus locations ────────────────────────────────────────────────
export const CAMPUS_PLACES = [
  { id:'iit-main-gate',     name:'IIT Hyderabad Main Gate',            address:'Kandi, Sangareddy, Telangana',   lat:17.5942, lng:78.1245 },
  { id:'iit-academic',      name:'IIT Hyderabad Academic Block',       address:'IIT Hyderabad Campus',           lat:17.5934, lng:78.1270 },
  { id:'iit-hostel-a',      name:'Hostel A — IIT Hyderabad',           address:'IIT Hyderabad Campus',           lat:17.5918, lng:78.1282 },
  { id:'iit-hostel-b',      name:'Hostel B — IIT Hyderabad',           address:'IIT Hyderabad Campus',           lat:17.5922, lng:78.1295 },
  { id:'sangareddy-bus',    name:'Sangareddy Bus Stand',               address:'Sangareddy, Telangana 502001',   lat:17.6208, lng:78.0882 },
  { id:'patancheru',        name:'Patancheru',                         address:'Patancheru, Telangana 502319',   lat:17.5328, lng:78.2637 },
  { id:'lingampally',       name:'Lingampally Station',                address:'Lingampally, Hyderabad',         lat:17.4932, lng:78.3163 },
  { id:'hyd-airport',       name:'Rajiv Gandhi International Airport', address:'Shamshabad, Hyderabad 501218',   lat:17.2403, lng:78.4294 },
  { id:'secunderabad',      name:'Secunderabad Railway Station',       address:'Secunderabad, Telangana 500003', lat:17.4399, lng:78.4983 },
  { id:'hyderabad-central', name:'Hyderabad Central Station',          address:'Nampally, Hyderabad 500001',     lat:17.3840, lng:78.4742 },
]

export function searchCampusPlaces(query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return CAMPUS_PLACES.filter(p =>
    p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
  )
}

// ─── Reverse geocode ───────────────────────────────────────────────────────
export async function reverseGeocode(lat, lng) {
  // Prefer Google Geocoder if available
  if (window.google?.maps?.Geocoder) {
    if (!_geocoder) _geocoder = new window.google.maps.Geocoder()
    return new Promise((resolve) => {
      _geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          resolve(results[0].formatted_address)
        } else {
          resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
      })
    })
  }

  // Nominatim fallback
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`,
      { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'RaidCabs/1.0' } }
    )
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    const data = await res.json()
    const a    = data?.address || {}
    const parts = [
      a.building || a.amenity || a.road || a.neighbourhood || a.suburb,
      a.city || a.town || a.village || a.county,
      a.state,
    ].filter(Boolean)
    return parts.length >= 2 ? parts.slice(0,3).join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}` }
}
