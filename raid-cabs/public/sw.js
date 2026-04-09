// RaidCabs Service Worker - PASSTHROUGH MODE
// All requests go directly to network - no caching of JS files ever
// This prevents stale bundle issues

const CACHE_NAME = 'raidcabs-v8'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Let EVERYTHING through to the network - no caching at all
// Simple and reliable - avoids stale JS bundle issues completely
self.addEventListener('fetch', e => {
  // Only handle navigation offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          '<!DOCTYPE html><html><body style="background:#0a0a0f;color:#f0eefc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:1rem"><div style="font-size:3rem">🚖</div><h2>You\'re Offline</h2><button onclick="location.reload()" style="padding:.75rem 2rem;background:#f5a623;color:#000;border:none;border-radius:10px;font-weight:700;cursor:pointer">Retry</button></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        )
      )
    )
  }
  // Everything else: no interception, browser handles it normally
})
