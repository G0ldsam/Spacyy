// Appended after every `next build` to ensure push handlers survive the
// Workbox-generated sw.js regeneration (next-pwa customWorkerDir integration).
const fs = require('fs')
const path = require('path')

const swPath = path.join(__dirname, '../public/sw.js')

if (!fs.existsSync(swPath)) {
  console.log('[patch-sw] sw.js not found – skipping')
  process.exit(0)
}

const sw = fs.readFileSync(swPath, 'utf8')

if (sw.includes("addEventListener('push'") || sw.includes('addEventListener("push"')) {
  console.log('[patch-sw] Push handlers already present – nothing to do')
  process.exit(0)
}

const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

const pushHandlers = `
// VAPID key injected at build
self.VAPID_PUBLIC_KEY = '${vapidKey}';

function urlBase64ToUint8Array(base64) {
  var padding = '='.repeat((4 - (base64.length % 4)) % 4);
  var b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(b64);
  var bytes = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function resubscribeToPush() {
  return self.registration.pushManager.getSubscription()
    .then(function(existingSub) {
      if (!existingSub || !self.VAPID_PUBLIC_KEY) return Promise.resolve();
      return existingSub.unsubscribe()
        .then(function() {
          return self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(self.VAPID_PUBLIC_KEY)
          });
        })
        .then(function(newSub) {
          return fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSub.toJSON())
          });
        });
    })
    .catch(function(err) {
      console.error('Resubscribe failed:', err);
    });
}

self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  var title = data.title || 'Spacyy';
  var options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      resubscribeToPush()
    ])
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      var existing = clients.find(function(c) { return c.url === url; });
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
`

fs.writeFileSync(swPath, sw + pushHandlers)
console.log('[patch-sw] Push handlers appended to sw.js')
