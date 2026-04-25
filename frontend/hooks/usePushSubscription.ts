'use client'

import { useState, useEffect } from 'react'

type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

function swReady(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // getRegistration() resolves immediately with the current SW (if any),
    // avoiding the long wait that serviceWorker.ready can cause.
    navigator.serviceWorker.getRegistration('/').then(async (reg) => {
      if (reg) {
        const sub = await reg.pushManager.getSubscription().catch(() => null)
        setState(sub ? 'subscribed' : 'unsubscribed')
        return
      }
      // No registration yet — fall back to waiting (e.g. first install)
      const readyReg = await swReady()
      // If still no SW after timeout, push is not available in this environment
      if (!readyReg) { setState('unsupported'); return }
      const sub = await readyReg.pushManager.getSubscription().catch(() => null)
      setState(sub ? 'subscribed' : 'unsubscribed')
    }).catch(() => setState('unsupported'))
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      // Request permission first if not yet granted
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
      const reg = await swReady(8000)
      if (!reg) {
        setState('unsubscribed')
        throw new Error('Service worker not ready. Try reloading the page.')
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setState('subscribed')
    } catch (err) {
      if (Notification.permission === 'denied') {
        setState('denied')
      } else {
        setState('unsubscribed')
      }
      throw err
    }
  }

  async function unsubscribe() {
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
  }

  return { state, subscribe, unsubscribe }
}
