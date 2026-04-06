// LiveMap — Leaflet + Mappls Raster Tiles + Smooth CSS Animations
// Rapido-style tracking: auto-zoom, smooth marker movement, rotating car

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const KEY = import.meta.env.VITE_MAPPLS_KEY || ''

// Mappls raster tiles via Static Key
const TILE_URL = KEY
  ? `https://apis.mappls.com/advancedmaps/v1/${KEY}/tiles/default/{z}/{x}/{y}.png`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const TILE_ATTR = KEY
  ? '&copy; <a href="https://mappls.com">Mappls</a>'
  : '&copy; <a href="https://carto.com">CARTO</a>'

// ── Zoom levels (Rapido-style) ─────────────────────────────────────
// Far away → zoom 12, close to pickup → zoom 16, in ride → zoom 15
const ZOOM_FAR    = 12
const ZOOM_MEDIUM = 14
const ZOOM_CLOSE  = 16
const ZOOM_RIDE   = 15

// Distance threshold in km to switch zoom levels
const CLOSE_THRESHOLD = 0.8  // under 800m → zoom in close

// ── Smooth marker wrapper ──────────────────────────────────────────
// Moves marker with CSS transition by animating a wrapper div
function smoothMove(marker, toLatLng, durationMs = 600) {
  if (!marker) return
  const startPos = marker.getLatLng()
  const start    = performance.now()

  function lerp(a, b, t) { return a + (b - a) * t }
  function ease(t) { return t < .5 ? 2*t*t : -1+(4-2*t)*t } // ease in-out quad

  function step(now) {
    const elapsed = now - start
    const t       = Math.min(elapsed / durationMs, 1)
    const e       = ease(t)
    marker.setLatLng([
      lerp(startPos.lat, toLatLng[0], e),
      lerp(startPos.lng, toLatLng[1], e),
    ])
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ── Haversine distance ─────────────────────────────────────────────
function distKm(a, b) {
  const R    = 6371
  const dLat = (b[0]-a[0]) * Math.PI/180
  const dLon = (b[1]-a[1]) * Math.PI/180
  const x    = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

// ── Bearing ────────────────────────────────────────────────────────
function getBearing(a, b) {
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1  = a.lat * Math.PI / 180
  const lat2  = b.lat * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

// ── Icons ──────────────────────────────────────────────────────────
function carIcon(deg = 0) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:48px;height:48px;
        transform:rotate(${deg}deg);
        transition:transform .5s cubic-bezier(.4,0,.2,1);
        filter:drop-shadow(0 4px 14px rgba(0,0,0,.6));
        will-change:transform;">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="23" fill="#22c55e"
            stroke="rgba(255,255,255,.95)" stroke-width="2.5"/>
          <rect x="14" y="20" width="20" height="11" rx="3.5" fill="#0a0a0f"/>
          <rect x="17" y="15" width="14" height="8"  rx="2.5" fill="#0a0a0f"/>
          <rect x="18" y="15.5" width="12" height="6" rx="2" fill="rgba(34,197,94,.5)"/>
          <circle cx="17.5" cy="32" r="3" fill="#0a0a0f"/>
          <circle cx="30.5" cy="32" r="3" fill="#0a0a0f"/>
          <circle cx="17.5" cy="32" r="1.2" fill="#333"/>
          <circle cx="30.5" cy="32" r="1.2" fill="#333"/>
          <circle cx="13"   cy="24" r="1.8" fill="#f5a623" opacity=".95"/>
          <circle cx="13"   cy="24" r="3"   fill="#f5a623" opacity=".2"/>
        </svg>
      </div>`,
    iconSize:   [48, 48],
    iconAnchor: [24, 24],
  })
}

function pickupIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:40px;height:40px;
        display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:rgba(59,130,246,.2);
          animation:pickpulse 1.8s ease-out infinite;"></div>
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:rgba(59,130,246,.1);
          animation:pickpulse 1.8s ease-out infinite .6s;"></div>
        <div style="
          width:22px;height:22px;border-radius:50%;
          background:#3b82f6;border:3px solid #fff;
          box-shadow:0 2px 14px rgba(59,130,246,.7);
          position:relative;z-index:1;"></div>
      </div>
      <style>
        @keyframes pickpulse{
          0%{transform:scale(1);opacity:.8}
          100%{transform:scale(2.5);opacity:0}
        }
      </style>`,
    iconSize:   [40, 40],
    iconAnchor: [20, 20],
  })
}

function destIcon(label) {
  const short = (label || 'Drop').slice(0, 18)
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:40px;height:40px;border-radius:50%;
          background:#f5a623;border:3px solid rgba(255,255,255,.95);
          display:flex;align-items:center;justify-content:center;
          font-size:19px;
          box-shadow:0 3px 16px rgba(245,166,35,.6),
                     0 0 0 5px rgba(245,166,35,.15);">🏁</div>
        <div style="
          background:#f5a623;color:#0a0a0f;
          font-size:9.5px;font-weight:800;
          padding:2px 8px;border-radius:99px;
          margin-top:4px;white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,.4);
          letter-spacing:.01em;">${short}</div>
        <div style="
          width:0;height:0;
          border-left:5px solid transparent;
          border-right:5px solid transparent;
          border-top:6px solid #f5a623;
          margin-top:-1px;"></div>
      </div>`,
    iconSize:   [60, 62],
    iconAnchor: [30, 62],
  })
}

// ── Smart zoom: Rapido style ───────────────────────────────────────
// - Shows both driver + pickup when driver is far
// - Zooms into driver when close to pickup
// - Follows driver during ride at fixed zoom
function smartZoom(map, driverPos, userPos, dropPos, isInRide) {
  if (!map) return

  if (isInRide && driverPos && dropPos) {
    // Ride in progress: fit driver + destination, zoom 14
    const bounds = L.latLngBounds(
      [driverPos.lat, driverPos.lng],
      [dropPos.lat,   dropPos.lng]
    )
    map.fitBounds(bounds, { padding:[80, 60], maxZoom:ZOOM_RIDE, animate:true, duration:.8 })
    return
  }

  if (driverPos && userPos) {
    const dist = distKm(
      [driverPos.lat, driverPos.lng],
      [userPos.lat,   userPos.lng]
    )

    if (dist < CLOSE_THRESHOLD) {
      // Driver almost at pickup — zoom in close on driver
      map.flyTo([driverPos.lat, driverPos.lng], ZOOM_CLOSE, { animate:true, duration:.8 })
    } else if (dist < 3) {
      // Medium distance — show both, zoom 14
      const bounds = L.latLngBounds(
        [driverPos.lat, driverPos.lng],
        [userPos.lat,   userPos.lng]
      )
      map.fitBounds(bounds, { padding:[80, 60], maxZoom:ZOOM_MEDIUM, animate:true, duration:.8 })
    } else {
      // Far — show full route, zoom 12
      const bounds = L.latLngBounds(
        [driverPos.lat, driverPos.lng],
        [userPos.lat,   userPos.lng]
      )
      map.fitBounds(bounds, { padding:[60, 50], maxZoom:ZOOM_FAR, animate:true, duration:.8 })
    }
    return
  }

  if (userPos && dropPos) {
    const bounds = L.latLngBounds(
      [userPos.lat, userPos.lng],
      [dropPos.lat, dropPos.lng]
    )
    map.fitBounds(bounds, { padding:[80, 60], maxZoom:ZOOM_MEDIUM, animate:true, duration:.8 })
  }
}

// ── Component ─────────────────────────────────────────────────────
export default function LiveMap({
  userPos,
  driverPos  = null,
  dropPos    = null,
  routeGeo   = null,
  height     = 420,
  liveLabel  = null,
  adminMode  = false,
  isInRide   = false,   // true when status === 'in_progress'
}) {
  const divRef   = useRef(null)
  const mapRef   = useRef(null)
  const marksRef = useRef({})
  const linesRef = useRef([])
  const prevDrv  = useRef(null)
  const zoomTimer = useRef(null)

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }

    const map = L.map(divRef.current, {
      center:              [center.lat, center.lng],
      zoom:                13,
      zoomControl:         true,
      attributionControl:  false,
      scrollWheelZoom:     true,
      zoomAnimation:       true,
      markerZoomAnimation: true,
    })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      maxZoom:     18,
      subdomains:  'abcd',
    }).addTo(map)

    L.control.attribution({ prefix: false }).addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)

    mapRef.current = map

    return () => {
      if (zoomTimer.current) clearTimeout(zoomTimer.current)
      map.remove()
      mapRef.current  = null
      marksRef.current = {}
      linesRef.current = []
      prevDrv.current  = null
    }
  }, [])

  // Update markers + routes when positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // ── Pickup marker ───────────────────────────────────────────────
    if (userPos) {
      if (marksRef.current.user) {
        smoothMove(marksRef.current.user, [userPos.lat, userPos.lng], 400)
      } else {
        marksRef.current.user = L.marker([userPos.lat, userPos.lng], {
          icon: pickupIcon(), zIndexOffset: 100,
        }).addTo(map).bindPopup(adminMode ? '🧑 Passenger Pickup' : 'Your Pickup')
      }
    }

    // ── Driver marker (smooth + rotating) ──────────────────────────
    if (driverPos) {
      const deg = prevDrv.current ? getBearing(prevDrv.current, driverPos) : 0
      prevDrv.current = { ...driverPos }

      if (marksRef.current.driver) {
        // Smooth animated move
        smoothMove(marksRef.current.driver, [driverPos.lat, driverPos.lng], 800)
        // Update rotation via new icon (CSS transition handles the spin)
        setTimeout(() => {
          if (marksRef.current.driver) marksRef.current.driver.setIcon(carIcon(deg))
        }, 50)
      } else {
        marksRef.current.driver = L.marker([driverPos.lat, driverPos.lng], {
          icon: carIcon(deg), zIndexOffset: 1000,
        }).addTo(map).bindPopup(adminMode ? '🚗 Driver (Live)' : 'Your Driver')
      }

      // Debounced smart zoom — don't re-zoom on every tiny GPS update
      if (zoomTimer.current) clearTimeout(zoomTimer.current)
      zoomTimer.current = setTimeout(() => {
        smartZoom(map, driverPos, userPos, dropPos, isInRide)
      }, 1000)
    }

    // ── Destination marker ──────────────────────────────────────────
    if (dropPos) {
      if (marksRef.current.drop) {
        smoothMove(marksRef.current.drop, [dropPos.lat, dropPos.lng], 400)
      } else {
        marksRef.current.drop = L.marker([dropPos.lat, dropPos.lng], {
          icon: destIcon(dropPos.label || 'Destination'), zIndexOffset: 200,
        }).addTo(map).bindPopup(dropPos.label || 'Destination')
      }
    }

    // ── Route lines ─────────────────────────────────────────────────
    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []

    // Driver → Pickup: dashed blue
    if (driverPos && userPos && !isInRide) {
      linesRef.current.push(
        L.polyline([[driverPos.lat, driverPos.lng],[userPos.lat, userPos.lng]], {
          color: '#3b82f6', weight: 4, opacity: .7, dashArray: '10 8',
        }).addTo(map)
      )
    }

    // Pickup → Drop: real road or straight line
    if (userPos && dropPos) {
      const path = routeGeo?.coordinates
        ? routeGeo.coordinates.map(([lng, lat]) => [lat, lng])
        : [[userPos.lat, userPos.lng],[dropPos.lat, dropPos.lng]]

      // Glow
      linesRef.current.push(
        L.polyline(path, { color:'rgba(245,166,35,.2)', weight:14, opacity:1 }).addTo(map)
      )
      // Main
      linesRef.current.push(
        L.polyline(path, { color:'#f5a623', weight:5, opacity:.9,
          lineJoin:'round', lineCap:'round' }).addTo(map)
      )
    }

    // Initial fit (no driver yet)
    if (!driverPos) smartZoom(map, null, userPos, dropPos, false)

  }, [userPos, driverPos, dropPos, routeGeo, adminMode, isInRide])

  if (!userPos && !driverPos && !dropPos) return (
    <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
      <div style={{ fontSize:'2.5rem' }}>🗺️</div>
      <p style={{ color:'#8b87b0', fontSize:'.85rem', textAlign:'center', maxWidth:230, lineHeight:1.6 }}>
        Enter a pickup location to see the map
      </p>
    </div>
  )

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.08)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,.12)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:7, zIndex:500, whiteSpace:'nowrap' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'livepulse 1.4s infinite', display:'inline-block' }}/>
          {liveLabel}
          <style>{`@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
        </div>
      )}

      {adminMode && (driverPos || userPos) && (
        <div style={{ position:'absolute', top:'1rem', left:'1rem', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'.55rem .85rem', zIndex:500, display:'flex', flexDirection:'column', gap:5 }}>
          {driverPos && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#22c55e', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Driver (Live)</span></div>}
          {userPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#3b82f6', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Passenger</span></div>}
          {dropPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#f5a623', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Destination</span></div>}
        </div>
      )}

      <style>{`
        .leaflet-container{background:#0a0a0f!important;}
        .leaflet-control-attribution{background:rgba(5,5,14,.75)!important;color:#504c74!important;font-size:9px!important;border:none!important;}
        .leaflet-control-attribution a{color:#504c74!important;}
        .leaflet-control-zoom{border:none!important;border-radius:8px!important;overflow:hidden;}
        .leaflet-control-zoom a{background:#0e0e20!important;color:#8b87b0!important;border:1px solid rgba(255,179,71,.15)!important;font-size:15px!important;width:32px!important;height:32px!important;line-height:32px!important;}
        .leaflet-control-zoom a:hover{background:#1a1a2e!important;color:#f5a623!important;}
        .leaflet-popup-content-wrapper{background:#13131e!important;color:#f0eefc!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Inter',sans-serif!important;box-shadow:0 8px 32px rgba(0,0,0,.5)!important;}
        .leaflet-popup-tip-container{display:none!important;}
        .leaflet-popup-content{margin:8px 12px!important;font-size:.85rem!important;font-weight:600;}
        .leaflet-fade-anim .leaflet-tile{transition:opacity .2s linear!important;}
      `}</style>
    </div>
  )
}
