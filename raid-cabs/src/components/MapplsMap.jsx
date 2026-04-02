import { useEffect, useRef, useState } from 'react'
import { loadMapplsSDK, markers, HAS_KEY } from '../lib/mappls'

const IIT = { lat: 17.5934, lng: 78.1270, name: 'IIT Hyderabad' }

export default function MapplsMap({
  userPos,
  driverPos   = null,
  showIIT     = true,
  zoom        = 12,
  height      = 430,
  liveLabel   = null,
}) {
  const divRef  = useRef(null)
  const mapRef  = useRef(null)
  const mkRef   = useRef({})
  const polyRef = useRef(null)
  const [ready, setReady] = useState(!!window.mappls)

  // Load SDK once
  useEffect(() => {
    if (!HAS_KEY) return
    loadMapplsSDK().then(ok => setReady(ok))
  }, [])

  // Init or update map
  useEffect(() => {
    if (!ready || !window.mappls || !divRef.current || !userPos) return

    // Create map on first call
    if (!mapRef.current) {
      mapRef.current = new window.mappls.Map(divRef.current, {
        center:      [userPos.lat, userPos.lng],
        zoom,
        search:      false,
        zoomControl: true,
        location:    false,
        fullscreen:  false,
      })
    }

    const map = mapRef.current

    // ── User marker ────────────────────────────────────────────────────────
    const userIcon = markers.user()
    if (!mkRef.current.user) {
      mkRef.current.user = new window.mappls.Marker({
        map,
        position:   { lat: userPos.lat, lng: userPos.lng },
        icon:       userIcon,
        popupHtml:  '<div style="font-family:Nunito;font-weight:700;color:#05050e;padding:4px 6px">📍 Pickup Point</div>',
        popupOptions: { openPopup: false },
      })
    } else {
      mkRef.current.user.setPosition({ lat: userPos.lat, lng: userPos.lng })
    }

    // ── IIT marker ─────────────────────────────────────────────────────────
    if (showIIT && !mkRef.current.iit) {
      mkRef.current.iit = new window.mappls.Marker({
        map,
        position:   { lat: IIT.lat, lng: IIT.lng },
        icon:       markers.iit(),
        popupHtml:  '<div style="font-family:Nunito;font-weight:700;color:#05050e;padding:4px 6px">🎓 IIT Hyderabad</div>',
        popupOptions: { openPopup: true },
      })
    }

    // ── Driver marker ──────────────────────────────────────────────────────
    if (driverPos) {
      const driverIcon = markers.driver()
      if (!mkRef.current.driver) {
        mkRef.current.driver = new window.mappls.Marker({
          map,
          position:   { lat: driverPos.lat, lng: driverPos.lng },
          icon:       driverIcon,
          popupHtml:  '<div style="font-family:Nunito;font-weight:700;color:#05050e;padding:4px 6px">🚗 Your Driver</div>',
          popupOptions: { openPopup: false },
          animate:    350,
        })
      } else {
        mkRef.current.driver.setPosition({ lat: driverPos.lat, lng: driverPos.lng })
      }
    }

    // ── Route polyline ─────────────────────────────────────────────────────
    if (polyRef.current) {
      try { polyRef.current.remove() } catch {}
    }
    const dest = showIIT ? { lat: IIT.lat, lng: IIT.lng } : null
    if (dest) {
      polyRef.current = new window.mappls.Polyline({
        map,
        path: [
          { lat: userPos.lat, lng: userPos.lng },
          { lat: dest.lat,    lng: dest.lng    },
        ],
        strokeColor:   '#ffb347',
        strokeOpacity: 0.88,
        strokeWeight:  5,
        lineGap:       0,
        fitbounds:     true,
        fitboundOptions: { padding: 85 },
      })
    }
  }, [ready, userPos, driverPos, showIIT, zoom])

  // No key — show placeholder
  if (!HAS_KEY) {
    return (
      <div style={{ width:'100%', height, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'1rem', background:'var(--card)', borderRadius:'var(--r)', border:'1px solid var(--b1)' }}>
        <div style={{ fontSize:'3.5rem' }}>🗺️</div>
        <p style={{ color:'var(--ts)', fontSize:'.9rem', textAlign:'center', maxWidth:260, lineHeight:1.65 }}>
          Add <code style={{ color:'var(--gold)', background:'rgba(255,179,71,.1)', padding:'2px 7px', borderRadius:5 }}>VITE_MAPPLS_KEY</code> to your <code>.env</code> file for live maps.
        </p>
        <a href="https://auth.mappls.com/console/" target="_blank" rel="noreferrer"
          className="btn btn-outline btn-sm" style={{ marginTop:4 }}>
          Get Free Key →
        </a>
      </div>
    )
  }

  return (
    <div className="map-box" style={{ height, position:'relative', overflow:'hidden' }}>
      <div ref={divRef} style={{ width:'100%', height:'100%' }}/>

      {/* Live driver chip */}
      {liveLabel && (
        <div style={{ position:'absolute', bottom:'1rem', left:'50%', transform:'translateX(-50%)', background:'rgba(5,5,14,.88)', backdropFilter:'blur(12px)', border:'1px solid var(--b1)', borderRadius:99, padding:'.42rem 1.1rem', fontSize:'.8rem', display:'inline-flex', alignItems:'center', gap:6, zIndex:20, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.5)' }}>
          <span className="dot" style={{ width:7, height:7 }}/> {liveLabel}
        </div>
      )}

      {/* Mappls watermark */}
      <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(5,5,14,.7)', borderRadius:5, padding:'2px 7px', fontSize:'.65rem', color:'var(--tm)', zIndex:20, pointerEvents:'none' }}>
        Powered by Mappls
      </div>
    </div>
  )
}
