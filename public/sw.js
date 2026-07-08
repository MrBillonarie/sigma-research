const CACHE = 'sigma-v1'
const OFFLINE_URL = '/offline'

// Archivos estáticos a cachear al instalar
const PRECACHE = [
  OFFLINE_URL,
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Eliminar caches viejos
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // Solo interceptar navegación (no fetch de APIs ni assets)
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then(r => r ?? Response.error())
    )
  )
})

// ── Web Push (recordatorio diario FIRE, 2026-07-08) ──────────────────────────
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { /* ignore */ }
  const title = payload.title || 'SquantDesk'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/api/icon/192',
      badge: '/api/icon/192',
      data: { url: payload.url || '/fire' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/fire'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
