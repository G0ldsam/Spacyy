'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Suggestion } from '@/app/book/page'

interface Props {
  suggestions: Suggestion[]
  slotsRemaining: number | null
  clientSessionAllowance: number | null
  onBrowse: () => void
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'UTC', hour: '2-digit', minute: '2-digit',
  })
}

function fmtChipDate(iso: string): { day: string; date: string } {
  const d = new Date(iso)
  return {
    day: d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' }),
    date: d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric' }),
  }
}

// Mon-first order: Mon=1..Sat=6, Sun=0 → treat as 7
function dowOrder(dow: number) { return dow === 0 ? 7 : dow }

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface SessionGroup {
  key: string
  dow: number
  sessionName: string
  themeColor: string
  timeRange: string
  items: Suggestion[]
  hasPreSelected: boolean
}

interface DayGroup {
  dow: number
  dayName: string
  sessions: SessionGroup[]
}

function buildDayGroups(suggestions: Suggestion[]): DayGroup[] {
  const sessionMap = new Map<string, SessionGroup>()

  for (const s of suggestions) {
    const dow = new Date(s.startTime).getUTCDay()
    const timeStart = fmtTime(s.startTime)
    const key = `${s.sessionId}_${dow}_${timeStart}`

    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        dow,
        sessionName: s.sessionName,
        themeColor: s.themeColor,
        timeRange: `${timeStart}–${fmtTime(s.endTime)}`,
        items: [],
        hasPreSelected: false,
      })
    }
    const sg = sessionMap.get(key)
    if (!sg) continue
    sg.items.push(s)
    if (s.isPreSelected) sg.hasPreSelected = true
  }

  for (const sg of sessionMap.values()) {
    sg.items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  const dayMap = new Map<number, DayGroup>()
  for (const sg of sessionMap.values()) {
    if (!dayMap.has(sg.dow)) {
      dayMap.set(sg.dow, { dow: sg.dow, dayName: DOW_NAMES[sg.dow], sessions: [] })
    }
    dayMap.get(sg.dow)?.sessions.push(sg)
  }

  for (const dg of dayMap.values()) {
    dg.sessions.sort((a, b) => {
      if (a.hasPreSelected && !b.hasPreSelected) return -1
      if (!a.hasPreSelected && b.hasPreSelected) return 1
      return a.timeRange.localeCompare(b.timeRange)
    })
  }

  return Array.from(dayMap.values()).sort((a, b) => dowOrder(a.dow) - dowOrder(b.dow))
}

interface DateChipProps {
  readonly s: Suggestion
  readonly isSelected: boolean
  readonly isDisabled: boolean
  readonly onToggle: () => void
}

function chipClass(isSelected: boolean, isAvailable: boolean, isDisabled: boolean): string {
  if (isSelected) return 'border-brand bg-brand'
  if (!isAvailable || isDisabled) return 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
  return 'border-gray-200 bg-white hover:border-brand/50 active:scale-95'
}

function DateChip({ s, isSelected, isDisabled, onToggle }: DateChipProps) {
  const { day, date } = fmtChipDate(s.startTime)
  return (
    <button
      onClick={onToggle}
      disabled={isDisabled && !isSelected}
      aria-pressed={isSelected}
      className={`flex flex-col items-center justify-center w-[52px] h-[52px] rounded-xl border-2 transition-all duration-150 shrink-0 ${chipClass(isSelected, s.isAvailable, isDisabled)}`}
    >
      <span className={`text-[10px] font-medium leading-none ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
        {day}
      </span>
      <span className={`text-base font-bold leading-none mt-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
        {date}
      </span>
      {s.isAvailable ? null : (
        <span className="text-[8px] text-red-400 leading-none mt-0.5">full</span>
      )}
    </button>
  )
}

interface SessionCardProps {
  readonly group: SessionGroup
  readonly selected: Set<string>
  readonly selCount: number
  readonly maxSelectable: number
  readonly onToggle: (id: string, isAvailable: boolean) => void
  readonly onToggleGroup: (group: SessionGroup) => void
}

function SessionCard({ group, selected, selCount, maxSelectable, onToggle, onToggleGroup }: SessionCardProps) {
  const available = group.items.filter(s => s.isAvailable)
  const selectedInGroup = available.filter(s => selected.has(s.id))
  const allGroupSelected = available.length > 0 && selectedInGroup.length === available.length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.themeColor }} />
          <span className="font-semibold text-gray-900 text-sm truncate">{group.sessionName}</span>
          <span className="text-xs text-gray-400 shrink-0">{group.timeRange}</span>
          {group.hasPreSelected && (
            <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full leading-none shrink-0">
              usual
            </span>
          )}
        </div>
        {available.length > 0 && (
          <button
            onClick={() => onToggleGroup(group)}
            className="text-xs font-semibold text-brand hover:opacity-70 transition-opacity shrink-0 ml-3 min-w-[28px] text-right"
          >
            {allGroupSelected ? 'None' : 'All'}
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {group.items.map(s => (
          <DateChip
            key={s.id}
            s={s}
            isSelected={selected.has(s.id)}
            isDisabled={!selected.has(s.id) && selCount >= maxSelectable}
            onToggle={() => onToggle(s.id, s.isAvailable)}
          />
        ))}
      </div>

      {selectedInGroup.length > 0 && (
        <p className="text-xs text-brand font-medium mt-3">
          {selectedInGroup.length} of {group.items.length} date{group.items.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  )
}

function bookButtonLabel(booking: boolean, selCount: number): string {
  if (booking) return 'Booking…'
  if (selCount === 0) return 'Select sessions to book'
  return `Book ${selCount} session${selCount === 1 ? '' : 's'}`
}

export function RebookClient({ suggestions, slotsRemaining, clientSessionAllowance, onBrowse }: Readonly<Props>) {
  const router = useRouter()

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.filter(s => s.isPreSelected && s.isAvailable).map(s => s.id))
  )
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const dayGroups = useMemo(() => buildDayGroups(suggestions), [suggestions])

  const maxSelectable = slotsRemaining === null ? Infinity : Math.max(0, slotsRemaining)
  const selCount = selected.size
  const progressPct = clientSessionAllowance && clientSessionAllowance > 0
    ? Math.min(100, (selCount / Math.min(maxSelectable, clientSessionAllowance)) * 100)
    : 0

  function toggle(id: string, isAvailable: boolean) {
    if (!isAvailable) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= maxSelectable) return prev
        next.add(id)
      }
      return next
    })
  }

  function toggleGroup(group: SessionGroup) {
    const available = group.items.filter(s => s.isAvailable)
    const allSelected = available.length > 0 && available.every(s => selected.has(s.id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) {
        available.forEach(s => next.delete(s.id))
      } else {
        for (const s of available) {
          if (!next.has(s.id)) {
            if (next.size >= maxSelectable) break
            next.add(s.id)
          }
        }
      }
      return next
    })
  }

  async function handleBook() {
    if (selCount === 0) return
    setBooking(true)
    setError('')
    const toBook = suggestions.filter(s => selected.has(s.id))
    try {
      const res = await fetch('/api/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookings: toBook.map(s => ({ sessionId: s.sessionId, startTime: s.startTime, endTime: s.endTime })),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to book')
      }
      setDone(true)
      setTimeout(() => router.push('/my-sessions'), 1600)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBooking(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{selCount} session{selCount === 1 ? '' : 's'} booked!</h2>
          <p className="text-gray-500 text-sm">Redirecting to My Sessions…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Link href="/home" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Home
            </Link>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm font-bold text-gray-900">
                {selCount}
                {slotsRemaining !== null && (
                  <span className="font-normal text-gray-400"> / {slotsRemaining} available</span>
                )}
                <span className="font-normal text-gray-500"> selected</span>
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium mb-3">
            <button className="flex-1 py-1.5 rounded-md bg-white shadow-sm text-gray-900 transition-colors">
              Recommended
            </button>
            <button
              onClick={onBrowse}
              className="flex-1 py-1.5 rounded-md text-gray-500 hover:text-gray-700 transition-colors"
            >
              Browse
            </button>
          </div>

          {slotsRemaining !== null && slotsRemaining > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-brand h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">
        {dayGroups.map(dayGroup => (
          <div key={dayGroup.dow}>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">
              {dayGroup.dayName}s
            </h2>
            <div className="space-y-2">
              {dayGroup.sessions.map(group => (
                <SessionCard
                  key={group.key}
                  group={group}
                  selected={selected}
                  selCount={selCount}
                  maxSelectable={maxSelectable}
                  onToggle={toggle}
                  onToggleGroup={toggleGroup}
                />
              ))}
            </div>
          </div>
        ))}

        {suggestions.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No sessions available this month.</p>
            <p className="text-gray-400 text-sm mt-1">Check back later or contact your studio.</p>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-lg">
          <div className="max-w-2xl mx-auto space-y-2">
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button
              className="w-full h-12 text-base font-semibold disabled:opacity-40"
              onClick={handleBook}
              disabled={selCount === 0 || booking}
            >
              {bookButtonLabel(booking, selCount)}
            </Button>
            {selCount === 0 && (
              <p className="text-xs text-center text-gray-400">Tap sessions above to select them</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
