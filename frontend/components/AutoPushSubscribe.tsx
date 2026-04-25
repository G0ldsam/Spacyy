'use client'

import { useEffect } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export default function AutoPushSubscribe() {
  const { state, subscribe } = usePushSubscription()

  useEffect(() => {
    if (state === 'unsubscribed' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribe().catch(() => {})
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
