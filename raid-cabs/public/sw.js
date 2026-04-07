// RaidCabs Service Worker v7
// v7: aggressive cache clear to fix persistent "Illegal constructor" error in Edge
const CACHE = 'raidcabs-v7'
const PRECACHE = ['/offline.html']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()) // activate immediately
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    // Delete ALL old caches, not just ones with wrong name
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k)))) // delete everything
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to reload to get fresh JS bundle
        self.clients.matchAll({ type:'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type:'CACHE_CLEARED' }))
        })
      })
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)

  if (req.method !== 'GET') return
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  const bypass = [
    'supabase.co', 'nominatim.openstreetmap.org',
    'openstreetmap.org', 'googleapis.com',
    'gstatic.com', 'mappls.com', 'firebase',
  ]
  if (bypass.some(h => url.hostname.includes(h))) return
  if (url.pathname.startsWith('/api/')) return

  // JS/CSS assets — network first, NEVER serve stale cached JS
  // This prevents the "old bundle served from cache" problem
  if (url.pathname.match(/\.(js|css)(\?|$)/)) {
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    )
    return
  }

  // Navigation — network always
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/offline.html')
        return cached || new Response(
          '<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f0eefc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem"><div style="font-size:3rem">🚖</div><h2>You\'re Offline</h2><button onclick="location.reload()" style="padding:.75rem 2rem;background:#f5a623;color:#000;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:1rem">Retry</button></body></html>',
          { status:200, headers:{'Content-Type':'text/html'} }
        )
      })
    )
    return
  }

  // Images/fonts — cache with network fallback
  if (url.pathname.match(/\.(woff2?|ttf|png|jpg|jpeg|svg|ico|webp)(\?|$)/)) {
    e.respondWith(
      caches.match(req).then(async cached => {
        if (cached) return cached
        try {
          const net = await fetch(req)
          if (net.ok) caches.open(CACHE).then(c => c.put(req, net.clone()))
          return net
        } catch { return new Response('', { status:503 }) }
      })
    )
    return
  }
})

self.addEventListener('push', e => {
  const d = e.data?.json() || {}
  e.waitUntil(self.registration.showNotification(d.title||'RaidCabs', {
    body:d.body||'', icon:'/icon-192.png', badge:'/icon-192.png',
    data:{ url:d.url||'/' }
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url||'/'))
})
