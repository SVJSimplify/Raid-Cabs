// LiveMap — MapLibre GL JS + OpenFreeMap dark tiles
// Shows: pickup (user), driver location, drop point
// Supports real road geometry from ORS

import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const STYLE = 'https://tiles.openfreemap.org/styles/dark'

function markerEl(emoji, color, size = 40) {
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, `border-radius:50%`,
    `background:${color}`, `border:2.5px solid rgba(255,255,255,.9)`,
    `display:flex`, `align-items:center`, `justify-content:center`,
    `font-size:${Math.round(size * .44)}px`, `cursor:pointer`,
    `box-shadow:0 2px 12px rgba(0,0,0,.55),0 0 0 3px ${color}33`,
    `transition:transform .25s`, `user-select:none`, `touch-action:none`,
  ].join(';')
  el.textContent = emoji
  return el
}

function dropMarkerEl(label) {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
  el.innerHTML = `
    <div style="background:#f5a623;border:2.5px solid rgba(255,255,255,.9);border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 12px rgba(0,0,0,.5);">📍</div>
    <div style="background:#f5a623;color:#0a0a0f;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;margin-top:3px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,.4);">${label}</div>
    <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #f5a623;margin-top:-1px;"></div>
  `
  return el
}

function removePair(map, layerId, sourceId) {
  try { if (map.getLayer(layerId))   map.removeLayer(layerId)   } catch {}
  try { if (map.getSource(sourceId)) map.removeSource(sourceId) } catch {}
}

function drawLines(map, userPos, driverPos, dropPos, routeGeometry) {
  removePair(map, 'route-driver-line', 'route-driver')
  removePair(map, 'route-trip-line',   'route-trip')

  // Driver → Pickup: dashed blue
  if (driverPos && userPos) {
    map.addSource('route-driver', {
      type: 'geojson',
      data: { type:'Feature', geometry:{ type:'LineString',
        coordinates:[[driverPos.lng, driverPos.lat],[userPos.lng, userPos.lat]] } }
    })
    map.addLayer({ id:'route-driver-line', type:'line', source:'route-driver',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#3b82f6', 'line-width':4, 'line-opacity':.78, 'line-dasharray':[2,2] }
    })
  }

  // Pickup → Drop: real road geometry or straight line, gold
  const dropCoords = dropPos
    ? [dropPos.lng, dropPos.lat]
    : null

  if (userPos && dropCoords) {
    const tripGeometry = routeGeometry || {
      type:'LineString',
      coordinates:[[userPos.lng, userPos.lat], dropCoords]
    }
    map.addSource('route-trip', { type:'geojson', data:{ type:'Feature', geometry:tripGeometry } })
    map.addLayer({ id:'route-trip-line', type:'line', source:'route-trip',
      layout:{ 'line-join':'round', 'line-cap':'round' },
      paint:{ 'line-color':'#f5a623', 'line-width':5, 'line-opacity':.88 }
    })
  }
}

export default function LiveMap({
  userPos,
  driverPos     = null,
  dropPos       = null,       // custom drop location { lat, lng, label }
  routeGeometry = null,
  height        = 400,
  liveLabel     = null,
}) {
  const divRef    = useRef(null)
  const mapRef    = useRef(null)
  const marksRef  = useRef({})
  const readyRef  = useRef(false)

  const upsertMarker = useCallback((key, lngLat, el, popupText) => {
    const map = mapRef.current
    if (!map) return
    if (marksRef.current[key]) {
      marksRef.current[key].setLngLat(lngLat)
    } else {
      marksRef.current[key] = new maplibregl.Marker({ element: el, anchor:'center' })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup({ offset:20, closeButton:false }).setText(popupText))
        .addTo(map)
    }
  }, [])

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const center = userPos || driverPos || dropPos || { lat:17.5934, lng:78.1270 }
    const map = new maplibregl.Map({
      container: divRef.current, style: STYLE,
      center: [center.lng, center.lat], zoom: 13,
      attributionControl: false, fadeDuration: 0,
    })
    map.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl({ showCompass:false }), 'top-right')
    map.on('load', () => { readyRef.current = true })

    // Silence "wood-pattern" missing image warning from OpenFreeMap tile style
    // This is a bug in their sprite sheet — not fixable from our side
    map.on('styleimagemissing', (e) => {
      // Add a 1x1 transparent placeholder so MapLibre stops complaining
      if (!map.hasImage(e.id)) {
        const empty = new ImageData(new Uint8ClampedArray(4), 1, 1)
        map.addImage(e.id, empty)
      }
    })

    mapRef.current = map
    return () => {
      readyRef.current = false
      map.remove(); mapRef.current = null; marksRef.current = {}
    }
  }, [])

  // Update markers + lines when positions change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      // User pickup marker — blue
      if (userPos) {
        upsertMarker('user', [userPos.lng, userPos.lat], markerEl('📍','#3b82f6'), 'Pickup Point')
      }

      // Driver marker — green car
      if (driverPos) {
        upsertMarker('driver', [driverPos.lng, driverPos.lat], markerEl('🚗','#22c55e',44), 'Your Driver')
      }

      // Drop marker — gold with custom label
      if (dropPos) {
        const dropLabel = dropPos.label || 'Drop Off'
        if (marksRef.current.drop) {
          marksRef.current.drop.setLngLat([dropPos.lng, dropPos.lat])
        } else {
          marksRef.current.drop = new maplibregl.Marker({ element: dropMarkerEl(dropLabel), anchor:'bottom' })
            .setLngLat([dropPos.lng, dropPos.lat])
            .setPopup(new maplibregl.Popup({ offset:20, closeButton:false }).setText(dropLabel))
            .addTo(map)
        }
      }

      // Draw route lines
      if (readyRef.current) {
        drawLines(map, userPos, driverPos, dropPos, routeGeometry)
      } else {
        map.once('load', () => drawLines(map, userPos, driverPos, dropPos, routeGeometry))
      }

      // Fit all visible points
      const pts = []
      if (userPos)  pts.push([userPos.lng,  userPos.lat])
      if (driverPos) pts.push([driverPos.lng, driverPos.lat])
      if (dropPos)  pts.push([dropPos.lng,  dropPos.lat])

      if (pts.length > 1) {
        const bounds = pts.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(pts[0], pts[0])
        )
        map.fitBounds(bounds, { padding:{ top:65,bottom:65,left:50,right:50 }, maxZoom:15, duration:500 })
      } else if (pts.length === 1) {
        map.flyTo({ center:pts[0], zoom:14, duration:500 })
      }
    }

    if (readyRef.current) apply()
    else map.once('load', apply)
  }, [userPos, driverPos, dropPos, routeGeometry, upsertMarker])

  if (!userPos && !driverPos) {
    return (
      <div style={{ width:'100%', height, background:'#111118', borderRadius:14, border:'1px solid rgba(255,255,255,.07)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
        <div style={{ fontSize:'2.5rem' }}>🗺️</div>
        <p style={{ color:'#8b87b0', fontSize:'.87rem', textAlign:'center', maxWidth:230, lineHeight:1.6, padding:'0 1rem' }}>
          Enter a pickup location to see the map
        </p>
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
