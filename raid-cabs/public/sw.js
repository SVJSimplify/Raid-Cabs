// RaidCabs Service Worker v5
// Simplified: navigation always goes to network, static assets cached
const CACHE = 'raidcabs-v5'
const PRECACHE = ['/offline.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)

  // Only handle GET, same-origin, http/https
  if (req.method !== 'GET') return
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  // Never intercept — let these go straight to network
  const bypass = [
    'supabase.co', 'nominatim.openstreetmap.org',
    'openfreemap.org', 'openstreetmap.org',
    'googleapis.com', 'gstatic.com',
  ]
  if (bypass.some(h => url.hostname.includes(h))) return
  if (url.pathname.startsWith('/api/')) return

  const sameOrigin = url.hostname === self.location.hostname

  // Navigation (page loads) — network first, NO caching of HTML
  // Vercel handles SPA routing server-side via rewrites
  if (req.mode === 'navigate' && sameOrigin) {
    e.respondWith(
      fetch(req).catch(async () => {
        // Only show offline page if network truly fails
        const cached = await caches.match('/offline.html')
        return cached || new Response(
          '<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f0eefc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem"><div style="font-size:3rem">🚖</div><h2>You\'re Offline</h2><p style="color:#8b87b0">Check your connection and try again</p><button onclick="location.reload()" style="padding:.75rem 2rem;background:#f5a623;color:#000;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:1rem">Retry</button></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        )
      })
    )
    return
  }

  // Vite hashed assets (JS/CSS) — cache forever
  if (sameOrigin && url.pathname.match(/\.(js|css)(\?|$)/) && url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then(async cached => {
        if (cached) return cached
        const net     = await fetch(req)
        const clone   = net.clone()
        if (net.ok) caches.open(CACHE).then(c => c.put(req, clone))
        return net
      }).catch(() => new Response('', { status: 503 }))
    )
    return
  }

  // Fonts, icons — cache with network fallback
  if (url.pathname.match(/\.(woff2?|ttf|eot|png|jpg|jpeg|svg|ico|webp)(\?|$)/)) {
    e.respondWith(
      caches.match(req).then(async cached => {
        if (cached) return cached
        try {
          const net   = await fetch(req)
          const clone = net.clone()
          if (net.ok) caches.open(CACHE).then(c => c.put(req, clone))
          return net
        } catch {
          return new Response('', { status: 503 })
        }
      })
    )
    return
  }

  // Everything else — network only
})

// Push notifications
self.addEventListener('push', e => {
  const d = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'RaidCabs', {
      body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png',
      data: { url: d.url || '/' },
    })
  )
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
