// LiveMap — MapLibre GL JS + OpenFreeMap tiles
// Free forever, no API key, GPU-accelerated, works perfectly on mobile
// Replaces Leaflet entirely

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const IIT  = { lat: 17.5934, lng: 78.1270 }

// Free vector tile style — OpenFreeMap dark (no API key)
const STYLE = 'https://tiles.openfreemap.org/styles/dark'

function makeMarkerEl(emoji, color, size = 40) {
  const el = document.createElement('div')
  el.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};border:2.5px solid rgba(255,255,255,.9);
    display:flex;align-items:center;justify-content:center;
    font-size:${Math.round(size*.44)}px;cursor:pointer;
    box-shadow:0 2px 12px rgba(0,0,0,.6),0 0 0 3px ${color}44;
    transition:transform .2s;
  `
  el.textContent = emoji
  return el
}

function makeDropEl() {
  const el = document.createElement('div')
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44" style="filter:drop-shadow(0 3px 8px rgba(0,0,0,.6))">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 28 16 28S32 28 32 16C32 7.16 24.84 0 16 0z" fill="#f5a623" stroke="#e8860a" stroke-width="1.5"/>
    <text x="16" y="22" font-size="13" text-anchor="middle">🎓</text>
  </svg>`
  return el
}

export default function LiveMap({
  userPos,
  driverPos = null,
  showDrop  = true,
  height    = 400,
  liveLabel = null,
}) {
  const divRef    = useRef(null)
  const mapRef    = useRef(null)
  const marksRef  = useRef({})

  // Init map
  useEffect(() => {
    if (!divRef.current) return
    if (mapRef.current) return // already initialized

    const center = userPos || driverPos || IIT

    try {
      const map = new maplibregl.Map({
        container:   divRef.current,
        style:       STYLE,
        center:      [center.lng, center.lat],
        zoom:        13,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

      mapRef.current = map
    } catch (err) {
      console.warn('[LiveMap] MapLibre init failed:', err.message)
    }
  }, []) // init once only

  // Update markers + bounds when positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const ready = () => {
      const marks = marksRef.current

      // User/Pickup marker
      if (userPos) {
        if (marks.user) {
          marks.user.setLngLat([userPos.lng, userPos.lat])
        } else {
          marks.user = new maplibregl.Marker({ element: makeMarkerEl('📍', '#3b82f6'), anchor: 'center' })
            .setLngLat([userPos.lng, userPos.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText('Your Pickup'))
            .addTo(map)
        }
      }

      // Driver marker
      if (driverPos) {
        if (marks.driver) {
          marks.driver.setLngLat([driverPos.lng, driverPos.lat])
        } else {
          marks.driver = new maplibregl.Marker({ element: makeMarkerEl('🚗', '#22c55e', 44), anchor: 'center' })
            .setLngLat([driverPos.lng, driverPos.lat])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText('Your Driver'))
            .addTo(map)
        }
      }

      // IIT drop marker
      if (showDrop && !marks.iit) {
        marks.iit = new maplibregl.Marker({ element: makeDropEl(), anchor: 'bottom' })
          .setLngLat([IIT.lng, IIT.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText('IIT Hyderabad'))
          .addTo(map)
      }

      // Draw route lines using GeoJSON
      if (map.isStyleLoaded()) {
        addLines(map, userPos, driverPos, showDrop)
      } else {
        map.once('styledata', () => addLines(map, userPos, driverPos, showDrop))
      }

      // Fit bounds
      const coords = []
      if (userPos)   coords.push([userPos.lng,   userPos.lat])
      if (driverPos) coords.push([driverPos.lng,  driverPos.lat])
      if (showDrop)  coords.push([IIT.lng, IIT.lat])

      if (coords.length > 1) {
        const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 })
      } else if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: 14, duration: 600 })
      }
    }

    if (map.loaded()) {
      ready()
    } else {
      map.once('load', ready)
    }
  }, [userPos, driverPos, showDrop])

  // Cleanup
  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current  = null
      marksRef.current = {}
    }
  }, [])

  if (!userPos && !driverPos) {
    return (
      <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
        <div style={{ fontSize:'2.5rem' }}>🗺️</div>
        <p style={{ color:'#8b87b0', fontSize:'.88rem', textAlign:'center', maxWidth:230, lineHeight:1.6 }}>Enter a pickup location to see the map</p>
      </div>
    )
  }

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.07)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:99, padding:'.4rem 1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:6, zIndex:10, whiteSpace:'nowrap' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', animation:'lmpulse 1.5s infinite', display:'inline-block' }}/>
          {liveLabel}
          <style>{`@keyframes lmpulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
        </div>
      )}

      <style>{`
        .maplibregl-ctrl-attrib{background:rgba(5,5,14,.7)!important;color:#504c74!important;font-size:9px!important;}
        .maplibregl-ctrl-attrib a{color:#504c74!important;}
        .maplibregl-ctrl button{background:#0e0e20!important;border:1px solid rgba(255,179,71,.15)!important;}
        .maplibregl-ctrl button span{filter:invert(1)!important;opacity:.6;}
        .maplibregl-popup-content{background:#0e0e20!important;color:#f0eefc!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Inter',sans-serif!important;font-size:.85rem!important;padding:8px 12px!important;}
        .maplibregl-popup-tip{display:none!important;}
        .maplibregl-ctrl-group{background:#0e0e20!important;border:1px solid rgba(255,179,71,.15)!important;border-radius:8px!important;}
      `}</style>
    </div>
  )
}

function addLines(map, userPos, driverPos, showDrop) {
  // Remove old sources/layers
  for (const id of ['route-driver', 'route-trip', 'route-driver-line', 'route-trip-line']) {
    if (map.getLayer(id))  map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
  }

  // Driver → Pickup: dashed blue
  if (driverPos && userPos) {
    map.addSource('route-driver', {
      type: 'geojson',
      data: { type:'Feature', geometry:{ type:'LineString', coordinates:[[driverPos.lng,driverPos.lat],[userPos.lng,userPos.lat]] } }
    })
    map.addLayer({ id:'route-driver-line', type:'line', source:'route-driver',
      paint:{ 'line-color':'#3b82f6', 'line-width':4, 'line-opacity':.75, 'line-dasharray':[2,2] } })
  }

  // Pickup → IIT: solid gold
  if (userPos && showDrop) {
    map.addSource('route-trip', {
      type: 'geojson',
      data: { type:'Feature', geometry:{ type:'LineString', coordinates:[[userPos.lng,userPos.lat],[IIT.lng,IIT.lat]] } }
    })
    map.addLayer({ id:'route-trip-line', type:'line', source:'route-trip',
      paint:{ 'line-color':'#f5a623', 'line-width':5, 'line-opacity':.85 } })
  }
}
