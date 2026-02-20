self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const title = data.title || 'Ново известие';
            const options = {
                body: data.body || '',
                icon: data.icon || '/pwa-192x192.png',
                badge: data.badge || '/pwa-192x192.png',
                data: {
                    url: data.url || '/'
                }
            };

            event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
            console.error('Push event parsing error:', e);
        }
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const urlToOpen = event.notification.data.url;

    if (urlToOpen) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
        );
    }
});
