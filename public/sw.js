const CACHE_NAME = 'vault-v7';
const STATIC_ASSETS = [
    '/',
    '/app.html',
    '/css/style.css',
    '/js/api.js',
    '/js/auth.js',
    '/js/app.js',
    '/js/push.js',
    '/js/payments.js',
    '/js/onboarding.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-http schemes (chrome-extension, etc.)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

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

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
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
