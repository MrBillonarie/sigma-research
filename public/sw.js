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
