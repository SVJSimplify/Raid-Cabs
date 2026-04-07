// LiveMap — Zero dependency map using Mappls Static Tiles + SVG overlay
// No npm packages, no canvas, no workers, no WebGL = works on every browser
// Tiles: Mappls Raster Tile API (img elements)
// Route: SVG polyline
// Markers: Positioned divs with CSS animations

import { useEffect, useRef, useState, useCallback } from 'react'

const KEY = import.meta.env.VITE_MAPPLS_KEY || ''

// ── Tile math ─────────────────────────────────────────────────────────
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom)
  const x = Math.floor((lng + 180) / 360 * n)
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)
  return { x, y }
}

function tileToLatLng(x, y, zoom) {
  const n    = Math.pow(2, zoom)
  const lng  = x / n * 360 - 180
  const latR = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)))
  return { lat: latR * 180 / Math.PI, lng }
}

function latLngToPixel(lat, lng, originTile, zoom, tileSize = 256) {
  const n     = Math.pow(2, zoom)
  const xTile = (lng + 180) / 360 * n
  const yTile = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n
  return {
    x: (xTile - originTile.x) * tileSize,
    y: (yTile - originTile.y) * tileSize,
  }
}

function tileUrl(x, y, z) {
  if (KEY) return `https://apis.mappls.com/advancedmaps/v1/${KEY}/tiles/default/${z}/${x}/${y}.png`
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
}

function haversineKm(a, b) {
  const R    = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const x    = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
}

function getBearing(a, b) {
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1  = a.lat * Math.PI / 180
  const lat2  = b.lat * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

// ── Smart zoom (Rapido-style) ─────────────────────────────────────────
function getSmartZoom(driverPos, userPos, isInRide) {
  if (!driverPos || !userPos) return 13
  const dist = haversineKm(driverPos, userPos)
  if (isInRide)  return 14
  if (dist < 0.5) return 16
  if (dist < 2)   return 15
  if (dist < 5)   return 13
  return 12
}

function getCenter(driverPos, userPos, dropPos, isInRide) {
  if (isInRide && driverPos) return driverPos
  if (driverPos && userPos) {
    return { lat: (driverPos.lat + userPos.lat) / 2, lng: (driverPos.lng + userPos.lng) / 2 }
  }
  if (userPos && dropPos) {
    return { lat: (userPos.lat + dropPos.lat) / 2, lng: (userPos.lng + dropPos.lng) / 2 }
  }
  return driverPos || userPos || dropPos || { lat: 17.5934, lng: 78.127 }
}

// ── Component ─────────────────────────────────────────────────────────
const TILE_SIZE = 256
const GRID      = 5 // 5×5 tile grid

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
  const [zoom,    setZoom]    = useState(13)
  const [center,  setCenter]  = useState(null)
  const [size,    setSize]    = useState({ w: 0, h: 0 })
  const [bearing, setBearing] = useState(0)
  const wrapRef   = useRef(null)
  const prevDrv   = useRef(null)
  const zoomTimer = useRef(null)

  // Measure container
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Smart zoom + center
  useEffect(() => {
    if (zoomTimer.current) clearTimeout(zoomTimer.current)
    zoomTimer.current = setTimeout(() => {
      setZoom(getSmartZoom(driverPos, userPos, isInRide))
      setCenter(getCenter(driverPos, userPos, dropPos, isInRide))
    }, 600)
  }, [driverPos, userPos, dropPos, isInRide])

  // Bearing for car rotation
  useEffect(() => {
    if (driverPos && prevDrv.current) {
      setBearing(getBearing(prevDrv.current, driverPos))
    }
    prevDrv.current = driverPos
  }, [driverPos])

  // ── Compute tile grid ─────────────────────────────────────────────
  const c = center || userPos || driverPos || dropPos || { lat:17.5934, lng:78.127 }
  const originTile = latLngToTile(c.lat, c.lng, zoom)
  const half       = Math.floor(GRID / 2)

  // Pixel offset to center the origin tile in the container
  const offsetX = size.w / 2 - TILE_SIZE / 2
  const offsetY = size.h / 2 - TILE_SIZE / 2

  // Convert lat/lng to pixel position relative to container center
  const toPixel = useCallback((lat, lng) => {
    const px = latLngToPixel(lat, lng, originTile, zoom)
    return { x: px.x + offsetX, y: px.y + offsetY }
  }, [originTile.x, originTile.y, zoom, offsetX, offsetY])

  const userPx   = userPos   ? toPixel(userPos.lat,   userPos.lng)   : null
  const driverPx = driverPos ? toPixel(driverPos.lat, driverPos.lng) : null
  const dropPx   = dropPos   ? toPixel(dropPos.lat,   dropPos.lng)   : null

  // Route path as SVG points
  let routePoints = ''
  if (routeGeo?.coordinates) {
    routePoints = routeGeo.coordinates
      .map(([lng, lat]) => { const p = toPixel(lat, lng); return `${p.x},${p.y}` })
      .join(' ')
  } else if (userPx && dropPx) {
    routePoints = `${userPx.x},${userPx.y} ${dropPx.x},${dropPx.y}`
  }

  // Approach line
  let approachPoints = ''
  if (driverPx && userPx && !isInRide) {
    approachPoints = `${driverPx.x},${driverPx.y} ${userPx.x},${userPx.y}`
  }

  const noPos = !userPos && !driverPos && !dropPos

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.08)', height, background:'#0a0a0f' }}>
      <style>{`
        @keyframes pickpulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.8);opacity:0}}
        @keyframes livepulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        @keyframes carsmooth{0%{transform:translateX(-50%) translateY(-50%)}100%{transform:translateX(-50%) translateY(-50%)}}
        .lm-marker{position:absolute;transform:translateX(-50%) translateY(-50%);transition:left .8s cubic-bezier(.4,0,.2,1),top .8s cubic-bezier(.4,0,.2,1);}
        .lm-car{position:absolute;transform:translateX(-50%) translateY(-50%);transition:left .8s cubic-bezier(.4,0,.2,1),top .8s cubic-bezier(.4,0,.2,1);}
        .lm-dest{position:absolute;transform:translateX(-50%) translateY(-100%);transition:left .8s cubic-bezier(.4,0,.2,1),top .8s cubic-bezier(.4,0,.2,1);}
        .lm-zoom{position:absolute;top:1rem;right:1rem;display:flex;flex-direction:column;gap:4px;z-index:20;}
        .lm-zbtn{width:32px;height:32px;background:#0e0e20;border:1px solid rgba(255,179,71,.2);color:#8b87b0;border-radius:7px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:300;line-height:1;transition:all .15s;}
        .lm-zbtn:hover{background:#1a1a2e;color:#f5a623;}
        .lm-attr{position:absolute;bottom:4px;right:6px;font-size:9px;color:#504c74;z-index:20;background:rgba(5,5,14,.7);padding:1px 5px;border-radius:4px;}
        .lm-attr a{color:#504c74;text-decoration:none;}
      `}</style>

      {/* Tile grid */}
      <div ref={wrapRef} style={{ position:'absolute', inset:0, overflow:'hidden' }}>
        {size.w > 0 && Array.from({ length: GRID }, (_, row) =>
          Array.from({ length: GRID }, (_, col) => {
            const tx  = originTile.x - half + col
            const ty  = originTile.y - half + row
            const px  = (col - half) * TILE_SIZE + offsetX
            const py  = (row - half) * TILE_SIZE + offsetY
            return (
              <img key={`${tx}-${ty}`}
                src={tileUrl(tx, ty, zoom)}
                style={{ position:'absolute', left:px, top:py, width:TILE_SIZE, height:TILE_SIZE, imageRendering:'auto', userSelect:'none', pointerEvents:'none' }}
                draggable={false}
                onError={e => e.target.style.opacity = '0'}
              />
            )
          })
        )}

        {/* SVG route overlay */}
        {size.w > 0 && (
          <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
            {/* Approach: driver → pickup */}
            {approachPoints && (
              <>
                <polyline points={approachPoints} fill="none" stroke="rgba(59,130,246,.6)" strokeWidth="4" strokeDasharray="10 8" strokeLinecap="round"/>
              </>
            )}
            {/* Route: pickup → drop */}
            {routePoints && (
              <>
                <polyline points={routePoints} fill="none" stroke="rgba(245,166,35,.25)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points={routePoints} fill="none" stroke="#f5a623" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              </>
            )}
          </svg>
        )}

        {/* Pickup marker — pulsing blue */}
        {userPx && (
          <div className="lm-marker" style={{ left:userPx.x, top:userPx.y, zIndex:10 }}>
            <div style={{ position:'relative', width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(59,130,246,.2)', animation:'pickpulse 1.8s ease-out infinite' }}/>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(59,130,246,.1)', animation:'pickpulse 1.8s ease-out infinite .6s' }}/>
              <div style={{ width:22, height:22, borderRadius:'50%', background:'#3b82f6', border:'3px solid #fff', boxShadow:'0 2px 14px rgba(59,130,246,.7)', position:'relative', zIndex:1 }}/>
            </div>
            {adminMode && <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', marginTop:4, background:'rgba(59,130,246,.9)', color:'#fff', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, whiteSpace:'nowrap' }}>Passenger</div>}
          </div>
        )}

        {/* Car marker — smooth + rotating */}
        {driverPx && (
          <div className="lm-car" style={{ left:driverPx.x, top:driverPx.y, zIndex:15 }}>
            <div style={{ width:48, height:48, transform:`rotate(${bearing}deg)`, transition:'transform .6s cubic-bezier(.4,0,.2,1)', filter:'drop-shadow(0 4px 14px rgba(0,0,0,.6))' }}>
              <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="23" fill="#22c55e" stroke="rgba(255,255,255,.95)" strokeWidth="2.5"/>
                <rect x="14" y="20" width="20" height="11" rx="3.5" fill="#0a0a0f"/>
                <rect x="17" y="15" width="14" height="8" rx="2.5" fill="#0a0a0f"/>
                <rect x="18" y="15.5" width="12" height="6" rx="2" fill="rgba(34,197,94,.5)"/>
                <circle cx="17.5" cy="32" r="3" fill="#0a0a0f"/>
                <circle cx="30.5" cy="32" r="3" fill="#0a0a0f"/>
                <circle cx="13" cy="24" r="1.8" fill="#f5a623" opacity=".95"/>
              </svg>
            </div>
            {adminMode && <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', marginTop:4, background:'rgba(34,197,94,.9)', color:'#0a0a0f', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:99, whiteSpace:'nowrap' }}>Driver (Live)</div>}
          </div>
        )}

        {/* Destination marker */}
        {dropPx && (
          <div className="lm-dest" style={{ left:dropPx.x, top:dropPx.y, zIndex:10 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'#f5a623', border:'2.5px solid rgba(255,255,255,.95)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 3px 16px rgba(245,166,35,.6),0 0 0 5px rgba(245,166,35,.15)' }}>🏁</div>
              <div style={{ background:'#f5a623', color:'#0a0a0f', fontSize:'9.5px', fontWeight:800, padding:'2px 8px', borderRadius:99, marginTop:4, whiteSpace:'nowrap', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', boxShadow:'0 2px 8px rgba(0,0,0,.4)' }}>
                {(dropPos?.label || 'Destination').slice(0, 16)}
              </div>
              <div style={{ width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'6px solid #f5a623', marginTop:-1 }}/>
            </div>
          </div>
        )}

        {/* No position placeholder */}
        {noPos && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem' }}>
            <div style={{ fontSize:'2.5rem' }}>🗺️</div>
            <p style={{ color:'#8b87b0', fontSize:'.85rem', textAlign:'center', maxWidth:230, lineHeight:1.6 }}>
              Enter a pickup location to see the map
            </p>
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="lm-zoom">
        <button className="lm-zbtn" onClick={() => setZoom(z => Math.min(z+1, 18))}>+</button>
        <button className="lm-zbtn" onClick={() => setZoom(z => Math.max(z-1, 5))}>−</button>
      </div>

      {/* Live GPS chip */}
      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.92)', backdropFilter:'blur(14px)', border:'1px solid rgba(255,255,255,.12)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:7, zIndex:30, whiteSpace:'nowrap' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'livepulse 1.4s infinite', display:'inline-block' }}/>
          {liveLabel}
        </div>
      )}

      {/* Admin legend */}
      {adminMode && (driverPos || userPos) && (
        <div style={{ position:'absolute', top:'1rem', left:'1rem', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'.55rem .85rem', zIndex:30, display:'flex', flexDirection:'column', gap:5 }}>
          {driverPos && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#22c55e', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Driver (Live)</span></div>}
          {userPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#3b82f6', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Passenger</span></div>}
          {dropPos   && <div style={{ fontSize:'.73rem', display:'flex', alignItems:'center', gap:6 }}><span style={{ background:'#f5a623', borderRadius:'50%', width:9, height:9, display:'inline-block' }}/><span style={{ color:'#f0eefc', fontWeight:600 }}>Destination</span></div>}
        </div>
      )}

      {/* Attribution */}
      <div className="lm-attr">
        {KEY ? <><a href="https://mappls.com" target="_blank" rel="noreferrer">© Mappls</a> © OSM</> : <><a href="https://openstreetmap.org" target="_blank" rel="noreferrer">© OpenStreetMap</a></>}
      </div>
    </div>
  )
}
