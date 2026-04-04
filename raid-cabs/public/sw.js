// RaidCabs Service Worker v4 — all bugs fixed
const CACHE = 'raidcabs-v4'
const SHELL = ['/', '/index.html', '/offline.html']

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)

  // Only handle GET
  if (req.method !== 'GET') return

  // Never intercept external APIs or non-http
  if (url.hostname.includes('supabase.co'))    return
  if (url.pathname.startsWith('/api/'))        return
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return
  if (url.hostname.includes('nominatim'))      return
  if (url.hostname.includes('openfreemap'))    return
  if (url.hostname.includes('openstreetmap'))  return
  if (url.hostname.includes('tiles'))          return

  e.respondWith(handleFetch(req, url))
})

async function handleFetch(req, url) {
  const sameOrigin = url.hostname === self.location.hostname

  // ── SPA navigation: always serve index.html ───────────────────────────────
  if (req.mode === 'navigate' && sameOrigin) {
    try {
      const net = await fetch(req)
      if (net.ok) {
        const cache = await caches.open(CACHE)
        // Clone BEFORE reading or returning — fixes "body already used"
        await cache.put('/', net.clone())
      }
      return net
    } catch {
      const cached = await caches.match('/') || await caches.match('/index.html')
      if (cached) return cached
      return caches.match('/offline.html').then(r =>
        r || new Response('<h1>Offline</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } })
      )
    }
  }

  // ── Vite build assets (hashed names — cache forever) ─────────────────────
  if (sameOrigin && url.pathname.match(/\.(js|css|woff2?|ttf)(\?|$)/)) {
    const cached = await caches.match(req)
    if (cached) return cached

    try {
      const net = await fetch(req)
      if (net.ok) {
        const toCache = net.clone() // clone FIRST before any .body access
        const cache   = await caches.open(CACHE)
        await cache.put(req, toCache)
      }
      return net
    } catch {
      return new Response('', { status: 503 })
    }
  }

  // ── Images ────────────────────────────────────────────────────────────────
  if (sameOrigin && url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)(\?|$)/)) {
    const cached = await caches.match(req)
    if (cached) return cached
    try {
      const net     = await fetch(req)
      const toCache = net.clone()
      if (net.ok) {
        const cache = await caches.open(CACHE)
        cache.put(req, toCache) // background — no await
      }
      return net
    } catch {
      return new Response('', { status: 503 })
    }
  }

  // ── Default: network only ─────────────────────────────────────────────────
  try {
    return await fetch(req)
  } catch {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

// ── Push ───────────────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const d = e.data?.json() || {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'RaidCabs', {
      body:  d.body || '',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: d.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
