import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const IIT      = { lat: 17.5934, lng: 78.1270 }
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATT = '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>'

function pin(emoji, color, sz = 38) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color};
      border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(sz*.42)}px;box-shadow:0 3px 12px rgba(0,0,0,.5);">${emoji}</div>`,
    iconSize: [sz, sz], iconAnchor: [sz/2, sz/2], popupAnchor: [0, -sz/2],
  })
}

function iitPin() {
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"
      style="filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z"
            fill="#ffb347" stroke="#ff6b35" stroke-width="1.5"/>
      <text x="18" y="25" font-size="14" text-anchor="middle">🎓</text>
    </svg>`,
    iconSize: [36, 48], iconAnchor: [18, 48], popupAnchor: [0, -48],
  })
}

export default function RideMap({ userPos, driverPos = null, showIIT = true, height = 430, liveLabel = null }) {
  const divRef   = useRef(null)
  const mapRef   = useRef(null)
  const mkRef    = useRef({})
  const linesRef = useRef([])

  useEffect(() => {
    if (!divRef.current || !userPos) return

    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current, { center: [userPos.lat, userPos.lng], zoom: 13, zoomControl: true })
      L.tileLayer(TILE_URL, { attribution: TILE_ATT, subdomains: 'abcd', maxZoom: 19 }).addTo(mapRef.current)
    }
    const map = mapRef.current

    if (!mkRef.current.user) {
      mkRef.current.user = L.marker([userPos.lat, userPos.lng], { icon: pin('📍','#3498db') })
        .addTo(map).bindPopup('<b>Your Pickup</b>')
    } else {
      mkRef.current.user.setLatLng([userPos.lat, userPos.lng])
    }

    if (showIIT && !mkRef.current.iit) {
      mkRef.current.iit = L.marker([IIT.lat, IIT.lng], { icon: iitPin() })
        .addTo(map).bindPopup('<b>IIT Hyderabad</b>').openPopup()
    }

    if (driverPos) {
      if (!mkRef.current.driver) {
        mkRef.current.driver = L.marker([driverPos.lat, driverPos.lng], { icon: pin('🚗','#2ecc71',42) })
          .addTo(map).bindPopup('<b>Your Driver</b>')
      } else {
        mkRef.current.driver.setLatLng([driverPos.lat, driverPos.lng])
      }
    }

    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []

    if (driverPos) {
      linesRef.current.push(L.polyline(
        [[driverPos.lat,driverPos.lng],[userPos.lat,userPos.lng]],
        { color:'#3498db', weight:4, opacity:.7, dashArray:'8,6' }
      ).addTo(map))
    }
    if (showIIT) {
      linesRef.current.push(L.polyline(
        [[userPos.lat,userPos.lng],[IIT.lat,IIT.lng]],
        { color:'#ffb347', weight:5, opacity:.85 }
      ).addTo(map))
    }

    const pts = [[userPos.lat, userPos.lng]]
    if (showIIT) pts.push([IIT.lat, IIT.lng])
    if (driverPos) pts.push([driverPos.lat, driverPos.lng])
    if (pts.length > 1) map.fitBounds(pts, { padding: [50,50] })
  }, [userPos, driverPos, showIIT])

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; mkRef.current = {} }
  }, [])

  if (!userPos) return (
    <div style={{ width:'100%', height, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', background:'var(--card)', borderRadius:'var(--r)', border:'1px solid var(--b1)' }}>
      <div style={{ fontSize:'3rem' }}>🗺️</div>
      <p style={{ color:'var(--ts)', fontSize:'.88rem', textAlign:'center', maxWidth:240, lineHeight:1.6 }}>Enter your pickup location to see the map</p>
    </div>
  )

  return (
    <div style={{ position:'relative', borderRadius:'var(--r)', overflow:'hidden', border:'1px solid var(--b1)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>
      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid var(--b1)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:6, zIndex:500, whiteSpace:'nowrap' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#2ecc71', animation:'pulse 1.5s infinite', display:'inline-block' }}/>
          {liveLabel}
        </div>
      )}
      <style>{`
        .leaflet-control-attribution{background:rgba(5,5,14,.7)!important;color:#504c74!important;font-size:9px!important;}
        .leaflet-control-attribution a{color:#504c74!important;}
        .leaflet-control-zoom a{background:#0e0e20!important;color:#ede8d8!important;border-color:rgba(255,165,40,.2)!important;}
        .leaflet-popup-content-wrapper{background:#0e0e20;color:#ede8d8;border:1px solid rgba(255,165,40,.2);border-radius:10px;font-family:'Nunito',sans-serif;}
        .leaflet-popup-tip{background:#0e0e20;}
      `}</style>
    </div>
  )
}
