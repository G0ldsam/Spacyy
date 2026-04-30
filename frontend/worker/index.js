function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function resubscribeToPush() {
  try {
    const existingSub = await self.registration.pushManager.getSubscription()
    if (!existingSub) return

    // Get VAPID key from environment (injected at build)
    const vapidKey = self.VAPID_PUBLIC_KEY
    if (!vapidKey) return

    // Unsubscribe and resubscribe to refresh expiration
    await existingSub.unsubscribe()
    const newSub = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    // Update server with new subscription
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSub.toJSON()),
    })
  } catch (err) {
    console.error('Resubscribe failed:', err)
  }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {}

  const title = data.title || 'Spacyy'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      resubscribeToPush(), // Refresh subscription to prevent expiration
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === url)
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      })
  )
})
