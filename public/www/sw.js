const CACHE_NAME = 'vault-v9';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-http schemes
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // API: network only
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'Offline' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    // Everything else: network first, fallback to cache
    event.respondWith(
        fetch(event.request).then(response => {
            // Cache a copy for offline use
            if (response.ok && event.request.method === 'GET') {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
        }).catch(() => {
            return caches.match(event.request).then(cached => {
                if (cached) return cached;
                if (event.request.mode === 'navigate') {
                    return caches.match('/app.html');
                }
                return new Response('', { status: 504 });
            });
        })
    );
});

self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : { title: 'Vault', body: 'Проверьте ваши вещи' };
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/assets/images/icon-192.png',
            badge: '/assets/images/icon-192.png',
            data: data.url || '/app.html'
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes('/app.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(event.notification.data || '/app.html');
        })
    );
});
