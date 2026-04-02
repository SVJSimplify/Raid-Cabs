import { useEffect, useRef, useState } from 'react'
import { loadMapplsSDK, HAS_KEY } from '../lib/mappls'
import { supabase, q } from '../lib/supabase'

const IIT = { lat: 17.5934, lng: 78.1270 }

function svgPin(fill, emoji, size = 42) {
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${fill}" stroke="#fff" stroke-width="2.5"/>
        <text x="${size/2}" y="${size/2 + 5}" font-size="${size * 0.36}" text-anchor="middle">${emoji}</text>
      </svg>`
    ),
    width: size, height: size, offset: [size/2, size/2],
  }
}

function iitPin() {
  return {
    url: 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z"
              fill="#ffb347" stroke="#ff6b35" stroke-width="1.5"/>
        <text x="18" y="25" font-size="14" text-anchor="middle">🎓</text>
      </svg>`
    ),
    width: 36, height: 48, offset: [18, 48],
  }
}

// ─── DriverMap Component ─────────────────────────────────────────────────────
// Shows: driver live GPS, customer pickup, IIT drop, routes
export default function DriverMap({ booking, driverPos, height = 320 }) {
  const divRef  = useRef(null)
  const mapRef  = useRef(null)
  const mkRef   = useRef({})
  const polyRef = useRef([])
  const [ready, setReady] = useState(!!window.mappls)

  useEffect(() => {
    if (!HAS_KEY) return
    loadMapplsSDK().then(ok => setReady(ok))
  }, [])

  useEffect(() => {
    if (!ready || !window.mappls || !divRef.current) return

    const customerPos = booking
      ? { lat: booking.pickup_lat, lng: booking.pickup_lng }
      : null

    const center = driverPos || customerPos || IIT

    // Init map
    if (!mapRef.current) {
      mapRef.current = new window.mappls.Map(divRef.current, {
        center:      [center.lat, center.lng],
        zoom:        14,
        search:      false,
        zoomControl: true,
        location:    false,
      })
    }

    const map = mapRef.current

    // ── Driver marker (green car, live position) ──────────────────────────
    if (driverPos) {
      if (!mkRef.current.driver) {
        mkRef.current.driver = new window.mappls.Marker({
          map,
          position:     { lat: driverPos.lat, lng: driverPos.lng },
          icon:         svgPin('#2ecc71', '🚗', 46),
          popupHtml:    '<div style="font-family:Nunito;font-weight:700;color:#05050e;padding:4px 6px">🚗 You</div>',
          popupOptions: { openPopup: false },
          animate:      300,
        })
      } else {
        mkRef.current.driver.setPosition({ lat: driverPos.lat, lng: driverPos.lng })
      }
    }

    // ── Customer pickup marker (blue, pulsing) ────────────────────────────
    if (customerPos?.lat && customerPos?.lng) {
      if (!mkRef.current.customer) {
        mkRef.current.customer = new window.mappls.Marker({
          map,
          position:     { lat: customerPos.lat, lng: customerPos.lng },
          icon:         svgPin('#3498db', '📍', 44),
          popupHtml:    '<div style="font-family:Nunito;font-weight:700;color:#05050e;padding:4px 6px">📍 Pickup</div>',
          popupOptions: { openPopup: true },
        })
      } else {
        mkRef.current.customer.setPosition({ lat: customerPos.lat, lng: customerPos.lng })
      }
    }

    // ── IIT drop marker (gold) ────────────────────────────────────────────
    if (!mkRef.current.iit) {
      mkRef.current.iit = new window.mappls.Marker({
        map,
        position:     { lat: IIT.lat, lng: IIT.lng },
        icon:         iitPin(),
        popupHtml:    '<div style="font-family:Nunito;font-weight:700;color:#05050e;padding:4px 6px">🎓 IIT Hyderabad</div>',
        popupOptions: { openPopup: false },
      })
    }

    // ── Polylines ─────────────────────────────────────────────────────────
    polyRef.current.forEach(p => { try { p.remove() } catch {} })
    polyRef.current = []

    const pts = []
    if (driverPos)                      pts.push({ lat: driverPos.lat,     lng: driverPos.lng })
    if (customerPos?.lat)               pts.push({ lat: customerPos.lat,    lng: customerPos.lng })
    if (pts.length > 0)                 pts.push({ lat: IIT.lat,            lng: IIT.lng })

    if (pts.length >= 2) {
      // Driver → Customer: dashed blue line
      if (driverPos && customerPos?.lat) {
        polyRef.current.push(new window.mappls.Polyline({
          map,
          path:          [{ lat: driverPos.lat, lng: driverPos.lng }, { lat: customerPos.lat, lng: customerPos.lng }],
          strokeColor:   '#3498db',
          strokeOpacity: 0.75,
          strokeWeight:  4,
          lineGap:       0,
        }))
      }

      // Customer → IIT: solid gold line
      if (customerPos?.lat) {
        polyRef.current.push(new window.mappls.Polyline({
          map,
          path:          [{ lat: customerPos.lat, lng: customerPos.lng }, { lat: IIT.lat, lng: IIT.lng }],
          strokeColor:   '#ffb347',
          strokeOpacity: 0.8,
          strokeWeight:  4,
          lineGap:       0,
          fitbounds:     true,
          fitboundOptions: { padding: 70 },
        }))
      }
    }

  }, [ready, driverPos, booking])

  if (!HAS_KEY) {
    return (
      <div style={{ width:'100%', height, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'.75rem', background:'rgba(14,14,32,.8)', borderRadius:14, border:'1px solid rgba(255,255,255,.07)' }}>
        <div style={{ fontSize:'2.5rem' }}>🗺️</div>
        <p style={{ color:'#504c74', fontSize:'.82rem', textAlign:'center', maxWidth:220, lineHeight:1.6 }}>
          Add <code style={{ color:'#2ecc71' }}>VITE_MAPPLS_KEY</code> to <code>.env</code> for live map
        </p>
      </div>
    )
  }

  return (
    <div style={{ position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.07)', height }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {/* Legend */}
      <div style={{ position:'absolute', top:10, right:10, background:'rgba(5,5,14,.82)', backdropFilter:'blur(10px)', borderRadius:10, padding:'.6rem .85rem', zIndex:20, display:'flex', flexDirection:'column', gap:4 }}>
        {[['#2ecc71','🚗','You'],['#3498db','📍','Pickup'],['#ffb347','🎓','IIT']].map(([c,em,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.72rem', color:'#9890c2' }}>
            <span style={{ fontSize:'.85rem' }}>{em}</span>
            <span style={{ color: c, fontWeight:700 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Mappls badge */}
      <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(5,5,14,.7)', borderRadius:5, padding:'2px 7px', fontSize:'.64rem', color:'#504c74', zIndex:20, pointerEvents:'none' }}>
        Powered by Mappls
      </div>
    </div>
  )
}