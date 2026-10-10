// Kill-switch: removes the old offline worker that caused blank screens on iPhone.
// Deletes only this app's own cache, reloads open windows, then unregisters itself.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter((n) => n.startsWith('wahub-')).map((n) => caches.delete(n)),
        );
        await self.clients.claim();
        const wins = await self.clients.matchAll({ type: 'window' });
        await Promise.allSettled(wins.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
