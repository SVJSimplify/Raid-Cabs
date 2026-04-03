// RaidCabs Service Worker — PWA offline support
const CACHE = 'raidcabs-v1'
const OFFLINE_PAGE = '/offline.html'

// Cache these on install
const PRECACHE = [
  '/',
  '/offline.html',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET, API calls, and Supabase
  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return
  if (url.pathname.startsWith('/api/')) return

  e.respondWith(
    fetch(request)
      .then(res => {
        // Cache HTML pages
        if (res.ok && (url.pathname === '/' || request.headers.get('accept')?.includes('text/html'))) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(() => {
        // Offline fallback
        return caches.match(request) || caches.match(OFFLINE_PAGE)
      })
  )
})

// Background sync for offline bookings (future)
self.addEventListener('sync', e => {
  if (e.tag === 'sync-bookings') {
    console.log('[SW] Background sync triggered')
  }
})

// Push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  self.registration.showNotification(data.title || 'RaidCabs', {
    body:  data.body || 'You have a new update',
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    data:  { url: data.url || '/' },
  })
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'))
})
