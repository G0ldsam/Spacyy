'use client'

import { useEffect, useState } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

const STORAGE_KEY = 'push-prompt-dismissed'

export default function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false)
  const { state, subscribe } = usePushSubscription()

  useEffect(() => {
    if (state === 'loading' || state === 'unsupported' || state === 'subscribed' || state === 'denied') return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [state])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  async function handleEnable() {
    try {
      await subscribe()
    } catch {
      // subscribe() already updates state; ignore here
    }
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#8B1538] rounded-full flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">Enable notifications</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Get notified about bookings, available spots, and membership reminders.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                className="flex-1 bg-[#8B1538] text-white text-sm font-medium py-1.5 rounded-lg hover:bg-[#6d1029] transition-colors"
              >
                Enable
              </button>
              <button
                onClick={dismiss}
                className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
