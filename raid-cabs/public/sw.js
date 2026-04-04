// RaidCabs Service Worker v3
// SPA-aware: caches index.html shell, serves it for all navigation

const CACHE     = 'raidcabs-v3'
const APP_SHELL = '/'   // index.html — the React app entry point

// ── Install: cache the app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll([APP_SHELL, '/offline.html']))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] install cache failed:', err))
  )
})

// ── Activate: clear old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET
  if (request.method !== 'GET') return

  // Skip: Supabase, our API functions, browser extensions, external CDNs
  if (
    url.hostname.includes('supabase.co')  ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')  ||
    url.pathname.startsWith('/api/')       ||
    url.protocol === 'chrome-extension:'
  ) return

  // ── SPA Navigation (HTML pages) ──────────────────────────────────────────
  // For ANY navigation request (/, /dashboard, /history, /book etc.)
  // → Try network first, fall back to cached app shell
  // This is correct for React Router SPAs — the shell handles all routes
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Cache successful responses for the root
          if (res.ok && url.pathname === '/') {
            caches.open(CACHE).then(c => c.put(request, res.clone()))
          }
          return res
        })
        .catch(async () => {
          // Offline: serve cached shell so React Router still works
          const shell = await caches.match(APP_SHELL)
          if (shell) return shell
          const offline = await caches.match('/offline.html')
          if (offline) return offline
          return new Response('<h1>Offline</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
          })
        })
    )
    return
  }

  // ── Static assets (JS, CSS, images, fonts) ────────────────────────────────
  // Cache-first: serve from cache, update in background
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|webp|woff2?|ttf)(\?|$)/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          if (res.ok) {
            caches.open(CACHE).then(c => c.put(request, res.clone()))
          }
          return res
        }).catch(() => cached || new Response('', { status: 503 }))
        return cached || networkFetch
      })
    )
    return
  }

  // ── Everything else: network only ─────────────────────────────────────────
  // (Don't intercept — let it go straight to network)
})

// ── Push Notifications ────────────────────────────────────────────────────
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
