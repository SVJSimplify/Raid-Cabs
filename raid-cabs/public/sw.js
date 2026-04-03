// RaidCabs Service Worker
const CACHE_NAME  = 'raidcabs-v2'
const SHELL_URLS  = ['/', '/offline.html']

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Never intercept: Supabase API, our /api/ functions, browser extensions
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.protocol === 'chrome-extension:'
  ) return

  event.respondWith(handleFetch(request, url))
})

async function handleFetch(request, url) {
  // ── Network-first for navigation (HTML pages) ────────────────────────────
  if (request.mode === 'navigate') {
    try {
      const networkResponse = await fetch(request)
      // Cache successful navigation responses
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    } catch {
      // Offline — try cache, then offline page
      const cached = await caches.match(request)
      if (cached) return cached
      const offline = await caches.match('/offline.html')
      if (offline) return offline
      // Last resort — return a proper Response, never undefined
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    }
  }

  // ── Cache-first for static assets (JS, CSS, images, fonts) ──────────────
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/) ||
    url.hostname !== self.location.hostname
  ) {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const networkResponse = await fetch(request)
      if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    } catch {
      // Static asset unavailable offline — return empty 503
      return new Response('', { status: 503 })
    }
  }

  // ── Default: network only (API calls, dynamic data) ─────────────────────
  try {
    return await fetch(request)
  } catch {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

// ── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'RaidCabs', {
      body:  data.body || 'You have an update',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'))
})
