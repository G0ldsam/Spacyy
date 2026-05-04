'use client'

import { useState } from 'react'
import { useNotifyOne, useNotifyInterestList } from '@/hooks/useBookingsData'

interface Entry {
  id: string
  client: { name: string; email: string }
  notifiedAt: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  sessionName: string
  themeColor: string
  startTime: string
  endTime: string
  date: string
  sessionId: string
  timeSlotId: string
  entries: Entry[]
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function WaitlistNotifyModal({
  open,
  onClose,
  sessionName,
  themeColor,
  startTime,
  endTime,
  date,
  sessionId,
  timeSlotId,
  entries: initialEntries,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)
  const [notifyingAll, setNotifyingAll] = useState(false)

  const notifyOneMutation = useNotifyOne()
  const notifyAllMutation = useNotifyInterestList()

  const unnotified = entries.filter((e) => !e.notifiedAt)
  const hasUnnotified = unnotified.length > 0

  const handleNotifyOne = async (entry: Entry) => {
    if (entry.notifiedAt) return
    setNotifyingId(entry.id)
    try {
      await notifyOneMutation.mutateAsync(entry.id)
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, notifiedAt: new Date().toISOString() } : e))
      )
    } catch {
      alert('Failed to send notification')
    } finally {
      setNotifyingId(null)
    }
  }

  const handleNotifyAll = async () => {
    setNotifyingAll(true)
    try {
      await notifyAllMutation.mutateAsync({ sessionId, timeSlotId, date })
      const now = new Date().toISOString()
      setEntries((prev) => prev.map((e) => ({ ...e, notifiedAt: e.notifiedAt ?? now })))
    } catch {
      alert('Failed to send notifications')
    } finally {
      setNotifyingAll(false)
    }
  }

  if (!open) return null

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[70] transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[80] bg-white rounded-2xl shadow-2xl max-w-md mx-auto overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: themeColor }}
              />
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                  Spot opened
                </p>
                <h2 className="font-bold text-gray-900 text-base leading-tight">{sessionName}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {displayDate} · {formatTime(startTime)} – {formatTime(endTime)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {hasUnnotified && (
            <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{unnotified.length}</span>{' '}
                {unnotified.length === 1 ? 'person is' : 'people are'} waiting for this slot.
              </p>
            </div>
          )}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No one on the waitlist.</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.client.name}</p>
                  <p className="text-xs text-gray-500 truncate">{entry.client.email}</p>
                </div>

                {entry.notifiedAt ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium shrink-0">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Notified
                  </span>
                ) : (
                  <button
                    onClick={() => handleNotifyOne(entry)}
                    disabled={notifyingId === entry.id || notifyingAll}
                    className="px-3 py-1.5 rounded-lg bg-[#8B1538] text-white text-xs font-semibold hover:bg-[#721230] disabled:opacity-50 transition-colors shrink-0"
                  >
                    {notifyingId === entry.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : 'Notify'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Skip
          </button>
          {hasUnnotified && (
            <button
              onClick={handleNotifyAll}
              disabled={notifyingAll || notifyingId !== null}
              className="flex-1 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#721230] disabled:opacity-50 transition-colors"
            >
              {notifyingAll ? 'Sending…' : `Notify all (${unnotified.length})`}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
