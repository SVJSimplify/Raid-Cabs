// LiveMap — Leaflet + OSM tiles (Mappls when key available)
// Tile fix: switched from CartoDB to tile.openstreetmap.org

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const KEY = import.meta.env.VITE_MAPPLS_KEY || ''

const TILE_URL = KEY
  ? `https://apis.mappls.com/advancedmaps/v1/${KEY}/tiles/default/{z}/{x}/{y}.png`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// ── Bearing ────────────────────────────────────────────────────────
function getBearing(a, b) {
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1  = a.lat * Math.PI / 180
  const lat2  = b.lat * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

// ── Smooth move with requestAnimationFrame ─────────────────────────
function smoothMove(marker, toLat, toLng, ms = 700) {
  if (!marker) return
  const from = marker.getLatLng()
  const start = performance.now()
  function ease(t) { return t < .5 ? 2*t*t : -1+(4-2*t)*t }
  function step(now) {
    const t = Math.min((now - start) / ms, 1)
    const e = ease(t)
    marker.setLatLng([from.lat + (toLat - from.lat) * e, from.lng + (toLng - from.lng) * e])
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ── Icons ──────────────────────────────────────────────────────────
function carIcon(deg = 0) {
  return L.divIcon({
    className: '',
    html: `<div style="width:44px;height:44px;transform:rotate(${deg}deg);transition:transform .5s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 4px 12px rgba(0,0,0,.55));">
      <svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="21" fill="#22c55e" stroke="rgba(255,255,255,.95)" stroke-width="2"/>
        <rect x="13" y="18" width="18" height="10" rx="3" fill="#0a0a0f"/>
        <rect x="16" y="14" width="12" height="7" rx="2" fill="#0a0a0f"/>
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

function pickupIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,.2);animation:lmpick 1.8s ease-out infinite;"></div>
      <div style="width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 2px 12px rgba(59,130,246,.6);position:relative;z-index:1;"></div>
    </div>
    <style>@keyframes lmpick{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.5);opacity:0}}</style>`,
    iconSize:   [38, 38],
    iconAnchor: [19, 19],
  })
}

function destIcon(label) {
  const short = (label || 'Destination').slice(0, 18)
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:38px;height:38px;border-radius:50%;background:#f5a623;border:2.5px solid rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 14px rgba(245,166,35,.5);"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0a0a0f" stroke-width="2.5"><line x1="4" y1="4" x2="4" y2="20"/><polyline points="4,4 16,2 16,11 4,13"/></svg></div>
      <div style="background:#f5a623;color:#0a0a0f;font-size:9px;font-weight:800;padding:2px 7px;border-radius:99px;margin-top:4px;white-space:nowrap;">${short}</div>
    </div>`,
    iconSize:   [60, 55],
    iconAnchor: [30, 55],
  })
}

// ── Smart zoom ─────────────────────────────────────────────────────
function haversineKm(a, b) {
  const R = 6371, dLat = (b.lat-a.lat)*Math.PI/180, dLon = (b.lng-a.lng)*Math.PI/180
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
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
  isInRide   = false,
}) {
  const divRef    = useRef(null)
  const mapRef    = useRef(null)
  const marksRef  = useRef({})
  const linesRef  = useRef([])
  const prevDrv   = useRef(null)
  const zoomTimer = useRef(null)

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }

    const map = L.map(divRef.current, {
      center:[center.lat,center.lng], zoom:13,
      zoomControl:true, attributionControl:false,
      zoomSnap:0.5, zoomDelta:0.5, wheelPxPerZoomLevel:120,
    })

    L.tileLayer(TILE_URL, {
      maxZoom:18,
      subdomains: KEY ? 'abcd' : 'abc',
      attribution: KEY ? '&copy; Mappls &copy; OSM' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    L.control.attribution({ prefix:false }).addTo(map)
    map._userInteracted = false
    map.on('zoomstart', (e) => { if (e.originalEvent) map._userInteracted = true })
    map.on('dragstart', () => { map._userInteracted = true })

    mapRef.current = map
    return () => {
      if (zoomTimer.current) clearTimeout(zoomTimer.current)
      map.remove()
      mapRef.current = null; marksRef.current = {}; linesRef.current = []; prevDrv.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (userPos) {
      if (marksRef.current.user) smoothMove(marksRef.current.user, userPos.lat, userPos.lng)
      else marksRef.current.user = L.marker([userPos.lat,userPos.lng], { icon:pickupIcon(), zIndexOffset:100 })
        .addTo(map).bindPopup(adminMode ? 'Passenger' : 'Your Pickup')
    }

    if (driverPos) {
      const deg = prevDrv.current ? getBearing(prevDrv.current, driverPos) : 0
      prevDrv.current = driverPos
      if (marksRef.current.driver) {
        smoothMove(marksRef.current.driver, driverPos.lat, driverPos.lng)
        setTimeout(() => { if (marksRef.current.driver) marksRef.current.driver.setIcon(carIcon(deg)) }, 50)
      } else {
        marksRef.current.driver = L.marker([driverPos.lat,driverPos.lng], { icon:carIcon(deg), zIndexOffset:1000 })
          .addTo(map).bindPopup(adminMode ? 'Driver (Live)' : 'Your Driver')
      }
    }

    if (dropPos) {
      if (marksRef.current.drop) smoothMove(marksRef.current.drop, dropPos.lat, dropPos.lng)
      else marksRef.current.drop = L.marker([dropPos.lat,dropPos.lng], { icon:destIcon(dropPos.label||'Destination'), zIndexOffset:200 })
        .addTo(map).bindPopup(dropPos.label||'Destination')
    }

    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []

    if (driverPos && userPos && !isInRide) {
      linesRef.current.push(L.polyline([[driverPos.lat,driverPos.lng],[userPos.lat,userPos.lng]], { color:'#3b82f6', weight:4, opacity:.7, dashArray:'10 8' }).addTo(map))
    }

    if (userPos && dropPos) {
      const path = routeGeo?.coordinates
        ? routeGeo.coordinates.map(([lng,lat]) => [lat,lng])
        : [[userPos.lat,userPos.lng],[dropPos.lat,dropPos.lng]]
      linesRef.current.push(L.polyline(path, { color:'rgba(245,166,35,.25)', weight:14, opacity:1 }).addTo(map))
      linesRef.current.push(L.polyline(path, { color:'#f5a623', weight:5, opacity:.9 }).addTo(map))
    }

    if (zoomTimer.current) clearTimeout(zoomTimer.current)
    if (!map._userInteracted) {
      zoomTimer.current = setTimeout(() => {
        const pts = []
        if (userPos)   pts.push([userPos.lat,   userPos.lng])
        if (driverPos) pts.push([driverPos.lat,  driverPos.lng])
        if (dropPos)   pts.push([dropPos.lat,    dropPos.lng])

        if (driverPos && userPos) {
          const dist = haversineKm(driverPos, userPos)
          if (dist < 0.5) map.setView([driverPos.lat,driverPos.lng], 16, { animate:true })
          else if (pts.length > 1) map.fitBounds(pts, { padding:[60,50], maxZoom: dist < 3 ? 14 : 12, animate:true })
        } else if (pts.length > 1) {
          map.fitBounds(pts, { padding:[65,55], maxZoom:15, animate:true })
        } else if (pts.length === 1) {
          map.setView(pts[0], 14, { animate:true })
        }
      }, 800)
    }

  }, [userPos, driverPos, dropPos, routeGeo, adminMode, isInRide])

  if (!userPos && !driverPos && !dropPos) return (
    <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
      <div style={{ width:52,height:52,borderRadius:14,background:"rgba(139,135,176,.06)",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b87b0" strokeWidth="1.5"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg></div>
      <p style={{ color:'#8b87b0', fontSize:'.85rem', textAlign:'center', maxWidth:230, lineHeight:1.6 }}>Enter a pickup location to see the map</p>
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
        .leaflet-control-zoom a{background:#0e0e20!important;color:#8b87b0!important;border:1px solid rgba(255,179,71,.15)!important;}
        .leaflet-control-zoom a:hover{background:#1a1a2e!important;color:#f5a623!important;}
        .leaflet-popup-content-wrapper{background:#13131e!important;color:#f0eefc!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Inter',sans-serif!important;box-shadow:0 8px 32px rgba(0,0,0,.5)!important;}
        .leaflet-popup-tip-container{display:none!important;}
        .leaflet-popup-content{margin:8px 12px!important;font-size:.85rem!important;font-weight:600;}
      `}</style>
    </div>
  )
}
