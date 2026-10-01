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

// 2. Configuración pública de Firebase del proyecto
const firebaseConfig = {
  apiKey: "AIzaSyDP1lZt0Tox16p-JhQuNe6acQC4CnjBqLs",
  authDomain: "expenses-home.firebaseapp.com",
  projectId: "expenses-home",
  storageBucket: "expenses-home.firebasestorage.app",
  messagingSenderId: "917054655548",
  appId: "1:917054655548:web:17fd4a6c4b66dba98a4739",
  measurementId: "G-0KE4S739VH"
};

// 3. Inicialización oficial de Firebase en el Service Worker
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// 4. Manejador oficial de mensajes en segundo plano de Firebase (Campañas de Firebase Console y Push API)
messaging.onBackgroundMessage((payload) => {
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
});

// 5. Manejo del clic sobre la notificación (apertura o enfoque de pestaña)
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
