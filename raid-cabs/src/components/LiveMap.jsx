// LiveMap — MapLibre GL JS + OpenFreeMap tiles
// Free, no API key, GPU-accelerated, mobile-optimised

import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const IIT   = { lat: 17.5934, lng: 78.1270 }
const STYLE = 'https://tiles.openfreemap.org/styles/dark'

// Unique IDs per component instance to avoid conflicts on same page
let _instanceCounter = 0

function markerEl(emoji, color, size = 40) {
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`,`height:${size}px`,`border-radius:50%`,
    `background:${color}`,`border:2.5px solid rgba(255,255,255,.9)`,
    `display:flex`,`align-items:center`,`justify-content:center`,
    `font-size:${Math.round(size * .44)}px`,`cursor:pointer`,
    `box-shadow:0 2px 12px rgba(0,0,0,.55),0 0 0 3px ${color}33`,
    `transition:transform .25s`,`user-select:none`,`touch-action:none`,
  ].join(';')
  el.textContent = emoji
  return el
}

function dropEl() {
  const el = document.createElement('div')
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))">
    <path d="M15 0C6.72 0 0 6.72 0 15c0 11.25 15 27 15 27S30 26.25 30 15C30 6.72 23.28 0 15 0z" fill="#f5a623" stroke="#e8860a" stroke-width="1.2"/>
    <text x="15" y="21" font-size="12" text-anchor="middle">🎓</text>
  </svg>`
  return el
}

// Remove a layer+source pair safely (layer first, then source)
function removePair(map, layerId, sourceId) {
  try { if (map.getLayer(layerId))  map.removeLayer(layerId) }  catch {}
  try { if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
}

// Add route lines — always remove old ones first
function upsertLines(map, userPos, driverPos, showDrop) {
  // Always remove layers BEFORE sources
  removePair(map, 'route-driver-line', 'route-driver')
  removePair(map, 'route-trip-line',   'route-trip')

  if (driverPos && userPos) {
    map.addSource('route-driver', {
      type: 'geojson',
      data: { type:'Feature', geometry:{ type:'LineString',
        coordinates:[[driverPos.lng, driverPos.lat],[userPos.lng, userPos.lat]] } }
    })
    map.addLayer({ id:'route-driver-line', type:'line', source:'route-driver',
      paint:{ 'line-color':'#3b82f6', 'line-width':4, 'line-opacity':.75, 'line-dasharray':[2,2] } })
  }

  if (userPos && showDrop) {
    map.addSource('route-trip', {
      type: 'geojson',
      data: { type:'Feature', geometry:{ type:'LineString',
        coordinates:[[userPos.lng, userPos.lat],[IIT.lng, IIT.lat]] } }
    })
    map.addLayer({ id:'route-trip-line', type:'line', source:'route-trip',
      paint:{ 'line-color':'#f5a623', 'line-width':5, 'line-opacity':.85 } })
  }
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
  const idRef    = useRef(++_instanceCounter)
  const readyRef = useRef(false)

  // Upsert marker helper
  const upsertMarker = useCallback((key, lngLat, el, popupText) => {
    const map = mapRef.current
    if (!map) return
    if (marksRef.current[key]) {
      marksRef.current[key].setLngLat(lngLat)
    } else {
      marksRef.current[key] = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset:20, closeButton:false }).setText(popupText))
        .addTo(map)
    }
  }, [])

  // Init map ONCE
  useEffect(() => {
    if (!divRef.current || mapRef.current) return

    const center = userPos || driverPos || IIT

    const map = new maplibregl.Map({
      container:         divRef.current,
      style:             STYLE,
      center:            [center.lng, center.lat],
      zoom:              13,
      attributionControl:false,
      fadeDuration:      0,
    })

    map.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right')

    map.on('load', () => {
      readyRef.current = true
      // Trigger position update now that map is ready
      map.fire('_positions_ready')
    })

    mapRef.current = map

    return () => {
      readyRef.current = false
      map.remove()
      mapRef.current  = null
      marksRef.current = {}
    }
  }, []) // init once only — no deps

  // Update markers + lines whenever positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      // Pickup marker
      if (userPos) {
        upsertMarker('user', [userPos.lng, userPos.lat], markerEl('📍','#3b82f6'), 'Your Pickup')
      }

      // Driver marker
      if (driverPos) {
        upsertMarker('driver', [driverPos.lng, driverPos.lat], markerEl('🚗','#22c55e',44), 'Your Driver')
      }

      // IIT drop marker
      if (showDrop && !marksRef.current.iit) {
        marksRef.current.iit = new maplibregl.Marker({ element:dropEl(), anchor:'bottom' })
          .setLngLat([IIT.lng, IIT.lat])
          .setPopup(new maplibregl.Popup({ offset:20, closeButton:false }).setText('IIT Hyderabad'))
          .addTo(map)
      }

      // Route lines (safe upsert)
      if (readyRef.current) {
        upsertLines(map, userPos, driverPos, showDrop)
      }

      // Fit bounds
      const pts = []
      if (userPos)   pts.push([userPos.lng,  userPos.lat])
      if (driverPos) pts.push([driverPos.lng, driverPos.lat])
      if (showDrop)  pts.push([IIT.lng,       IIT.lat])

      if (pts.length > 1) {
        const bounds = pts.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(pts[0], pts[0])
        )
        map.fitBounds(bounds, { padding:{ top:60,bottom:60,left:50,right:50 }, maxZoom:15, duration:500 })
      } else if (pts.length === 1) {
        map.flyTo({ center:pts[0], zoom:14, duration:500 })
      }
    }

    if (readyRef.current) {
      apply()
    } else {
      // Wait for style to load
      map.once('load', apply)
    }
  }, [userPos, driverPos, showDrop, upsertMarker])

  if (!userPos && !driverPos) {
    return (
      <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
        <div style={{ fontSize:'2.5rem' }}>🗺️</div>
        <p style={{ color:'#8b87b0', fontSize:'.87rem', textAlign:'center', maxWidth:230, lineHeight:1.6, padding:'0 1rem' }}>Enter a pickup location to see the map</p>
      </div>
    )
  }

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.07)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.12)', borderRadius:99, padding:'.4rem 1rem', fontSize:'.79rem', display:'inline-flex', alignItems:'center', gap:6, zIndex:10, whiteSpace:'nowrap' }}>
          <span style={{ width:7,height:7,borderRadius:'50%',background:'#22c55e',animation:'lmpulse 1.5s infinite',display:'inline-block' }}/>
          {liveLabel}
          <style>{`@keyframes lmpulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
        </div>
      )}

      <style>{`
        .maplibregl-ctrl-attrib{background:rgba(5,5,14,.7)!important;color:#504c74!important;font-size:9px!important;}
        .maplibregl-ctrl-attrib a{color:#504c74!important;}
        .maplibregl-ctrl-group{background:#0e0e20!important;border:1px solid rgba(255,179,71,.15)!important;border-radius:8px!important;overflow:hidden;}
        .maplibregl-ctrl button{background:#0e0e20!important;border:none!important;}
        .maplibregl-ctrl button span{filter:invert(1)!important;opacity:.55;}
        .maplibregl-popup-content{background:#13131e!important;color:#f0eefc!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Inter',sans-serif!important;font-size:.84rem!important;padding:8px 12px!important;box-shadow:0 8px 32px rgba(0,0,0,.5)!important;}
        .maplibregl-popup-tip{display:none!important;}
        .maplibregl-canvas{touch-action:none;}
      `}</style>
    </div>
  )
}
