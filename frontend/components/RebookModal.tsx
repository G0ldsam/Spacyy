'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Suggestion {
  id: string
  sessionId: string
  sessionName: string
  themeColor: string
  startTime: string
  endTime: string
  availableSlots: number
  isAvailable: boolean
  unavailableReason?: string
}

interface RebookData {
  suggestions: Suggestion[]
  clientSessionAllowance: number | null
  activeBookingsCount: number
}

interface RebookModalProps {
  onClose: () => void
  onBooked: () => void
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('el-GR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RebookModal({ onClose, onBooked }: RebookModalProps) {
  const [data, setData] = useState<RebookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [booking, setBooking] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/bookings/last-month')
      .then((r) => r.json())
      .then((d: RebookData) => {
        setData(d)
        const preSelected = new Set(
          d.suggestions.filter((s) => s.isAvailable).map((s) => s.id)
        )
        setSelected(preSelected)
      })
      .catch(() => setError('Failed to load suggestions'))
      .finally(() => setLoading(false))
  }, [])

  const slotsRemaining =
    data?.clientSessionAllowance !== null && data?.clientSessionAllowance !== undefined
      ? data.clientSessionAllowance - (data.activeBookingsCount ?? 0)
      : null

  const maxSelectable =
    slotsRemaining !== null
      ? slotsRemaining
      : (data?.suggestions.filter((s) => s.isAvailable).length ?? 0)

  function toggle(id: string, isAvailable: boolean) {
    if (!isAvailable) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (slotsRemaining !== null && next.size >= maxSelectable) return prev
        next.add(id)
      }
      return next
    })
  }

  async function handleBook() {
    if (!data || selected.size === 0) return
    setBooking(true)
    setError('')

    const toBook = data.suggestions.filter((s) => selected.has(s.id))

    try {
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookings: toBook.map((s) => ({
            sessionId: s.sessionId,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to book sessions')
      }

      setDone(true)
      setTimeout(() => {
        onBooked()
        onClose()
      }, 1800)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBooking(false)
    }
  }

  const availableCount = data?.suggestions.filter((s) => s.isAvailable).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="px-6 pt-4 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Book Again This Month?</h2>
              <p className="text-sm text-gray-500 mt-0.5">Same sessions as last month</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-1 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Slot progress bar */}
          {!loading && data && slotsRemaining !== null && maxSelectable > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">Sessions selected</span>
                <span className="text-xs font-semibold text-gray-800">
                  {selected.size} / {maxSelectable} available
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-[#8B1538] h-2 rounded-full transition-all duration-300"
                  style={{ width: maxSelectable > 0 ? `${Math.min(100, (selected.size / maxSelectable) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#8B1538] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && error && !done && (
            <div className="py-10 text-center">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && availableCount === 0 && !done && (
            <div className="py-10 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No sessions available to rebook this month.</p>
            </div>
          )}

          {done && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900">Sessions booked!</p>
              <p className="text-sm text-gray-500 mt-1">You're all set for this month.</p>
            </div>
          )}

          {!done && !loading && !error && data && data.suggestions.length > 0 && (
            <div className="space-y-2 pb-2">
              {data.suggestions.map((s) => {
                const isSelected = selected.has(s.id)
                const atLimit = slotsRemaining !== null && selected.size >= maxSelectable && !isSelected
                const isDisabled = !s.isAvailable || atLimit

                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id, s.isAvailable)}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    className={[
                      'w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-150 text-left min-h-[64px]',
                      isSelected
                        ? 'border-[#8B1538] bg-[#8B1538]/5'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98]',
                    ].join(' ')}
                  >
                    {/* Session color dot */}
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: s.themeColor }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${isSelected ? 'text-[#8B1538]' : 'text-gray-900'}`}>
                        {s.sessionName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">
                        {formatDay(s.startTime)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </p>
                      {!s.isAvailable && (
                        <p className="text-xs text-red-400 mt-0.5">Session full</p>
                      )}
                      {atLimit && s.isAvailable && (
                        <p className="text-xs text-amber-500 mt-0.5">No remaining slots</p>
                      )}
                    </div>

                    {/* Checkbox */}
                    <div
                      className={[
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150',
                        isSelected
                          ? 'bg-[#8B1538] border-[#8B1538]'
                          : 'border-gray-300 bg-white',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-6 pt-3 pb-6 border-t border-gray-100 space-y-3">
            {error && !loading && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <Button
              className="w-full h-12 text-base font-semibold bg-[#8B1538] hover:bg-[#7a1230]"
              onClick={handleBook}
              disabled={selected.size === 0 || booking || loading}
            >
              {booking
                ? 'Booking...'
                : `Book ${selected.size} session${selected.size !== 1 ? 's' : ''}`}
            </Button>
            <button
              onClick={onClose}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
