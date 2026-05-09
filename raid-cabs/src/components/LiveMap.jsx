// LiveMap — Google Maps JS API (dark theme, animated car, DirectionsRenderer)
import { useEffect, useRef, useState, useCallback } from 'react'

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

// ── Load Google Maps once (deduped) ───────────────────────────────
let _gmLoader = null
function loadGMaps() {
  if (_gmLoader) return _gmLoader
  _gmLoader = new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) { resolve(); return }
    const cb = '__gmInit_rc'
    window[cb] = () => { resolve(); delete window[cb] }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=geometry&callback=${cb}`
    s.async = true
    s.onerror = () => { reject(new Error('Google Maps failed')); _gmLoader = null }
    document.head.appendChild(s)
  })
  return _gmLoader
}

// ── Dark map style ─────────────────────────────────────────────────
const DARK_STYLE = [
  { elementType:'geometry',              stylers:[{color:'#0a0a0f'}] },
  { elementType:'labels.text.stroke',    stylers:[{color:'#0a0a0f'}] },
  { elementType:'labels.text.fill',      stylers:[{color:'#504c74'}] },
  { featureType:'road',        elementType:'geometry', stylers:[{color:'#1a1a2e'}] },
  { featureType:'road.highway',elementType:'geometry', stylers:[{color:'#2a2a45'}] },
  { featureType:'water',       elementType:'geometry', stylers:[{color:'#050510'}] },
  { featureType:'poi',         elementType:'geometry', stylers:[{color:'#0d0d1a'}] },
  { featureType:'poi',         elementType:'labels',   stylers:[{visibility:'off'}] },
  { featureType:'transit',     elementType:'geometry', stylers:[{color:'#111120'}] },
  { featureType:'administrative', elementType:'geometry.stroke', stylers:[{color:'#1f1f35'}] },
  { featureType:'administrative.land_parcel', elementType:'labels', stylers:[{visibility:'off'}] },
]

// ── SVG icon helpers (data URIs) ───────────────────────────────────
const enc = svg => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

function carSvg(deg = 0) {
  return enc(`<svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(${deg}deg)">
    <circle cx="22" cy="22" r="21" fill="#22c55e" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
    <rect x="13" y="18" width="18" height="10" rx="3" fill="#0a0a0f"/>
    <rect x="16" y="14" width="12" height="7" rx="2" fill="#0a0a0f"/>
    <rect x="17" y="14.5" width="10" height="5" rx="1.5" fill="rgba(34,197,94,.4)"/>
    <circle cx="16" cy="29" r="2.5" fill="#0a0a0f"/>
    <circle cx="28" cy="29" r="2.5" fill="#0a0a0f"/>
    <circle cx="14" cy="22" r="1.5" fill="#f5a623" opacity=".9"/>
  </svg>`)
}

const pickupSvg = enc(`<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="19" fill="rgba(59,130,246,.18)" stroke="rgba(59,130,246,.5)" stroke-width="1.5"/>
  <circle cx="20" cy="20" r="9" fill="#3b82f6" stroke="white" stroke-width="2.5"/>
</svg>`)

const destSvg = enc(`<svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg">
  <circle cx="19" cy="19" r="18" fill="#f5a623" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
  <line x1="12" y1="10" x2="12" y2="30" stroke="#0a0a0f" stroke-width="2.5" stroke-linecap="round"/>
  <polygon points="12,10 28,13 28,22 12,25" fill="#0a0a0f"/>
  <circle cx="19" cy="42" r="4" fill="#f5a623" opacity=".55"/>
</svg>`)

// ── Bearing ────────────────────────────────────────────────────────
function getBearing(a, b) {
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function haversineKm(a, b) {
  const R = 6371, dLat=(b.lat-a.lat)*Math.PI/180, dLon=(b.lng-a.lng)*Math.PI/180
  const x = Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
}

// ── Component ─────────────────────────────────────────────────────
export default function LiveMap({
  userPos,
  driverPos      = null,
  dropPos        = null,
  routeGeo       = null,          // GeoJSON LineString (fallback)
  directionsResult = null,        // google.maps.DirectionsResult (preferred)
  height         = 420,
  liveLabel      = null,
  adminMode      = false,
  isInRide       = false,
}) {
  const divRef     = useRef(null)
  const mapRef     = useRef(null)
  const marksRef   = useRef({})   // { user, driver, drop }
  const routeRef   = useRef(null) // DirectionsRenderer | Polyline
  const prevDrvRef = useRef(null)
  const animRef    = useRef(null)
  const zoomTimer  = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  // Smooth RAF move for driver marker
  const smoothMove = useCallback((marker, toLat, toLng, ms = 700) => {
    if (!marker) return
    const from = marker.getPosition()
    if (!from) return
    const fLat = from.lat(), fLng = from.lng()
    const start = performance.now()
    const ease = t => t < .5 ? 2*t*t : -1+(4-2*t)*t
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const step = now => {
      const t = Math.min((now - start) / ms, 1), e = ease(t)
      marker.setPosition({ lat: fLat+(toLat-fLat)*e, lng: fLng+(toLng-fLng)*e })
      if (t < 1) animRef.current = requestAnimationFrame(step)
      else animRef.current = null
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  // Init map once
  useEffect(() => {
    let cancelled = false
    loadGMaps()
      .then(() => {
        if (cancelled || !divRef.current || mapRef.current) return
        const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }
        const map = new window.google.maps.Map(divRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 13,
          styles: DARK_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'cooperative',
        })
        map._userInteracted = false
        map.addListener('dragstart', () => { map._userInteracted = true })
        map.addListener('zoom_changed', () => { map._userInteracted = true })
        mapRef.current = map
        if (!cancelled) setMapReady(true)
      })
      .catch(e => console.error('[LiveMap]', e))

    return () => {
      cancelled = true
      clearTimeout(zoomTimer.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)
      Object.values(marksRef.current).forEach(m => m?.setMap?.(null))
      marksRef.current = {}
      routeRef.current?.setMap?.(null)
      routeRef.current = null
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers / routes whenever positions or mapReady change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const G = window.google.maps

    // ── User / pickup marker
    if (userPos) {
      if (marksRef.current.user) {
        marksRef.current.user.setPosition({ lat: userPos.lat, lng: userPos.lng })
      } else {
        marksRef.current.user = new G.Marker({
          position: { lat: userPos.lat, lng: userPos.lng }, map,
          icon: { url: pickupSvg, scaledSize: new G.Size(40,40), anchor: new G.Point(20,20) },
          title: adminMode ? 'Passenger' : 'Your Pickup',
          zIndex: 100,
        })
      }
    }

    // ── Driver marker (with bearing + smooth move)
    if (driverPos) {
      const deg = prevDrvRef.current ? getBearing(prevDrvRef.current, driverPos) : 0
      prevDrvRef.current = driverPos
      if (marksRef.current.driver) {
        smoothMove(marksRef.current.driver, driverPos.lat, driverPos.lng)
        setTimeout(() => {
          marksRef.current.driver?.setIcon({ url: carSvg(deg), scaledSize: new G.Size(44,44), anchor: new G.Point(22,22) })
        }, 50)
      } else {
        marksRef.current.driver = new G.Marker({
          position: { lat: driverPos.lat, lng: driverPos.lng }, map,
          icon: { url: carSvg(deg), scaledSize: new G.Size(44,44), anchor: new G.Point(22,22) },
          title: adminMode ? 'Driver (Live)' : 'Your Driver',
          zIndex: 1000,
        })
      }
    } else if (marksRef.current.driver) {
      marksRef.current.driver.setMap(null)
      delete marksRef.current.driver
      prevDrvRef.current = null
    }

    // ── Drop / destination marker
    if (dropPos) {
      if (marksRef.current.drop) {
        marksRef.current.drop.setPosition({ lat: dropPos.lat, lng: dropPos.lng })
      } else {
        marksRef.current.drop = new G.Marker({
          position: { lat: dropPos.lat, lng: dropPos.lng }, map,
          icon: { url: destSvg, scaledSize: new G.Size(38,50), anchor: new G.Point(19,46) },
          title: dropPos.label || 'Destination',
          zIndex: 200,
        })
      }
    }

    // ── Route rendering
    routeRef.current?.setMap?.(null)
    routeRef.current = null

    if (directionsResult) {
      // Prefer Google Directions result
      const renderer = new G.DirectionsRenderer({
        map, directions: directionsResult, suppressMarkers: true,
        polylineOptions: { strokeColor:'#f5a623', strokeWeight:5, strokeOpacity:.9 },
      })
      routeRef.current = renderer
    } else if (driverPos && userPos && !isInRide) {
      // Dashed line driver → pickup
      routeRef.current = new G.Polyline({
        path: [{ lat:driverPos.lat, lng:driverPos.lng }, { lat:userPos.lat, lng:userPos.lng }],
        map, strokeColor:'#3b82f6', strokeWeight:4, strokeOpacity:.7,
        icons:[{ icon:{ path:'M 0,-1 0,1', strokeOpacity:1, scale:4 }, offset:'0', repeat:'18px' }],
      })
    } else if (userPos && dropPos) {
      const path = routeGeo?.coordinates
        ? routeGeo.coordinates.map(([lng,lat]) => ({ lat, lng }))
        : [{ lat:userPos.lat, lng:userPos.lng }, { lat:dropPos.lat, lng:dropPos.lng }]
      routeRef.current = new G.Polyline({ path, map, strokeColor:'#f5a623', strokeWeight:5, strokeOpacity:.9 })
    }

    // ── Smart auto-zoom
    clearTimeout(zoomTimer.current)
    if (!map._userInteracted) {
      zoomTimer.current = setTimeout(() => {
        const bounds = new G.LatLngBounds()
        let n = 0
        if (userPos)   { bounds.extend({ lat:userPos.lat,   lng:userPos.lng   }); n++ }
        if (driverPos) { bounds.extend({ lat:driverPos.lat, lng:driverPos.lng }); n++ }
        if (dropPos)   { bounds.extend({ lat:dropPos.lat,   lng:dropPos.lng   }); n++ }
        if (n === 1) {
          const pt = userPos || driverPos || dropPos
          map.setCenter({ lat:pt.lat, lng:pt.lng }); map.setZoom(15)
        } else if (n > 1) {
          if (driverPos && userPos && haversineKm(driverPos, userPos) < 0.5) {
            map.setCenter({ lat:driverPos.lat, lng:driverPos.lng }); map.setZoom(17)
          } else {
            map.fitBounds(bounds, { top:65, right:55, bottom:65, left:55 })
          }
        }
      }, 800)
    }
  }, [mapReady, userPos, driverPos, dropPos, routeGeo, directionsResult, adminMode, isInRide, smoothMove])

  // ── Empty state
  if (!userPos && !driverPos && !dropPos) return (
    <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
      <div style={{ width:52,height:52,borderRadius:14,background:'rgba(139,135,176,.06)',border:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b87b0" strokeWidth="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
      </div>
      <p style={{ color:'#8b87b0', fontSize:'.85rem', textAlign:'center', maxWidth:230, lineHeight:1.6 }}>Enter a pickup location to see the map</p>
    </div>
  )

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.08)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,.12)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:7, zIndex:500, whiteSpace:'nowrap', pointerEvents:'none' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'livepulse 1.4s infinite', display:'inline-block' }}/>
          {liveLabel}
          <style>{`@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
        </div>
      )}

      {adminMode && (driverPos || userPos) && (
        <div style={{ position:'absolute', top:'1rem', left:'1rem', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'.55rem .85rem', zIndex:500, display:'flex', flexDirection:'column', gap:5, pointerEvents:'none' }}>
          {driverPos && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#22c55e', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Driver (Live)</span></div>}
          {userPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#3b82f6', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Passenger</span></div>}
          {dropPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#f5a623', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Destination</span></div>}
        </div>
      )}
    </div>
  )
}
