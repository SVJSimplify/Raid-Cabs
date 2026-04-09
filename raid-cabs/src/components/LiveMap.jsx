// LiveMap — Leaflet + Mappls Raster Tiles
// Static import works fine — Leaflet uses DOM canvas, no WebGL workers
// v1.0 used static Leaflet import and was confirmed working

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const KEY         = import.meta.env.VITE_MAPPLS_KEY || ''
const GOOGLE_KEY  = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

// ── Google Maps lazy loader (script tag — no npm package needed) ───
let _googlePromise = null
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve()
  if (_googlePromise) return _googlePromise
  _googlePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=marker`
    s.async = true
    s.onload  = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return _googlePromise
}

const TILE_URL = KEY
  ? `https://apis.mappls.com/advancedmaps/v1/${KEY}/tiles/default/{z}/{x}/{y}.png`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

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
      <div style="width:38px;height:38px;border-radius:50%;background:#f5a623;border:2.5px solid rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 14px rgba(245,166,35,.5);">🏁</div>
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

  // useGoogleMaps flag — if GOOGLE_KEY set, use Google Maps
  const useGoogle = !!GOOGLE_KEY

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }

    if (useGoogle) {
      // Google Maps init (via dynamic script tag)
      loadGoogleMaps().then(() => {
        if (!divRef.current || mapRef.current) return
        const gmap = new window.google.maps.Map(divRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          mapId: 'raidcabs-dark',
          styles: [
            { elementType:'geometry', stylers:[{ color:'#0a0a0f' }] },
            { elementType:'labels.text.fill', stylers:[{ color:'#8b87b0' }] },
            { elementType:'labels.text.stroke', stylers:[{ color:'#0a0a0f' }] },
            { featureType:'road', elementType:'geometry', stylers:[{ color:'#1e1e30' }] },
            { featureType:'road.highway', elementType:'geometry', stylers:[{ color:'#2a2a40' }] },
            { featureType:'road.highway', elementType:'labels.text.fill', stylers:[{ color:'#f5a623' }] },
            { featureType:'poi', stylers:[{ visibility:'off' }] },
            { featureType:'transit', stylers:[{ visibility:'off' }] },
            { featureType:'water', elementType:'geometry', stylers:[{ color:'#050510' }] },
          ],
        })
        mapRef.current = { _gmap: gmap, _type: 'google', _lines: [], _markers: {} }
      }).catch(err => console.warn('[LiveMap] Google Maps load failed:', err))
      return () => {
        if (zoomTimer.current) clearTimeout(zoomTimer.current)
        mapRef.current = null; marksRef.current = {}; linesRef.current = []; prevDrv.current = null
      }
    }

    // Leaflet fallback
    const map = L.map(divRef.current, { center:[center.lat,center.lng], zoom:13, zoomControl:true, attributionControl:false })
    L.tileLayer(TILE_URL, { maxZoom:18, subdomains:'abcd', attribution: KEY ? '© Mappls © OSM' : '© CARTO' }).addTo(map)
    L.control.attribution({ prefix:false }).addTo(map)
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

    // ── Google Maps rendering ───────────────────────────────────────
    if (map._type === 'google') {
      const gmap = map._gmap

      const gIcon = (emoji, bg) => ({
        content: Object.assign(document.createElement('div'), {
          innerHTML: `<div style="width:40px;height:40px;border-radius:50%;background:${bg};border:2.5px solid rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 14px rgba(0,0,0,.55);">${emoji}</div>`
        })
      })

      if (userPos) {
        if (marksRef.current.user) marksRef.current.user.position = { lat:userPos.lat, lng:userPos.lng }
        else marksRef.current.user = new window.google.maps.marker.AdvancedMarkerElement({ map:gmap, position:{lat:userPos.lat,lng:userPos.lng}, content:gIcon('📍','#3b82f6').content })
      }
      if (driverPos) {
        const deg = prevDrv.current ? getBearing(prevDrv.current, driverPos) : 0
        prevDrv.current = driverPos
        const carEl = Object.assign(document.createElement('div'), {
          innerHTML:`<div style="width:44px;height:44px;transform:rotate(${deg}deg);transition:transform .5s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 4px 12px rgba(0,0,0,.55));"><svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="21" fill="#22c55e" stroke="rgba(255,255,255,.95)" stroke-width="2"/><rect x="13" y="18" width="18" height="10" rx="3" fill="#0a0a0f"/><rect x="16" y="14" width="12" height="7" rx="2" fill="#0a0a0f"/><circle cx="14" cy="22" r="1.5" fill="#f5a623" opacity=".9"/></svg></div>`
        })
        if (marksRef.current.driver) { marksRef.current.driver.position = {lat:driverPos.lat,lng:driverPos.lng}; marksRef.current.driver.content = carEl }
        else marksRef.current.driver = new window.google.maps.marker.AdvancedMarkerElement({ map:gmap, position:{lat:driverPos.lat,lng:driverPos.lng}, content:carEl, zIndex:100 })
      }
      if (dropPos) {
        if (marksRef.current.drop) marksRef.current.drop.position = {lat:dropPos.lat,lng:dropPos.lng}
        else marksRef.current.drop = new window.google.maps.marker.AdvancedMarkerElement({ map:gmap, position:{lat:dropPos.lat,lng:dropPos.lng}, content:gIcon('🏁','#f5a623').content })
      }

      // Lines
      map._lines.forEach(l => l.setMap(null)); map._lines = []
      if (driverPos && userPos && !isInRide) {
        map._lines.push(new window.google.maps.Polyline({ map:gmap, path:[{lat:driverPos.lat,lng:driverPos.lng},{lat:userPos.lat,lng:userPos.lng}], strokeColor:'#3b82f6', strokeWeight:4, strokeOpacity:.7, icons:[{icon:{path:'M 0,-1 0,1',strokeOpacity:.7,scale:4},offset:'0',repeat:'12px'}] }))
      }
      if (userPos && dropPos) {
        const path = routeGeo?.coordinates ? routeGeo.coordinates.map(([lng,lat])=>({lat,lng})) : [{lat:userPos.lat,lng:userPos.lng},{lat:dropPos.lat,lng:dropPos.lng}]
        map._lines.push(new window.google.maps.Polyline({ map:gmap, path, strokeColor:'rgba(245,166,35,.3)', strokeWeight:12, strokeOpacity:1 }))
        map._lines.push(new window.google.maps.Polyline({ map:gmap, path, strokeColor:'#f5a623', strokeWeight:5, strokeOpacity:.9 }))
      }

      // Fit bounds
      const pts = []
      if (userPos)   pts.push({lat:userPos.lat,lng:userPos.lng})
      if (driverPos) pts.push({lat:driverPos.lat,lng:driverPos.lng})
      if (dropPos)   pts.push({lat:dropPos.lat,lng:dropPos.lng})
      if (pts.length > 1) {
        const bounds = new window.google.maps.LatLngBounds()
        pts.forEach(p => bounds.extend(p))
        gmap.fitBounds(bounds, 60)
      } else if (pts.length === 1) { gmap.panTo(pts[0]); gmap.setZoom(14) }
      return
    }

    // ── Leaflet rendering ───────────────────────────────────────────

    // Pickup marker
    if (userPos) {
      if (marksRef.current.user) smoothMove(marksRef.current.user, userPos.lat, userPos.lng)
      else marksRef.current.user = L.marker([userPos.lat,userPos.lng], { icon:pickupIcon(), zIndexOffset:100 })
        .addTo(map).bindPopup(adminMode ? '🧑 Passenger' : 'Your Pickup')
    }

    // Driver marker
    if (driverPos) {
      const deg = prevDrv.current ? getBearing(prevDrv.current, driverPos) : 0
      prevDrv.current = driverPos
      if (marksRef.current.driver) {
        smoothMove(marksRef.current.driver, driverPos.lat, driverPos.lng)
        setTimeout(() => { if (marksRef.current.driver) marksRef.current.driver.setIcon(carIcon(deg)) }, 50)
      } else {
        marksRef.current.driver = L.marker([driverPos.lat,driverPos.lng], { icon:carIcon(deg), zIndexOffset:1000 })
          .addTo(map).bindPopup(adminMode ? '🚗 Driver (Live)' : 'Your Driver')
      }
    }

    // Destination marker
    if (dropPos) {
      if (marksRef.current.drop) smoothMove(marksRef.current.drop, dropPos.lat, dropPos.lng)
      else marksRef.current.drop = L.marker([dropPos.lat,dropPos.lng], { icon:destIcon(dropPos.label||'Destination'), zIndexOffset:200 })
        .addTo(map).bindPopup(dropPos.label||'Destination')
    }

    // Route lines
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

    // Smart zoom
    if (zoomTimer.current) clearTimeout(zoomTimer.current)
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

  }, [userPos, driverPos, dropPos, routeGeo, adminMode, isInRide])

  if (!userPos && !driverPos && !dropPos) return (
    <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
      <div style={{ fontSize:'2.5rem' }}>🗺️</div>
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
