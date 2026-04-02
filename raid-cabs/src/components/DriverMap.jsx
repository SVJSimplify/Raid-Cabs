import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const IIT = { lat: 17.5934, lng: 78.1270 }
const TILE_URL  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>'

function pinIcon(emoji, bg, size = 40) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};border:2.5px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(size * 0.42)}px;
      box-shadow:0 3px 14px rgba(0,0,0,.55);">
      ${emoji}
    </div>`,
    iconSize:   [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor:[0, -size/2],
  })
}

function iitIcon() {
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"
      style="filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z"
            fill="#ffb347" stroke="#ff6b35" stroke-width="1.5"/>
      <text x="18" y="25" font-size="14" text-anchor="middle">🎓</text>
    </svg>`,
    iconSize:   [36, 48],
    iconAnchor: [18, 48],
    popupAnchor:[0, -48],
  })
}

export default function DriverMap({ booking, driverPos, height = 320 }) {
  const divRef   = useRef(null)
  const mapRef   = useRef(null)
  const mkRef    = useRef({})
  const linesRef = useRef([])

  useEffect(() => {
    if (!divRef.current) return

    const customerPos = booking?.pickup_lat && booking?.pickup_lng
      ? { lat: booking.pickup_lat, lng: booking.pickup_lng }
      : null

    const center = driverPos || customerPos || IIT

    // Init map once
    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current, {
        center:         [center.lat, center.lng],
        zoom:           14,
        zoomControl:    true,
        attributionControl: true,
      })
      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTR,
        subdomains:  'abcd',
        maxZoom:     19,
      }).addTo(mapRef.current)
    }

    const map = mapRef.current

    // ── Driver marker (green) ───────────────────────────────────────────
    if (driverPos) {
      if (!mkRef.current.driver) {
        mkRef.current.driver = L.marker([driverPos.lat, driverPos.lng], {
          icon: pinIcon('🚗', '#2ecc71', 44),
          zIndexOffset: 1000,
        }).addTo(map).bindPopup('<b>You</b>')
      } else {
        mkRef.current.driver.setLatLng([driverPos.lat, driverPos.lng])
      }
    }

    // ── Customer pickup marker (blue) ───────────────────────────────────
    if (customerPos) {
      if (!mkRef.current.customer) {
        mkRef.current.customer = L.marker([customerPos.lat, customerPos.lng], {
          icon: pinIcon('📍', '#3498db', 42),
        }).addTo(map).bindPopup('<b>Customer Pickup</b>').openPopup()
      } else {
        mkRef.current.customer.setLatLng([customerPos.lat, customerPos.lng])
      }
    }

    // ── IIT drop marker (gold) ──────────────────────────────────────────
    if (!mkRef.current.iit) {
      mkRef.current.iit = L.marker([IIT.lat, IIT.lng], { icon: iitIcon() })
        .addTo(map).bindPopup('<b>IIT Hyderabad</b>')
    }

    // ── Remove old lines ────────────────────────────────────────────────
    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []

    // Driver → Customer: dashed blue
    if (driverPos && customerPos) {
      linesRef.current.push(
        L.polyline([[driverPos.lat, driverPos.lng],[customerPos.lat, customerPos.lng]], {
          color: '#3498db', weight: 4, opacity: 0.7, dashArray: '8, 6',
        }).addTo(map)
      )
    }

    // Customer → IIT: solid gold
    if (customerPos) {
      linesRef.current.push(
        L.polyline([[customerPos.lat, customerPos.lng],[IIT.lat, IIT.lng]], {
          color: '#ffb347', weight: 5, opacity: 0.85,
        }).addTo(map)
      )
    }

    // Fit all visible points
    const pts = [[IIT.lat, IIT.lng]]
    if (driverPos)   pts.push([driverPos.lat,   driverPos.lng])
    if (customerPos) pts.push([customerPos.lat, customerPos.lng])
    if (pts.length > 1) map.fitBounds(pts, { padding: [55, 55] })

  }, [booking, driverPos])

  // Cleanup on unmount
  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      mkRef.current  = {}
    }
  }, [])

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.07)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {/* Legend */}
      <div style={{ position:'absolute', top:10, right:10, background:'rgba(5,5,14,.85)', backdropFilter:'blur(10px)', borderRadius:10, padding:'.55rem .8rem', zIndex:500, display:'flex', flexDirection:'column', gap:4 }}>
        {[['#2ecc71','🚗','You'],['#3498db','📍','Pickup'],['#ffb347','🎓','IIT']].map(([c,em,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.71rem', color:'#9890c2' }}>
            <span>{em}</span><span style={{ color:c, fontWeight:700 }}>{l}</span>
          </div>
        ))}
      </div>

      <style>{`
        .leaflet-control-attribution{background:rgba(5,5,14,.7)!important;color:#504c74!important;font-size:9px!important;}
        .leaflet-control-attribution a{color:#504c74!important;}
        .leaflet-control-zoom a{background:#0e0e20!important;color:#ede8d8!important;border-color:rgba(255,165,40,.2)!important;}
        .leaflet-control-zoom a:hover{background:#161628!important;}
        .leaflet-popup-content-wrapper{background:#0e0e20;color:#ede8d8;border:1px solid rgba(255,165,40,.2);border-radius:10px;font-family:'Nunito',sans-serif;}
        .leaflet-popup-tip{background:#0e0e20;}
      `}</style>
    </div>
  )
}
