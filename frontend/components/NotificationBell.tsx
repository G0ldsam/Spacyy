'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUnread(data.filter((n: any) => !n.read).length)
        }
      })
      .catch(() => {})
  }, [pathname])

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      aria-label="Notifications"
    >
      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
