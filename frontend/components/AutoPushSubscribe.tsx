'use client'

import { useEffect } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

// sessionStorage key set when the user explicitly unsubscribes via Settings
export const PUSH_OPT_OUT_KEY = 'push-user-unsubscribed'

export default function AutoPushSubscribe() {
  const { state, subscribe } = usePushSubscription()

  useEffect(() => {
    if (
      state === 'unsubscribed' &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      sessionStorage.getItem(PUSH_OPT_OUT_KEY) !== '1'
    ) {
      subscribe().catch(() => {})
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
