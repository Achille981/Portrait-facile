const CACHE = 'portrait-facile-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('portrait-facile-') && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached
      try {
        const response = await fetch(event.request)
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone()
          await (await caches.open(CACHE)).put(event.request, copy)
        }
        return response
      } catch {
        if (event.request.mode === 'navigate') return caches.match('/index.html')
        throw new Error('Ressource indisponible hors ligne')
      }
    }),
  )
})