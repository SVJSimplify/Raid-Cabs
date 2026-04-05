// LiveMap — 100% API-only, zero SDK
// Tiles:    Mappls Raster Tile REST API  (PNG tiles, no SDK)
// Routing:  /api/route  → Mappls Route Advance API
// Search:   /api/search → Mappls Autosuggest API
// Reverse:  /api/reverse → Mappls Reverse Geocode API
// Renderer: Leaflet (DOM Canvas2D — no WebGL, no OffscreenCanvas,
//           works on every browser including Safari on iPhone)

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const KEY = import.meta.env.VITE_MAPPLS_KEY || ''

// Mappls raster tile API — pure REST, no SDK script needed
const TILE_URL  = KEY
  ? `https://apis.mappls.com/advancedmaps/v1/${KEY}/tiles/default/{z}/{x}/{y}.png`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const TILE_ATTR = KEY
  ? '&copy; <a href="https://mappls.com">Mappls</a> &copy; OpenStreetMap'
  : '&copy; <a href="https://carto.com">CARTO</a> &copy; OpenStreetMap'

// ── Icons ─────────────────────────────────────────────────────────────

function circleIcon(emoji, bg, size = 40) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};border:2.5px solid rgba(255,255,255,.92);
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * .44)}px;
      box-shadow:0 3px 14px rgba(0,0,0,.55),0 0 0 4px ${bg}28;
      user-select:none;">${emoji}</div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function carIcon(deg = 0) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:44px;height:44px;
      transform:rotate(${deg}deg);
      transition:transform .6s cubic-bezier(.4,0,.2,1);
      filter:drop-shadow(0 4px 12px rgba(0,0,0,.55));">
      <svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="21" fill="#22c55e" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
        <rect x="13" y="18" width="18" height="10" rx="3" fill="#0a0a0f"/>
        <rect x="16" y="14" width="12" height="7"  rx="2" fill="#0a0a0f"/>
        <rect x="17" y="14.5" width="10" height="5" rx="1.5" fill="rgba(34,197,94,.4)"/>
        <circle cx="16" cy="29" r="2.5" fill="#0a0a0f"/>
        <circle cx="28" cy="29" r="2.5" fill="#0a0a0f"/>
        <circle cx="14" cy="22" r="1.5" fill="#f5a623" opacity=".9"/>
      </svg>
    </div>`,
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  })
}

function destIcon(label) {
  const short = (label || 'Destination').slice(0, 18)
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:default;">
      <div style="width:38px;height:38px;border-radius:50%;background:#f5a623;
        border:2.5px solid rgba(255,255,255,.95);
        display:flex;align-items:center;justify-content:center;font-size:18px;
        box-shadow:0 3px 14px rgba(245,166,35,.5);">🏁</div>
      <div style="background:#f5a623;color:#0a0a0f;font-size:9px;font-weight:800;
        padding:2px 7px;border-radius:99px;margin-top:4px;
        white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);">${short}</div>
    </div>`,
    iconSize:   [60, 55],
    iconAnchor: [30, 55],
  })
}

// ── Bearing ───────────────────────────────────────────────────────────
function getBearing(a, b) {
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1  = a.lat * Math.PI / 180
  const lat2  = b.lat * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

// ── Component ─────────────────────────────────────────────────────────
export default function LiveMap({
  userPos,
  driverPos  = null,
  dropPos    = null,
  routeGeo   = null,
  height     = 420,
  liveLabel  = null,
  adminMode  = false,
}) {
  const divRef   = useRef(null)
  const mapRef   = useRef(null)
  const marksRef = useRef({})   // { user, driver, drop }
  const linesRef = useRef([])   // polylines
  const prevDrv  = useRef(null) // for bearing calculation

  // ── Init map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }

    const map = L.map(divRef.current, {
      center:             [center.lat, center.lng],
      zoom:               13,
      zoomControl:        true,
      attributionControl: false,
      scrollWheelZoom:    true,
    })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      maxZoom:     18,
      subdomains:  'abcd',
    }).addTo(map)

    L.control.attribution({ prefix: false }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current   = null
      marksRef.current = {}
      linesRef.current = []
      prevDrv.current  = null
    }
  }, []) // init once

  // ── Update markers + route whenever props change ────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // ── User / Pickup ─────────────────────────────────────────────────
    if (userPos) {
      if (marksRef.current.user) {
        marksRef.current.user.setLatLng([userPos.lat, userPos.lng])
      } else {
        marksRef.current.user = L.marker([userPos.lat, userPos.lng], {
          icon:        circleIcon('📍', '#3b82f6', 40),
          zIndexOffset: 100,
        })
        .addTo(map)
        .bindPopup(adminMode ? '🧑 Passenger Pickup' : 'Your Pickup')
      }
    }

    // ── Driver (rotating car) ─────────────────────────────────────────
    if (driverPos) {
      const deg = prevDrv.current ? getBearing(prevDrv.current, driverPos) : 0
      prevDrv.current = driverPos

      if (marksRef.current.driver) {
        marksRef.current.driver.setLatLng([driverPos.lat, driverPos.lng])
        marksRef.current.driver.setIcon(carIcon(deg))
      } else {
        marksRef.current.driver = L.marker([driverPos.lat, driverPos.lng], {
          icon:        carIcon(deg),
          zIndexOffset: 1000,
        })
        .addTo(map)
        .bindPopup(adminMode ? '🚗 Driver (Live)' : 'Your Driver')
      }
      // Pan map to follow driver
      map.panTo([driverPos.lat, driverPos.lng], { animate:true, duration:.6 })
    }

    // ── Drop / Destination ────────────────────────────────────────────
    if (dropPos) {
      if (marksRef.current.drop) {
        marksRef.current.drop.setLatLng([dropPos.lat, dropPos.lng])
      } else {
        marksRef.current.drop = L.marker([dropPos.lat, dropPos.lng], {
          icon:        destIcon(dropPos.label || 'Destination'),
          zIndexOffset: 200,
        })
        .addTo(map)
        .bindPopup(dropPos.label || 'Destination')
      }
    }

    // ── Route lines ───────────────────────────────────────────────────
    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []

    // Driver → Pickup: dashed blue approach line
    if (driverPos && userPos) {
      linesRef.current.push(
        L.polyline([[driverPos.lat, driverPos.lng],[userPos.lat, userPos.lng]], {
          color:     '#3b82f6',
          weight:    4,
          opacity:   .75,
          dashArray: '10 8',
        }).addTo(map)
      )
    }

    // Pickup → Drop: real road route (gold) or straight fallback
    if (userPos && dropPos) {
      const path = routeGeo?.coordinates
        ? routeGeo.coordinates.map(([lng, lat]) => [lat, lng])
        : [[userPos.lat, userPos.lng],[dropPos.lat, dropPos.lng]]

      // Glow effect
      linesRef.current.push(
        L.polyline(path, { color:'rgba(245,166,35,.25)', weight:12, opacity:1 }).addTo(map)
      )
      // Main gold line
      linesRef.current.push(
        L.polyline(path, { color:'#f5a623', weight:5, opacity:.9,
          lineJoin:'round', lineCap:'round' }).addTo(map)
      )
    }

    // ── Fit bounds (when no active driver tracking) ───────────────────
    if (!driverPos) {
      const pts = []
      if (userPos) pts.push([userPos.lat, userPos.lng])
      if (dropPos) pts.push([dropPos.lat, dropPos.lng])
      if (pts.length > 1) {
        map.fitBounds(pts, {
          padding:      [adminMode ? 50 : 65, adminMode ? 40 : 55],
          maxZoom:      15,
          animate:      true,
          duration:     .5,
        })
      } else if (pts.length === 1) {
        map.setView(pts[0], 14, { animate:true })
      }
    }

  }, [userPos, driverPos, dropPos, routeGeo, adminMode])

  // ── No position placeholder ─────────────────────────────────────────
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

      {/* Live GPS chip */}
      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,.12)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:7, zIndex:500, whiteSpace:'nowrap' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'livepulse 1.4s infinite', display:'inline-block' }}/>
          {liveLabel}
          <style>{`@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
        </div>
      )}

      {/* Admin legend */}
      {adminMode && (driverPos || userPos) && (
        <div style={{ position:'absolute', top:'1rem', left:'1rem', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'.55rem .85rem', zIndex:500, display:'flex', flexDirection:'column', gap:5 }}>
          {driverPos && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#22c55e', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Driver (Live)</span></div>}
          {userPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#3b82f6', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Passenger</span></div>}
          {dropPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#f5a623', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Destination</span></div>}
        </div>
      )}

      {/* Leaflet dark theme overrides */}
      <style>{`
        .leaflet-container{background:#0a0a0f!important;}
        .leaflet-control-attribution{background:rgba(5,5,14,.75)!important;color:#504c74!important;font-size:9px!important;border:none!important;}
        .leaflet-control-attribution a{color:#504c74!important;}
        .leaflet-control-zoom a{background:#0e0e20!important;color:#8b87b0!important;border-color:rgba(255,179,71,.15)!important;font-size:14px!important;}
        .leaflet-control-zoom a:hover{background:#1a1a2e!important;color:var(--gold)!important;}
        .leaflet-popup-content-wrapper{background:#13131e!important;color:#f0eefc!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Inter',sans-serif!important;box-shadow:0 8px 32px rgba(0,0,0,.5)!important;}
        .leaflet-popup-tip-container{display:none!important;}
        .leaflet-popup-content{margin:8px 12px!important;font-size:.85rem!important;font-weight:600;}
      `}</style>
    </div>
  )
}
