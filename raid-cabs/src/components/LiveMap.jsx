// LiveMap — MapLibre GL JS + Maptiler Cloud tiles
// Free: 100k map loads/month (maptiler.com, email only, no credit card)
// Routing: OpenRouteService via /api/route proxy (2000 req/day free)
// Same API as Mapbox GL JS — MapLibre is a direct fork

import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// OpenFreeMap dark style — free, no key, reliable across all browsers
// No OffscreenCanvas dependency, no worker crashes, no CORS issues
const STYLE = 'https://tiles.openfreemap.org/styles/dark'

// ── Marker elements ───────────────────────────────────────────────────────────
function circleEl(emoji, bg, size = 42) {
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, `border-radius:50%`,
    `background:${bg}`, `border:2.5px solid rgba(255,255,255,.95)`,
    `display:flex`, `align-items:center`, `justify-content:center`,
    `font-size:${Math.round(size * .45)}px`,
    `box-shadow:0 3px 14px rgba(0,0,0,.55),0 0 0 4px ${bg}28`,
    `cursor:pointer`, `transition:transform .25s`, `user-select:none`,
  ].join(';')
  el.textContent = emoji
  return el
}

function destEl(label) {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
  const short = label.length > 18 ? label.slice(0, 17) + '…' : label
  el.innerHTML = `
    <div style="background:#f5a623;border:2.5px solid rgba(255,255,255,.95);border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 3px 14px rgba(0,0,0,.5),0 0 0 4px rgba(245,166,35,.3);">🏁</div>
    <div style="background:#f5a623;color:#0a0a0f;font-size:10px;font-weight:800;padding:3px 8px;border-radius:99px;margin-top:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);">${short}</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #f5a623;margin-top:-1px;"></div>
  `
  return el
}

// ── Source / layer helpers ────────────────────────────────────────────────────
function removePair(map, layerId, sourceId) {
  try { if (map.getLayer(layerId))   map.removeLayer(layerId) }   catch {}
  try { if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
}

function drawRoutes(map, userPos, driverPos, dropPos, routeGeo) {
  removePair(map, 'route-approach-layer', 'route-approach')
  removePair(map, 'route-trip-layer',     'route-trip')

  // Driver → Pickup: dashed blue
  if (driverPos && userPos) {
    map.addSource('route-approach', {
      type: 'geojson',
      data: { type:'Feature', geometry:{ type:'LineString',
        coordinates:[[driverPos.lng, driverPos.lat],[userPos.lng, userPos.lat]] } }
    })
    map.addLayer({
      id:'route-approach-layer', type:'line', source:'route-approach',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#3b82f6', 'line-width':4, 'line-opacity':.75, 'line-dasharray':[2,2] }
    })
  }

  // Pickup → Destination: real road route (gold)
  if (userPos && dropPos) {
    const geometry = routeGeo || { type:'LineString',
      coordinates:[[userPos.lng, userPos.lat],[dropPos.lng, dropPos.lat]] }
    map.addSource('route-trip', { type:'geojson', data:{ type:'Feature', geometry } })
    map.addLayer({
      id:'route-trip-layer', type:'line', source:'route-trip',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#f5a623', 'line-width':5, 'line-opacity':.9 }
    })
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveMap({
  userPos,
  driverPos = null,
  dropPos   = null,
  routeGeo  = null,
  height    = 420,
  liveLabel = null,
  adminMode = false,
}) {
  const divRef   = useRef(null)
  const mapRef   = useRef(null)
  const marksRef = useRef({})
  const readyRef = useRef(false)

  const upsert = useCallback((key, lngLat, el, popupText) => {
    const map = mapRef.current
    if (!map) return
    if (marksRef.current[key]) {
      marksRef.current[key].setLngLat(lngLat)
    } else {
      marksRef.current[key] = new maplibregl.Marker({ element: el, anchor:'center' })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset:24, closeButton:false })
          .setHTML(`<span style="font-size:.84rem;font-weight:600;">${popupText}</span>`))
        .addTo(map)
    }
  }, [])

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }

    const map = new maplibregl.Map({
      container: divRef.current,
      style: STYLE,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: false,
      fadeDuration: 0,
    })

    map.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right')

    // Silence missing sprite image errors (OpenFreeMap has a few)
    map.on('styleimagemissing', id => {
      if (!map.hasImage(id)) {
        try { map.addImage(id, new ImageData(new Uint8ClampedArray(4), 1, 1)) } catch {}
      }
    })

    map.on('load', () => { readyRef.current = true })
    mapRef.current = map

    return () => {
      readyRef.current = false
      map.remove()
      mapRef.current   = null
      marksRef.current = {}
    }
  }, [])

  // Update markers + routes when positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (userPos)   upsert('user',   [userPos.lng,  userPos.lat],
        circleEl('📍','#3b82f6',42),
        adminMode ? '🧑 Passenger Pickup' : 'Your Pickup')

      if (driverPos) upsert('driver', [driverPos.lng, driverPos.lat],
        circleEl('🚗','#22c55e',46),
        adminMode ? '🚗 Driver (Live)' : 'Your Driver')

      if (dropPos) {
        const label = dropPos.label || 'Destination'
        if (marksRef.current.drop) {
          marksRef.current.drop.setLngLat([dropPos.lng, dropPos.lat])
        } else {
          marksRef.current.drop = new maplibregl.Marker({ element:destEl(label), anchor:'bottom' })
            .setLngLat([dropPos.lng, dropPos.lat])
            .setPopup(new maplibregl.Popup({ offset:24, closeButton:false })
              .setHTML(`<span style="font-size:.84rem;font-weight:600;">🏁 ${label}</span>`))
            .addTo(map)
        }
      }

      if (readyRef.current) {
        drawRoutes(map, userPos, driverPos, dropPos, routeGeo)
      } else {
        map.once('load', () => drawRoutes(map, userPos, driverPos, dropPos, routeGeo))
      }

      const pts = []
      if (userPos)   pts.push([userPos.lng,  userPos.lat])
      if (driverPos) pts.push([driverPos.lng, driverPos.lat])
      if (dropPos)   pts.push([dropPos.lng,  dropPos.lat])

      if (pts.length > 1) {
        const bounds = pts.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(pts[0], pts[0])
        )
        map.fitBounds(bounds, {
          padding: adminMode
            ? { top:50, bottom:50, left:40, right:40 }
            : { top:65, bottom:65, left:55, right:55 },
          maxZoom:15, duration:600
        })
      } else if (pts.length === 1) {
        map.flyTo({ center:pts[0], zoom:14, duration:600 })
      }
    }

    if (readyRef.current) apply()
    else map.once('load', apply)

  }, [userPos, driverPos, dropPos, routeGeo, adminMode, upsert])

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
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,.12)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:7, zIndex:10, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.4)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'livepulse 1.4s infinite', display:'inline-block' }}/>
          {liveLabel}
          <style>{`@keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
        </div>
      )}

      {adminMode && (driverPos || userPos) && (
        <div style={{ position:'absolute', top:'1rem', left:'1rem', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'.55rem .85rem', zIndex:10, display:'flex', flexDirection:'column', gap:5 }}>
          {driverPos && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#22c55e', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Driver (Live)</span></div>}
          {userPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#3b82f6', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Passenger</span></div>}
          {dropPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#f5a623', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Destination</span></div>}
        </div>
      )}

      <style>{`
        .maplibregl-ctrl-attrib{background:rgba(5,5,14,.7)!important;color:#504c74!important;font-size:9px!important;}
        .maplibregl-ctrl-attrib a{color:#504c74!important;}
        .maplibregl-ctrl-group{background:#0e0e20!important;border:1px solid rgba(255,179,71,.15)!important;border-radius:8px!important;overflow:hidden;}
        .maplibregl-ctrl button{background:#0e0e20!important;border:none!important;}
        .maplibregl-ctrl button span{filter:invert(1) opacity(.55);}
        .maplibregl-popup-content{background:#13131e!important;color:#f0eefc!important;border:1px solid rgba(255,179,71,.2)!important;border-radius:10px!important;font-family:'Inter',sans-serif!important;padding:8px 12px!important;box-shadow:0 8px 32px rgba(0,0,0,.5)!important;}
        .maplibregl-popup-tip{display:none!important;}
        .maplibregl-canvas{touch-action:none;}
      `}</style>
    </div>
  )
}
