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

const pushHandlers = `
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
  event.waitUntil(self.registration.showNotification(title, options));
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
