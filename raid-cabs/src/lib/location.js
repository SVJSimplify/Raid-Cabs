// Location & fare calculation utilities

const last10 = p => p.replace(/\D/g,'').slice(-10)

// Distance (Haversine × 1.40 road factor)
export function haversineKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat/2)**2
    + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

export async function getRouteInfo(origin, dest) {
  const straight = haversineKm(origin, dest)
  const km = +(straight * 1.40).toFixed(1)
  return { distKm: km, tripMins: Math.max(5, Math.ceil(km/0.50)), driverEta: Math.ceil(4 + Math.random()*9) }
}

// Fare with admin-configured rate
export function calcFare(km, discountPct=0, ratePerKm=12, minFare=80) {
  const base     = Math.max(minFare, Math.round(km * ratePerKm))
  const discount = Math.round(base * discountPct / 100)
  return { base, discount, final: base - discount }
}

// Nominatim search
let _last = 0
export async function searchPlaces(query) {
  if (!query || query.trim().length < 3) return []
  const wait = 1100 - (Date.now() - _last)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  _last = Date.now()
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=IN&limit=6`,
      { signal:AbortSignal.timeout(6000), headers:{'User-Agent':'RaidCabs/1.0'} }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.map(p => {
      const a = p.address||{}
      const name = [a.road||a.neighbourhood||a.suburb, a.city||a.town||a.village].filter(Boolean).join(', ') || p.display_name.split(',')[0]
      return { id:String(p.place_id), name, address:p.display_name, lat:parseFloat(p.lat), lng:parseFloat(p.lon) }
    })
  } catch { return [] }
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { signal:AbortSignal.timeout(6000), headers:{'User-Agent':'RaidCabs/1.0'} }
    )
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    const data = await res.json()
    const a = data?.address||{}
    return [a.road||a.neighbourhood||a.suburb, a.city||a.town||a.village].filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}` }
}
