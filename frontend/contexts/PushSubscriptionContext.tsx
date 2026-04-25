'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

interface PushSubscriptionContextType {
  state: PushState
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

const PushSubscriptionContext = createContext<PushSubscriptionContextType | null>(null)

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function swReady(timeoutMs = 8000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

export function PushSubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (
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

    let active = true

    async function checkSubscription(reg: ServiceWorkerRegistration) {
      const sub = await reg.pushManager.getSubscription().catch(() => null)
      if (active) setState(sub ? 'subscribed' : 'unsubscribed')
    }

    navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => {
        if (!active) return
        if (reg) {
          checkSubscription(reg)
          return
        }
        setState('unsubscribed')
        navigator.serviceWorker.ready
          .then((readyReg) => {
            if (active) checkSubscription(readyReg)
          })
          .catch(() => {})
      })
      .catch(() => {
        if (active) setState('unsubscribed')
      })

    return () => {
      active = false
    }
  }, [])

  const subscribe = useCallback(async () => {
    setState('loading')
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setState('denied')
          return
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setState('unsubscribed')
        throw new Error('Push notifications are not configured on this server')
      }

      const reg = await swReady(10000)
      if (!reg) {
        setState('unsubscribed')
        throw new Error('Service worker not ready — try reloading the page')
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
      if (!res.ok) throw new Error('Failed to save subscription on server')

      setState('subscribed')
    } catch (err) {
      setState(Notification.permission === 'denied' ? 'denied' : 'unsubscribed')
      throw err
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setState('loading')
    try {
      const reg = await swReady()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (err) {
      setState('unsubscribed')
      throw err
    }
  }, [])

  return (
    <PushSubscriptionContext.Provider value={{ state, subscribe, unsubscribe }}>
      {children}
    </PushSubscriptionContext.Provider>
  )
}

export function usePushSubscription() {
  const ctx = useContext(PushSubscriptionContext)
  if (!ctx) throw new Error('usePushSubscription must be used within PushSubscriptionProvider')
  return ctx
}
