/* Gammbler Push Notification Service Worker */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/images/logo-icon.png',
      badge: data.badge || '/images/logo-icon.png',
      data: data.data || {},
      vibrate: [100, 50, 100],
      tag: data.data?.type || 'gammbler-notification',
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Gammbler', options)
    );
  } catch {
    // fallback for non-JSON payloads
    event.waitUntil(
      self.registration.showNotification('Gammbler', {
        body: event.data.text(),
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
