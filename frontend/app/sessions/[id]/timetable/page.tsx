'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageSpinner } from '@/components/ui/spinner'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { TimeInput } from '@/components/ui/time-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TimeSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Preset = 'weekdays' | 'weekends' | 'all' | 'clear'

export default function TimetablePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (!res.ok) throw new Error('Failed to fetch session')
      const data = await res.json()
      setSession(data)
      setTimeSlots(data.timetable || [])
    } catch (error) {
      console.error('Error fetching session:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const isTimeValid =
    startTime &&
    endTime &&
    (() => {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      return eh * 60 + em > sh * 60 + sm
    })()

  const conflicts = new Set(
    startTime && endTime
      ? timeSlots
          .filter((ts) => ts.startTime === startTime && ts.endTime === endTime)
          .map((ts) => ts.dayOfWeek)
      : []
  )

  const validDays = [...selectedDays].filter((d) => !conflicts.has(d))
  const canSubmit = isTimeValid && validDays.length > 0

  const applyPreset = (preset: Preset) => {
    if (preset === 'weekdays') setSelectedDays(new Set([1, 2, 3, 4, 5]))
    else if (preset === 'weekends') setSelectedDays(new Set([0, 6]))
    else if (preset === 'all') setSelectedDays(new Set([0, 1, 2, 3, 4, 5, 6]))
    else setSelectedDays(new Set())
  }

  const toggleDay = (day: number) => {
    if (conflicts.has(day)) return
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const handleAdd = async () => {
    if (!canSubmit) return
    setSaving(true)

    const daysToAdd = validDays

    // Optimistic update
    const tempSlots: TimeSlot[] = daysToAdd.map((day) => ({
      id: `temp-${day}-${Date.now()}`,
      dayOfWeek: day,
      startTime,
      endTime,
    }))
    setTimeSlots((prev) => [...prev, ...tempSlots])
    setSelectedDays(new Set())

    try {
      const results = await Promise.allSettled(
        daysToAdd.map((day) =>
          fetch(`/api/sessions/${sessionId}/timetable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dayOfWeek: day, startTime, endTime }),
          }).then((r) => {
            if (!r.ok) throw new Error('Failed')
            return r.json()
          })
        )
      )

      const successful = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean) as TimeSlot[]

      setTimeSlots((prev) => [
        ...prev.filter((ts) => !ts.id.startsWith('temp-')),
        ...successful,
      ])
    } catch {
      setTimeSlots((prev) => prev.filter((ts) => !ts.id.startsWith('temp-')))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/timetable/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed')
      setTimeSlots((prev) => prev.filter((ts) => ts.id !== id))
      setConfirmDeleteId(null)
    } finally {
      setDeletingId(null)
    }
  }

  const groupedByTime = timeSlots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    const key = `${slot.startTime}|${slot.endTime}`
    ;(acc[key] ??= []).push(slot)
    return acc
  }, {})

  const sortedGroups = Object.entries(groupedByTime).sort(([a], [b]) => a.localeCompare(b))

  if (loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-gray-700 hover:text-gray-900 mb-2 block"
            >
              ← Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {session?.name} — Timetable
            </h1>
          </div>

          {/* Add form */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add Time Slot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Start Time
                  </label>
                  <TimeInput
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10"
                    max={endTime || undefined}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    End Time
                  </label>
                  <TimeInput
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-10"
                    min={startTime || undefined}
                  />
                  {startTime && endTime && !isTimeValid && (
                    <p className="text-xs text-red-600 mt-1">End time must be after start time</p>
                  )}
                </div>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Quick select:</span>
                {(
                  [
                    ['weekdays', 'Weekdays'],
                    ['weekends', 'Weekends'],
                    ['all', 'Every day'],
                    ['clear', 'Clear'],
                  ] as const
                ).map(([preset, label]) => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Day toggles */}
              <div className="flex gap-2 flex-wrap">
                {DAY_SHORT.map((name, i) => {
                  const isConflict = conflicts.has(i)
                  const isSelected = selectedDays.has(i)
                  return (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      disabled={isConflict}
                      title={isConflict ? 'Already has this time slot' : name}
                      className={[
                        'flex flex-col items-center justify-center w-12 h-12 rounded-lg text-xs font-medium transition-colors',
                        isConflict
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#8B1538] text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <span>{name}</span>
                      {isConflict && <span className="text-[9px] leading-none mt-0.5">✓</span>}
                    </button>
                  )
                })}
              </div>

              <Button
                onClick={handleAdd}
                disabled={!canSubmit || saving}
                className="w-full"
              >
                {saving
                  ? 'Adding…'
                  : canSubmit
                  ? `Add to ${validDays.length} day${validDays.length !== 1 ? 's' : ''}`
                  : 'Select days to add'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing slots */}
          {sortedGroups.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Current Timetable</h2>
              {sortedGroups.map(([key, slots]) => {
                const [start, end] = key.split('|')
                const sortedSlots = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                return (
                  <Card key={key}>
                    <CardContent className="py-4 px-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 w-28 shrink-0">
                          {start} – {end}
                        </span>
                        <div className="flex gap-2 flex-wrap flex-1">
                          {sortedSlots.map((slot) => (
                            <div key={slot.id} className="flex items-center gap-1">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-800">
                                {DAY_SHORT[slot.dayOfWeek]}
                              </span>
                              {confirmDeleteId === slot.id ? (
                                <span className="flex items-center gap-1.5 text-xs">
                                  <button
                                    onClick={() => handleDelete(slot.id)}
                                    disabled={deletingId === slot.id}
                                    className="text-red-600 font-semibold hover:text-red-800"
                                  >
                                    {deletingId === slot.id ? '…' : 'Remove'}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    Keep
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(slot.id)}
                                  className="text-gray-300 hover:text-red-400 text-sm leading-none transition-colors"
                                  title={`Remove ${DAY_SHORT[slot.dayOfWeek]}`}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">No time slots yet. Add your first slot above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
