'use client'

import { usePushSubscription } from '@/hooks/usePushSubscription'

export default function PushSubscribeButton() {
  const { state, subscribe, unsubscribe } = usePushSubscription()

  if (state === 'unsupported' || state === 'loading') return null

  if (state === 'denied') {
    return (
      <p className="text-xs text-gray-400">
        Notifications blocked. Enable them in browser settings.
      </p>
    )
  }

  if (state === 'subscribed') {
    return (
      <button
        onClick={unsubscribe}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
        Notifications on
      </button>
    )
  }

  return (
    <button
      onClick={subscribe}
      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      Enable notifications
    </button>
  )
}
