'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

type PushState = 'loading' | 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed'

interface PushContextValue {
  state: PushState
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

const PushContext = createContext<PushContextValue | null>(null)

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function getSwReg(timeoutMs = 10000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

export function PushSubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported')
      return
    }

    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }

    let mounted = true

    // Use serviceWorker.ready directly — avoids the race of getRegistration()
    // returning undefined before the SW has activated.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (mounted) setState(sub ? 'subscribed' : 'unsubscribed')
      })
      .catch(() => {
        if (mounted) setState('unsubscribed')
      })

    return () => {
      mounted = false
    }
  }, [])

  const subscribe = useCallback(async () => {
    setState('loading')
    try {
      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }

      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          setState('denied')
          return
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setState('unsubscribed')
        throw new Error('Push notifications are not configured on this server.')
      }

      const reg = await getSwReg()
      if (!reg) {
        setState('unsubscribed')
        throw new Error('Service worker not ready — try reloading the page.')
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error('Failed to save subscription on server.')

      setState('subscribed')
    } catch (err) {
      setState(
        typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? 'denied'
          : 'unsubscribed'
      )
      throw err
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setState('loading')
    try {
      const reg = await getSwReg()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
    } finally {
      setState('unsubscribed')
    }
  }, [])

  return (
    <PushContext.Provider value={{ state, subscribe, unsubscribe }}>
      {children}
    </PushContext.Provider>
  )
}

export function usePushSubscription(): PushContextValue {
  const ctx = useContext(PushContext)
  if (!ctx) throw new Error('usePushSubscription must be used within PushSubscriptionProvider')
  return ctx
}
