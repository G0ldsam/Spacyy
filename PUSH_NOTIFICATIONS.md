# Push Notifications — Implementation Guide

## Overview

Spacyy uses **Web Push API** for cross-platform notifications. Implementation is **account-bound** (not device-bound), meaning:

- ✅ Users can receive notifications on **multiple devices** (phone, tablet, laptop)
- ✅ Each device subscription is stored per-user in the database
- ✅ Subscriptions automatically refresh to prevent expiration
- ✅ Works on installed PWA + standalone browser sessions

---

## Architecture

### Components

| Component | Purpose |
|-----------|---------|
| `PushSubscriptionContext.tsx` | React context — manages subscription state, permissions |
| `worker/index.js` | Service worker source — handles push/click events |
| `scripts/patch-sw.js` | Build script — injects push handlers into Workbox SW |
| `lib/push.ts` | Server-side — sends push via `web-push` library |
| `lib/notify.ts` | Server-side — creates DB notification + triggers push |
| `api/push/subscribe` | API route — saves/deletes subscriptions |
| `PushSubscription` model | Prisma — stores endpoint + encryption keys per user |

### Data Flow

```
┌─────────────┐    1. Subscribe    ┌──────────────┐
│   Browser   │ ──────────────────> │ Push Service │
│             │                     │ (FCM/etc.)   │
└─────────────┘                     └──────────────┘
       │                                    │
       │ 2. PushSubscription                │
       │    (endpoint, keys)                │
       ▼                                    │
┌─────────────┐                             │
│   Spacyy    │                             │
│   Server    │                             │
└─────────────┘                             │
       │                                    │
       │ 3. Send push message               │
       │    (VAPID signed)                  │
       └────────────────────────────────────┘
                                            │
                                            │ 4. Deliver
                                            ▼
                                   ┌─────────────┐
                                   │   Browser   │
                                   │ Service     │
                                   │ Worker      │
                                   └─────────────┘
```

---

## Database Schema

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique  // Device-specific push service URL
  p256dh    String             // Encryption key
  auth      String             // Auth secret
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- **One user, many subscriptions** — phone, laptop, tablet all stored separately
- **Unique endpoint** — prevents duplicate subscriptions per device
- **Cascade delete** — removing user deletes all their subscriptions

---

## How It Works

### 1. Subscription Process

**Client-side (`PushSubscriptionContext.tsx`):**

1. Check browser support (`serviceWorker`, `PushManager`, `Notification`)
2. Request `Notification.requestPermission()`
3. Wait for service worker ready (`navigator.serviceWorker.ready`)
4. Call `pushManager.subscribe()` with VAPID public key
5. Send `PushSubscription` JSON to `/api/push/subscribe`

**Server-side (`api/push/subscribe/route.ts`):**

```ts
await prisma.pushSubscription.upsert({
  where: { endpoint: subscription.endpoint },
  update: { p256dh, auth },
  create: { userId, endpoint, p256dh, auth }
})
```

### 2. Sending Push Messages

**Server (`lib/push.ts`):**

```ts
import webpush from 'web-push'

webpush.setVapidDetails(
  `mailto:${SMTP_FROM}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

export async function sendPushToUser(userId, { title, body, url }) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url })
        )
      } catch (err) {
        // Auto-cleanup expired subscriptions (410/404 status)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        }
      }
    })
  )
}
```

### 3. Receiving Push Messages

**Service Worker (`public/sw.js` — injected by `patch-sw.js`):**

```js
self.addEventListener('push', (event) => {
  const data = event.data.json()
  
  event.waitUntil(
    Promise.all([
      // Show notification
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        data: { url: data.url }
      }),
      
      // Refresh subscription to prevent expiration
      resubscribeToPush()
    ])
  )
})
```

### 4. Preventing Expiration

**Problem:** Browsers auto-expire subscriptions that haven't received push for ~60 days.

**Solution:** Re-subscribe on **every push received**:

```js
async function resubscribeToPush() {
  const existingSub = await self.registration.pushManager.getSubscription()
  if (!existingSub) return
  
  await existingSub.unsubscribe()
  const newSub = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(self.VAPID_PUBLIC_KEY)
  })
  
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newSub.toJSON())
  })
}
```

This ensures:
- ✅ Active users never lose subscriptions
- ✅ Inactive users (no push for months) naturally expire
- ✅ Endpoint stays fresh (some push services rotate URLs)

---

## Android-Specific Issues & Solutions

### Why Android Push Fails

| Issue | Cause | Fix |
|-------|-------|-----|
| **Service worker timeout** | Android Chrome aggressive battery saving | Prompt to install PWA first (less restrictive) |
| **Permission revoked at OS level** | User blocked in system Settings → Apps | Show Android-specific instructions |
| **Subscription expired** | No push received for 60+ days | Auto-refresh on every push (implemented) |
| **Not installed as PWA** | Standalone browser has stricter background limits | Prompt "Add to Home screen" before enabling push |

### Detection & UX Improvements

**Added in `PushSubscriptionContext.tsx`:**

```ts
const isAndroid = /Android/i.test(navigator.userAgent)
const isPWAInstalled = window.matchMedia('(display-mode: standalone)').matches
```

**Usage in `SettingsSidebar.tsx`:**

```tsx
{isAndroid && !isPWAInstalled && state === 'unsubscribed' && (
  <div className="bg-blue-50 rounded-lg p-3 mb-3">
    <p className="text-xs text-gray-900 font-medium mb-1">📱 Install the app first</p>
    <p className="text-xs text-gray-600">
      For reliable notifications on Android, install Spacyy to your home screen: 
      tap browser menu → "Add to Home screen"
    </p>
  </div>
)}
```

**Android permission blocked:**

```tsx
{state === 'denied' && (
  <div className="bg-red-50 rounded-lg p-3">
    <p className="text-sm text-gray-900 font-medium mb-1">Notifications blocked</p>
    <p className="text-xs text-gray-600 mb-2">{contextError}</p>
    {isAndroid && (
      <p className="text-xs text-gray-500 italic">
        💡 Android: Settings → Apps → Browser → Notifications
      </p>
    )}
  </div>
)}
```

---

## Best Practices (Now Implemented)

### ✅ 1. Account-Bound Subscriptions
- Multiple devices per user supported
- Each device has unique `endpoint` in DB
- Server sends push to **all** active subscriptions

### ✅ 2. Auto-Expiration Prevention
- Re-subscribe on every push received
- Prevents 60-day inactive expiration
- Keeps endpoint fresh

### ✅ 3. Contextual Permission Request
- Never request permission on page load
- Show explanation before asking (Settings sidebar)
- For Android: prompt PWA install first

### ✅ 4. Graceful Error Handling
- Detect permission denial
- Show platform-specific instructions (Android vs iOS)
- Auto-cleanup expired subscriptions (410/404)

### ✅ 5. PWA Installation Detection
- Check `display-mode: standalone`
- Prompt Android users to install before enabling push
- More reliable background service worker

---

## Testing

### Local Development

1. **Generate VAPID keys** (one-time):
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Add to `.env.local`:**
   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY="BPqF0xH..."
   VAPID_PRIVATE_KEY="ljW9nym..."
   ```

3. **Build & run:**
   ```bash
   npm run build  # Injects push handlers
   npm run dev
   ```

4. **Test subscription:**
   - Open Settings sidebar
   - Enable push notifications
   - Check browser DevTools → Application → Service Workers

5. **Send test push:**
   ```bash
   curl -X POST http://localhost:3000/api/push/test \
     -H "Content-Type: application/json" \
     -d '{"title": "Test", "body": "Hello", "url": "/dashboard"}'
   ```

### Production Checklist

- ✅ HTTPS enabled (required for push)
- ✅ Service worker registered at `/sw.js`
- ✅ VAPID keys in production env
- ✅ Manifest includes `icons` (192px, 512px)
- ✅ Notification permission requested only after user action

---

## Debugging

### Check Subscription Status

**Client-side:**
```js
navigator.serviceWorker.ready.then(reg =>
  reg.pushManager.getSubscription().then(sub =>
    console.log('Subscription:', sub ? sub.toJSON() : 'None')
  )
)
```

**Server-side:**
```sql
SELECT * FROM "PushSubscription" WHERE "userId" = 'cuid_here';
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Registration failed` | SW not found at `/sw.js` | Run `npm run build` |
| `Push not supported` | HTTP (not HTTPS) | Use HTTPS or localhost |
| `Invalid VAPID key` | Mismatch public/private | Regenerate keys, update env |
| `410 Gone` | Subscription expired | Auto-deleted, user must re-subscribe |
| `Permission denied` | User clicked "Block" | Must unblock in browser settings |

---

## Security

### VAPID Keys
- **Public key** — embedded in client JS (safe)
- **Private key** — server-only, never expose (signs push requests)

### Endpoint Security
- Endpoint URLs are unguessable (long random tokens)
- Only server with matching private key can send to endpoint
- Push service validates VAPID signature

### Data Encryption
- All push payloads encrypted with `p256dh` + `auth` keys
- Push service cannot read message content
- Only target browser can decrypt

---

## Future Improvements

### 1. Batch Notifications
Instead of sending individually, batch by time:
```ts
// lib/push.ts
export async function scheduleBatchPush(userId, payload, sendAt: Date) {
  // Queue in DB, send via cron job
}
```

### 2. Notification Preferences
Let users choose which events trigger push:
```prisma
model PushSubscription {
  // ...existing fields
  preferences Json? // { bookingConfirmed: true, sessionCancelled: false }
}
```

### 3. Rich Notifications
Add actions (e.g., "View Booking", "Cancel"):
```js
self.registration.showNotification(title, {
  body,
  actions: [
    { action: 'view', title: 'View' },
    { action: 'cancel', title: 'Cancel' }
  ]
})
```

### 4. Analytics
Track delivery/click rates:
```ts
await prisma.notification.update({
  where: { id },
  data: { deliveredAt: new Date() }
})
```

---

## Resources

- [Web Push Protocol Spec](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Spec](https://datatracker.ietf.org/doc/html/rfc8292)
- [web.dev Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [web-push library (Node.js)](https://github.com/web-push-libs/web-push)

---

## Summary

### What Changed (Latest Improvements)

1. **Auto-refresh subscriptions** — prevents 60-day expiration
2. **Android PWA install prompt** — better reliability
3. **Platform-specific error messages** — clearer instructions
4. **Context-aware permission UX** — no intrusive popups

### Why It's Account-Bound (Not Device-Bound)

- User table → one-to-many → PushSubscription table
- Same user can have 5 devices = 5 subscriptions
- Server sends push to **all subscriptions** for that user
- Each subscription linked by `userId` foreign key

### Why Android May Fail

1. **Service worker not ready** — aggressive battery saving
2. **Permissions blocked at OS level** — requires Settings → Apps fix
3. **Subscription expired** — no push for 60+ days (now auto-fixed)
4. **PWA not installed** — browser mode has stricter limits

All issues now have detection + user-friendly error messages.
