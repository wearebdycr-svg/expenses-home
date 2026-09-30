// Service Worker para Firebase Cloud Messaging (FCM) y Web Push en segundo plano
// Compatible con Android, iOS 16.4+ (PWA) y Desktop (Windows/macOS/Linux)

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// 1. Inicialización inmediata al arrancar el Service Worker desde los parámetros de URL
try {
  const urlParams = new URLSearchParams(self.location.search);
  const apiKey = urlParams.get('apiKey');
  const projectId = urlParams.get('projectId');
  const messagingSenderId = urlParams.get('messagingSenderId');
  const appId = urlParams.get('appId');

  if (apiKey && projectId) {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey,
        authDomain: `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
        messagingSenderId,
        appId,
      });
    }

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw] Mensaje en segundo plano recibido desde Firebase:', payload);
      const title = payload.notification?.title || payload.data?.title || 'FinanzasHogar';
      const options = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: payload.notification?.icon || payload.data?.icon || '/favicon.svg',
        badge: '/favicon.svg',
        data: payload.data || {},
        vibrate: [200, 100, 200],
        tag: payload.data?.category_id ? `budget-${payload.data.category_id}` : 'finanzas-hogar',
      };

      return self.registration.showNotification(title, options);
    });
  }
} catch (e) {
  console.warn('[firebase-messaging-sw] Inicialización por URL params falló:', e);
}

// 2. Escuchar mensaje del hilo principal con la configuración de Firebase como respaldo
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE_MESSAGING') {
    try {
      if (!firebase.apps.length && event.data.config) {
        firebase.initializeApp(event.data.config);
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
          console.log('[firebase-messaging-sw] Mensaje en segundo plano recibido:', payload);
          const title = payload.notification?.title || payload.data?.title || 'FinanzasHogar';
          const options = {
            body: payload.notification?.body || payload.data?.body || '',
            icon: payload.notification?.icon || payload.data?.icon || '/favicon.svg',
            badge: '/favicon.svg',
            data: payload.data || {},
            vibrate: [200, 100, 200],
            tag: payload.data?.category_id ? `budget-${payload.data.category_id}` : 'finanzas-hogar',
          };

          return self.registration.showNotification(title, options);
        });
      }
    } catch (e) {
      console.warn('[firebase-messaging-sw] Error al inicializar messaging en SW por postMessage:', e);
    }
  }
});

// Listener nativo de Push para máxima compatibilidad (incluido iOS Safari PWA)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.notification?.title || payload.data?.title || 'FinanzasHogar';
    const body = payload.notification?.body || payload.data?.body || '';
    const icon = payload.notification?.icon || payload.data?.icon || '/favicon.svg';

    const options = {
      body,
      icon,
      badge: '/favicon.svg',
      data: payload.data || {},
      vibrate: [200, 100, 200],
      tag: payload.data?.category_id ? `budget-${payload.data.category_id}` : 'finanzas-hogar',
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Si no es JSON plano, mostrar texto recibido
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('FinanzasHogar', {
        body: text,
        icon: '/favicon.svg',
      })
    );
  }
});

// Manejo del clic sobre la notificación (Criterio 3.2: Redirección al destino)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickAction =
    event.notification.data?.click_action ||
    event.notification.data?.url ||
    '/#categoria';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Si ya hay una ventana abierta de la app, enfocarla y navegar a la sección
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          if ('navigate' in client && clickAction) {
            client.navigate(clickAction);
          }
          return client.focus();
        }
      }
      // 2. Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
