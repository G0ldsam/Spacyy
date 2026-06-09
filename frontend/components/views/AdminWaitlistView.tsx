'use client'

import { useState } from 'react'
import { useAdminInterestList, useNotifyOne, useNotifyInterestList, useDeleteInterestEntry, type AdminWaitlistGroup } from '@/hooks/useBookingsData'

interface Props {
  onBack?: () => void
}

type Filter = 'all' | 'unnotified'

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()

  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, tomorrow)) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function SlotCard({ group }: { group: AdminWaitlistGroup }) {
  const [expanded, setExpanded] = useState(false)
  const [localEntries, setLocalEntries] = useState(group.entries)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)
  const [notifyingAll, setNotifyingAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const notifyOneMutation = useNotifyOne()
  const notifyAllMutation = useNotifyInterestList()
  const deleteEntryMutation = useDeleteInterestEntry()

  const unnotified = localEntries.filter((e) => !e.notifiedAt)

  const handleNotifyOne = async (entryId: string) => {
    setNotifyingId(entryId)
    try {
      await notifyOneMutation.mutateAsync(entryId)
      const now = new Date().toISOString()
      setLocalEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, notifiedAt: now } : e)))
    } catch {
      alert('Failed to send notification')
    } finally {
      setNotifyingId(null)
    }
  }

  const handleNotifyAll = async () => {
    setNotifyingAll(true)
    try {
      await notifyAllMutation.mutateAsync({
        sessionId: group.sessionId,
        timeSlotId: group.timeSlotId,
        date: group.date,
      })
      const now = new Date().toISOString()
      setLocalEntries((prev) => prev.map((e) => ({ ...e, notifiedAt: e.notifiedAt ?? now })))
    } catch {
      alert('Failed to send notifications')
    } finally {
      setNotifyingAll(false)
    }
  }

  const handleDelete = async (entryId: string) => {
    if (!confirm('Remove this client from the waitlist?')) return
    setDeletingId(entryId)
    try {
      await deleteEntryMutation.mutateAsync(entryId)
      setLocalEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch {
      alert('Failed to remove entry')
    } finally {
      setDeletingId(null)
    }
  }

  const allNotified = unnotified.length === 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Slot header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-stretch text-left"
      >
        {/* Color bar */}
        <div className="w-1.5 shrink-0" style={{ backgroundColor: group.themeColor }} />

        <div className="flex-1 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-sm truncate">{group.sessionName}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatTime(group.startTime)} – {formatTime(group.endTime)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Counts */}
              {unnotified.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                  {unnotified.length} waiting
                </span>
              )}
              {localEntries.length - unnotified.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  {localEntries.length - unnotified.length} notified
                </span>
              )}
              {/* Chevron */}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Notify all bar */}
          {!allNotified && (
            <div className="px-4 py-3 bg-amber-50 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{unnotified.length}</span> unnotified
              </p>
              <button
                onClick={handleNotifyAll}
                disabled={notifyingAll || notifyingId !== null}
                className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark disabled:opacity-50 transition-colors"
              >
                {notifyingAll ? 'Sending…' : `Notify all (${unnotified.length})`}
              </button>
            </div>
          )}

          {/* Client list */}
          <div className="px-4 py-2 space-y-0 divide-y divide-gray-50">
            {localEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.client.name}</p>
                  <p className="text-xs text-gray-500 truncate">{entry.client.email}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {entry.notifiedAt ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Notified
                    </span>
                  ) : (
                    <button
                      onClick={() => handleNotifyOne(entry.id)}
                      disabled={notifyingId === entry.id || notifyingAll || deletingId === entry.id}
                      className="px-3 py-1.5 rounded-lg border border-brand text-brand text-xs font-semibold hover:bg-brand hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {notifyingId === entry.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : 'Notify'}
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id || notifyingId === entry.id || notifyingAll}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    title="Remove from waitlist"
                  >
                    {deletingId === entry.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminWaitlistView({ onBack }: Props) {
  const { data: groups = [], isLoading } = useAdminInterestList()
  const [filter, setFilter] = useState<Filter>('unnotified')

  const filtered = filter === 'unnotified' ? groups.filter((g) => g.unnotifiedCount > 0) : groups

  // Group by date
  const byDate: Record<string, AdminWaitlistGroup[]> = {}
  filtered.forEach((g) => {
    if (!byDate[g.date]) byDate[g.date] = []
    byDate[g.date].push(g)
  })
  const dateKeys = Object.keys(byDate)

  const totalUnnotified = groups.reduce((sum, g) => sum + g.unnotifiedCount, 0)

  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Waitlist</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {isLoading
                  ? 'Loading…'
                  : totalUnnotified > 0
                  ? `${totalUnnotified} client${totalUnnotified !== 1 ? 's' : ''} waiting to be notified`
                  : 'All clients notified'}
              </p>
            </div>
            {totalUnnotified > 0 && (
              <span className="w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {totalUnnotified > 99 ? '99+' : totalUnnotified}
              </span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {([['unnotified', 'Needs notification'], ['all', 'All']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filter === val
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {val === 'unnotified' && totalUnnotified > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {totalUnnotified}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand/30 rounded-full animate-spin" style={{ borderTopColor: 'var(--brand-primary)' }} />
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 mb-1">
              {filter === 'unnotified' ? 'All clients notified' : 'No waitlist entries'}
            </p>
            <p className="text-sm text-gray-500">
              {filter === 'unnotified'
                ? 'Switch to "All" to see notified entries.'
                : 'Clients will appear here when they join a full session.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {dateLabel(dateKey)}
                  </h2>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">
                    {byDate[dateKey].reduce((s, g) => s + g.entries.length, 0)} total
                  </span>
                </div>
                <div className="space-y-3">
                  {byDate[dateKey].map((group) => (
                    <SlotCard key={`${group.sessionId}|${group.timeSlotId}|${group.date}`} group={group} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
