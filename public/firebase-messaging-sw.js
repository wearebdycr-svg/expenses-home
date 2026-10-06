// Service Worker oficial para Firebase Cloud Messaging (FCM) y Web Push
// Compatible con Desktop (Chrome, Edge, Firefox, Safari) y Mobile (Android, iOS PWA)

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// 1. Forzar activación inmediata para que las actualizaciones se apliquen sin cerrar el navegador
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 2. Extraer configuración dinámica sin exponer claves estáticas en el repositorio
function getFirebaseConfig() {
  try {
    const params = new URLSearchParams(self.location.search);
    const apiKey = params.get('apiKey');
    const projectId = params.get('projectId');
    if (apiKey && projectId) {
      return {
        apiKey,
        authDomain: params.get('authDomain') || '',
        projectId,
        storageBucket: params.get('storageBucket') || '',
        messagingSenderId: params.get('messagingSenderId') || '',
        appId: params.get('appId') || '',
        measurementId: params.get('measurementId') || '',
      };
    }
  } catch (err) {
    console.warn('[firebase-messaging-sw] No se pudieron leer parámetros de URL:', err);
  }
  return null;
}

function handleBackgroundMessage(payload) {
  console.log('[firebase-messaging-sw] Notificación recibida desde Firebase:', payload);
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
}

function initFirebase(config) {
  if (config && config.apiKey && typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
      firebase.initializeApp(config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage(handleBackgroundMessage);
    } catch (e) {
      console.warn('[firebase-messaging-sw] Inicialización diferida de Firebase:', e);
    }
  }
}

// Inicializar si la configuración viene en los parámetros de la URL de registro
const initialConfig = getFirebaseConfig();
if (initialConfig) {
  initFirebase(initialConfig);
}

// También permitir inicialización a través de postMessage desde la aplicación cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE_MESSAGING' && event.data.config) {
    initFirebase(event.data.config);
  }
});

// 3. Manejo del clic sobre la notificación (apertura o enfoque de pestaña)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickAction =
    event.notification.data?.click_action ||
    event.notification.data?.url ||
    '/#gastos';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          if ('navigate' in client && clickAction) {
            client.navigate(clickAction);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
