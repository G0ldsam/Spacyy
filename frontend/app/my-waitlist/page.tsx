'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageSpinner } from '@/components/ui/spinner'
import { useLanguage } from '@/contexts/LanguageContext'

interface WaitlistEntry {
  id: string
  date: string
  notifiedAt: string | null
  session: {
    id: string
    name: string
    themeColor: string
  }
  timeSlot: {
    id: string
    startTime: string
    endTime: string
  }
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = Number.parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

function isTomorrow(dateStr: string) {
  const d = new Date(dateStr)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  )
}

function dateLabel(dateStr: string) {
  if (isToday(dateStr)) return 'Today'
  if (isTomorrow(dateStr)) return 'Tomorrow'
  return formatDate(dateStr)
}

export default function MyWaitlistPage() {
  const { status } = useSession()
  const router = useRouter()
  const { t } = useLanguage()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/interest/my')
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch (err) {
      console.error('Error fetching waitlist:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchEntries()
    }
  }, [status, router, fetchEntries])

  const handleRemove = async (id: string) => {
    setRemoving(id)
    try {
      const res = await fetch(`/api/interest/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id))
      }
    } catch (err) {
      console.error('Error removing from waitlist:', err)
    } finally {
      setRemoving(null)
    }
  }

  if (status === 'loading' || loading) return <PageSpinner />

  // Group entries by date
  const grouped: Record<string, WaitlistEntry[]> = {}
  entries.forEach((e) => {
    const key = e.date.split('T')[0]
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(e)
  })
  const dateKeys = Object.keys(grouped)

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="mobile-container">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('my_waitlist.back')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('my_waitlist.title')}</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">{t('my_waitlist.subtitle')}</p>
          </div>

          {/* Content */}
          {dateKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              {/* Empty state illustration */}
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold text-lg mb-2">{t('my_waitlist.empty_title')}</p>
              <p className="text-gray-500 text-sm mb-6 max-w-xs">{t('my_waitlist.empty_desc')}</p>
              <Link
                href="/book"
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-dark transition-colors"
              >
                {t('my_waitlist.browse')}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {dateKeys.map((dateKey) => (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {dateLabel(dateKey)}
                    </h2>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  <div className="space-y-3">
                    {grouped[dateKey].map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                      >
                        <div className="flex items-stretch">
                          {/* Color accent bar */}
                          <div
                            className="w-1.5 shrink-0"
                            style={{ backgroundColor: entry.session.themeColor || 'var(--brand-primary)' }}
                          />

                          <div className="flex-1 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900 text-base leading-tight truncate">
                                  {entry.session.name}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                  {formatTime(entry.timeSlot.startTime)} – {formatTime(entry.timeSlot.endTime)}
                                </p>
                              </div>

                              {/* Status badge */}
                              <div className="shrink-0">
                                {entry.notifiedAt ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {t('my_waitlist.notified')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    {t('my_waitlist.waiting')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Notified info */}
                            {entry.notifiedAt && (
                              <p className="text-xs text-gray-400 mt-2">
                                {t('my_waitlist.notified_on', {
                                  date: new Date(entry.notifiedAt).toLocaleDateString('en-US', {
                                    timeZone: 'UTC',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }),
                                })}
                              </p>
                            )}
                          </div>

                          {/* Remove button */}
                          <div className="flex items-center pr-3">
                            <button
                              onClick={() => handleRemove(entry.id)}
                              disabled={removing === entry.id}
                              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                              aria-label={t('my_waitlist.remove')}
                            >
                              {removing === entry.id ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Info banner */}
              <div className="rounded-2xl bg-gray-100 px-4 py-4 flex gap-3">
                <svg className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-600">{t('my_waitlist.info')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
