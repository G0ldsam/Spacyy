'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

type PushState = 'loading' | 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed'

interface PushContextValue {
  state: PushState
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  isAndroid: boolean
  isPWAInstalled: boolean
  error: string | null
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

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ])
}

async function getActiveSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    // Explicitly register in case next-pwa auto-registration hasn't fired yet
    await navigator.serviceWorker.register('/sw.js').catch(() => {})
    return await withTimeout(
      navigator.serviceWorker.ready,
      8000,
      'Service worker did not activate in time.'
    )
  } catch {
    return null
  }
}

export function PushSubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PushState>('loading')
  const [error, setError] = useState<string | null>(null)
  
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
  const isPWAInstalled = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )

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

    async function detectState() {
      const reg = await getActiveSW()
      if (!mounted) return
      if (!reg) {
        // SW unavailable — still render toggle so user sees a helpful message
        setState('unsubscribed')
        return
      }
      const sub = await reg.pushManager.getSubscription().catch(() => null)
      if (mounted) setState(sub ? 'subscribed' : 'unsubscribed')
    }

    detectState()
    return () => { mounted = false }
  }, [])

  const subscribe = useCallback(async () => {
    setState('loading')
    setError(null)
    try {
      if (Notification.permission === 'denied') {
        const msg = isAndroid 
          ? 'Notifications blocked. Go to Settings → Apps → Browser → Notifications and enable them.'
          : 'Notifications blocked. Check your browser settings to allow notifications.'
        setError(msg)
        setState('denied')
        return
      }

      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission()
        if (result !== 'granted') {
          setState('denied')
          setError('Permission denied. You can change this in browser settings.')
          return
        }
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setState('unsubscribed')
        throw new Error('Push notifications are not configured. Contact support.')
      }

      const reg = await getActiveSW()
      if (!reg) {
        setState('unsubscribed')
        const msg = isAndroid && !isPWAInstalled
          ? 'Service worker unavailable. Try installing the app to your home screen first (tap browser menu → Add to Home screen).'
          : 'Service worker not ready — reload the page and try again.'
        setError(msg)
        throw new Error(msg)
      }

      // pushManager.subscribe makes a network call to the push service; cap it.
      const sub = await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }),
        15000,
        'Subscription timed out — check your connection and try again.'
      )

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error('Failed to save subscription. Try again.')

      setState('subscribed')
      setError(null)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errMsg)
      setState(
        typeof Notification !== 'undefined' && Notification.permission === 'denied'
          ? 'denied'
          : 'unsubscribed'
      )
      throw err
    }
  }, [isAndroid, isPWAInstalled])

  const unsubscribe = useCallback(async () => {
    setState('loading')
    try {
      const reg = await getActiveSW()
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
    <PushContext.Provider value={{ state, subscribe, unsubscribe, isAndroid, isPWAInstalled, error }}>
      {children}
    </PushContext.Provider>
  )
}

export function usePushSubscription(): PushContextValue {
  const ctx = useContext(PushContext)
  if (!ctx) throw new Error('usePushSubscription must be used within PushSubscriptionProvider')
  return ctx
}
