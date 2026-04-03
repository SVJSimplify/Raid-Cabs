// LiveMap — Leaflet + OpenStreetMap CartoDB Dark tiles
// Zero external dependencies beyond leaflet (already installed)
// Props:
//   userPos    { lat, lng }  — pickup / passenger position
//   driverPos  { lat, lng }  — driver live GPS (optional)
//   showDrop   boolean       — show IIT marker (default true)
//   height     number        — px height (default 400)
//   liveLabel  string        — chip at bottom (optional)

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const IIT  = { lat: 17.5934, lng: 78.1270 }
const TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function circleIcon(emoji, bg, sz = 38) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${sz}px;height:${sz}px;border-radius:50%;
      background:${bg};border:2.5px solid rgba(255,255,255,.9);
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(sz * .44)}px;
      box-shadow:0 2px 12px rgba(0,0,0,.6),0 0 0 3px ${bg}33;">
      ${emoji}</div>`,
    iconSize:    [sz, sz],
    iconAnchor:  [sz/2, sz/2],
    popupAnchor: [0, -sz/2],
  })
}

function dropIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="filter:drop-shadow(0 3px 8px rgba(0,0,0,.6));line-height:1;">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28S32 28 32 16C32 7.16 24.84 0 16 0z"
              fill="#ffb347" stroke="#e8860a" stroke-width="1.5"/>
        <text x="16" y="22" font-size="13" text-anchor="middle">🎓</text>
      </svg></div>`,
    iconSize:    [32, 44],
    iconAnchor:  [16, 44],
    popupAnchor: [0, -44],
  })
}

export default function LiveMap({
  userPos,
  driverPos = null,
  showDrop  = true,
  height    = 400,
  liveLabel = null,
}) {
  const divRef   = useRef(null)
  const mapRef   = useRef(null)
  const marksRef = useRef({})
  const linesRef = useRef([])

  // Init + update map whenever positions change
  useEffect(() => {
    if (!divRef.current) return
    if (!userPos && !driverPos) return

    const center = userPos || driverPos || IIT

    // Create map once
    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current, {
        center:             [center.lat, center.lng],
        zoom:               13,
        zoomControl:        true,
        scrollWheelZoom:    true,
        attributionControl: true,
      })
      L.tileLayer(TILE, { attribution: ATTR, subdomains: 'abcd', maxZoom: 19 })
        .addTo(mapRef.current)
    }

    const map = marksRef

    // Helper: upsert marker
    const upsert = (key, lat, lng, icon, popup) => {
      if (!marksRef.current[key]) {
        marksRef.current[key] = L.marker([lat, lng], { icon, zIndexOffset: key === 'driver' ? 1000 : 0 })
          .addTo(mapRef.current).bindPopup(popup)
      } else {
        marksRef.current[key].setLatLng([lat, lng])
      }
    }

    // Pickup marker
    if (userPos) upsert('user', userPos.lat, userPos.lng,
      circleIcon('📍', '#3498db'), '<b>Pickup Point</b>')

    // Driver marker
    if (driverPos) upsert('driver', driverPos.lat, driverPos.lng,
      circleIcon('🚗', '#2ecc71', 42), '<b>Your Driver</b>')

    // IIT drop
    if (showDrop && !marksRef.current.iit) {
      marksRef.current.iit = L.marker([IIT.lat, IIT.lng], { icon: dropIcon() })
        .addTo(mapRef.current).bindPopup('<b>IIT Hyderabad</b>')
    }

    // Remove old lines
    linesRef.current.forEach(l => mapRef.current.removeLayer(l))
    linesRef.current = []

    // Driver → Pickup: dashed blue
    if (driverPos && userPos) {
      linesRef.current.push(
        L.polyline([[driverPos.lat, driverPos.lng], [userPos.lat, userPos.lng]], {
          color: '#3498db', weight: 4, opacity: .7, dashArray: '10,7',
        }).addTo(mapRef.current)
      )
    }

    // Pickup → IIT: solid gold
    if (userPos && showDrop) {
      linesRef.current.push(
        L.polyline([[userPos.lat, userPos.lng], [IIT.lat, IIT.lng]], {
          color: '#ffb347', weight: 5, opacity: .85,
        }).addTo(mapRef.current)
      )
    }

    // Fit bounds to show all markers
    const pts = []
    if (userPos)   pts.push([userPos.lat, userPos.lng])
    if (driverPos) pts.push([driverPos.lat, driverPos.lng])
    if (showDrop)  pts.push([IIT.lat, IIT.lng])
    if (pts.length > 1) {
      mapRef.current.fitBounds(pts, { padding: [55, 55], maxZoom: 15 })
    } else if (pts.length === 1) {
      mapRef.current.setView(pts[0], 14)
    }
  }, [userPos, driverPos, showDrop])

  // Cleanup on unmount
  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current  = null
      marksRef.current = {}
      linesRef.current = []
    }
  }, [])

  if (!userPos && !driverPos) {
    return (
      <div style={{ width:'100%', height, background:'#0c0c1c', borderRadius:'var(--r)', border:'1px solid var(--b1)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
        <div style={{ fontSize:'3rem' }}>🗺️</div>
        <p style={{ color:'var(--ts)', fontSize:'.88rem', textAlign:'center', maxWidth:230, lineHeight:1.6 }}>Enter a pickup location to see the map</p>
      </div>
    )
  }

  return (
    <div style={{ position:'relative', borderRadius:'var(--r)', overflow:'hidden', border:'1px solid var(--b1)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.9)', backdropFilter:'blur(12px)', border:'1px solid var(--b1)', borderRadius:99, padding:'.4rem 1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:6, zIndex:500, whiteSpace:'nowrap' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#2ecc71', boxShadow:'0 0 0 0 rgba(46,204,113,.5)', animation:'mp 1.5s infinite', display:'inline-block' }}/>
          {liveLabel}
        </div>
      )}

      <style>{`
        @keyframes mp{0%{box-shadow:0 0 0 0 rgba(46,204,113,.5);}70%{box-shadow:0 0 0 8px rgba(46,204,113,0);}100%{box-shadow:0 0 0 0 rgba(46,204,113,0);}}
        .leaflet-control-attribution{background:rgba(5,5,14,.75)!important;color:#504c74!important;font-size:9px!important;border:none!important;}
        .leaflet-control-attribution a{color:#504c74!important;}
        .leaflet-control-zoom a{background:#0e0e20!important;color:#ede8d8!important;border-color:rgba(255,179,71,.2)!important;font-size:14px!important;}
        .leaflet-control-zoom a:hover{background:#161628!important;color:var(--gold)!important;}
        .leaflet-popup-content-wrapper{background:#0e0e20!important;color:#ede8d8!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Nunito',sans-serif!important;box-shadow:0 8px 32px rgba(0,0,0,.5)!important;}
        .leaflet-popup-tip-container{display:none!important;}
        .leaflet-popup-content{margin:8px 12px!important;font-size:.85rem!important;}
        .leaflet-bar{border:1px solid rgba(255,179,71,.2)!important;border-radius:8px!important;overflow:hidden!important;}
      `}</style>
    </div>
  )
}
