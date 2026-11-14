'use strict';

// App shell only. Departure data comes from a cross-origin POST, which this worker never
// touches, so live data is never cached.
//
// - Built files under /assets/ have content hashes in their names and never change, so they are
//   served cache-first. That keeps the app opening even when the first request after the phone
//   wakes up fails.
// - Everything else (index.html, icons, manifest) is fetched network-first, so a new deploy shows
//   up on the next open, and falls back to the cache when offline.
// - Every path ends in a real Response. Returning nothing makes the browser fail the request,
//   which for the app's script means a blank page.
const CACHE_NAME = 'havag-next-shell-v2';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        url.pathname.includes('/assets/') ? cacheFirst(event.request) : networkFirst(event.request)
    );
});
