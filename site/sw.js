/* Service worker simples: rede primeiro, cache só como reserva offline. Não toca na API. */
// Altere a versão a cada publicação para não manter telas antigas após o deploy.
const CACHE = 'protecextintores-v7';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.ok) { const copy = fresh.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}); }
      return fresh;
    } catch (error) {
      const cached = await caches.match(request) || (request.mode === 'navigate' ? await caches.match('./index.html') : null);
      if (cached) return cached;
      throw error;
    }
  })());
});
