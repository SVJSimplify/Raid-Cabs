// RaidCabs Service Worker v9 — Offline-first

const VERSION      = 'raidcabs-v9'
const STATIC_CACHE = `${VERSION}-static`

const APP_SHELL = ['/', '/login', '/driver', '/manifest.json', '/logo.png', '/icon-192.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return

  // Always network for these
  const bypass = ['supabase.co','firebase','googleapis.com','gstatic.com','opencagedata.com','mappls.com','nominatim']
  if (bypass.some(h => url.hostname.includes(h))) return
  if (url.pathname.startsWith('/api/')) return

  // JS/CSS — network first (never cache stale bundles)
  if (url.pathname.match(/\.(js|css)(\?|$)/)) {
    e.respondWith(
      fetch(request).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(request, clone)) }
        return res
      }).catch(() => caches.match(request))
    )
    return
  }

  // Images — cache first, update in background
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)(\?|$)/)) {
    e.respondWith(
      caches.match(request).then(cached => {
        const net = fetch(request).then(res => {
          if (res.ok) { const clone = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(request, clone)) }
          return res
        }).catch(() => null)
        return cached || net
      })
    )
    return
  }

  // Navigation — network first, SPA fallback, offline page
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(STATIC_CACHE).then(c => c.put(request, clone)) }
        return res
      }).catch(async () => {
        return await caches.match('/') || new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html' } })
      })
    )
  }
})

self.addEventListener('push', e => {
  const d = e.data?.json() || {}
  e.waitUntil(self.registration.showNotification(d.title || 'RaidCabs', {
    body: d.body || 'You have an update.', icon: '/icon-192.png', badge: '/icon-192.png',
    data: { url: d.url || '/' }
  }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})

const OFFLINE_PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>RaidCabs — Offline</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;background:#05050e;color:#ede8d8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1.25rem;padding:2rem;text-align:center}.ring{width:72px;height:72px;border-radius:50%;border:2px solid rgba(245,166,35,.3);background:rgba(245,166,35,.07);display:flex;align-items:center;justify-content:center;animation:pulse 2s ease-in-out infinite}@keyframes pulse{0%,100%{transform:scale(.96);opacity:.7}50%{transform:scale(1);opacity:1}}h1{font-size:1.4rem;font-weight:800}p{color:#8b87b0;max-width:280px;line-height:1.7;font-size:.88rem}button{padding:.8rem 2rem;background:linear-gradient(135deg,#f5a623,#ff6b2b);color:#05050e;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.9rem}</style></head><body><div class="ring"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="1.5" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></div><h1>You're Offline</h1><p>Connect to Wi-Fi or mobile data to use RaidCabs.</p><button onclick="location.reload()">Try Again</button></body></html>`
