'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimeInput } from '@/components/ui/time-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DAYS_OF_WEEK } from '@/shared/types/session'

interface TimeSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export default function TimetablePage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [showAddModal, setShowAddModal] = useState<number | null>(null)
  const [newTimeSlot, setNewTimeSlot] = useState({ startTime: '', endTime: '' })

  useEffect(() => {
    fetchSession()
  }, [sessionId])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (!response.ok) throw new Error('Failed to fetch session')
      const data = await response.json()
      setSession(data)
      setTimeSlots(data.timetable || [])
    } catch (error) {
      console.error('Error fetching session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTimeSlot = async (dayOfWeek: number) => {
    if (!newTimeSlot.startTime || !newTimeSlot.endTime) {
      alert('Please enter both start and end times')
      return
    }

    // Validate that end time is after start time
    const [startHour, startMin] = newTimeSlot.startTime.split(':').map(Number)
    const [endHour, endMin] = newTimeSlot.endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    if (endMinutes <= startMinutes) {
      alert('End time must be after start time')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/timetable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dayOfWeek,
          startTime: newTimeSlot.startTime,
          endTime: newTimeSlot.endTime,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add time slot')
      }

      const data = await response.json()
      setTimeSlots([...timeSlots, data])
      setNewTimeSlot({ startTime: '', endTime: '' })
      setShowAddModal(null)
    } catch (error: any) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTimeSlot = async (timeSlotId: string) => {
    if (!confirm('Are you sure you want to delete this time slot?')) return

    try {
      const response = await fetch(`/api/sessions/${sessionId}/timetable/${timeSlotId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete time slot')
      }

      setTimeSlots(timeSlots.filter((ts) => ts.id !== timeSlotId))
    } catch (error: any) {
      alert(error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => router.back()}
                className="text-gray-700 hover:text-gray-900"
              >
                ← Back
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {session?.name} - Timetable
            </h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              Manage time slots for each day of the week
            </p>
          </div>

          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day, dayIndex) => {
              const daySlots = timeSlots.filter((ts) => ts.dayOfWeek === dayIndex)
              return (
                <Card key={dayIndex}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{day}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddModal(dayIndex)}
                      >
                        + Add Time
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {showAddModal === dayIndex && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-700 mb-1 block">Start Time (24h)</label>
                              <TimeInput
                                value={newTimeSlot.startTime}
                                onChange={(e) =>
                                  setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })
                                }
                                className="h-10"
                                max={newTimeSlot.endTime || undefined}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-700 mb-1 block">End Time (24h)</label>
                              <TimeInput
                                value={newTimeSlot.endTime}
                                onChange={(e) =>
                                  setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })
                                }
                                className="h-10"
                                min={newTimeSlot.startTime || undefined}
                              />
                              {newTimeSlot.startTime && newTimeSlot.endTime && (() => {
                                const [startHour, startMin] = newTimeSlot.startTime.split(':').map(Number)
                                const [endHour, endMin] = newTimeSlot.endTime.split(':').map(Number)
                                const startMinutes = startHour * 60 + startMin
                                const endMinutes = endHour * 60 + endMin
                                if (endMinutes <= startMinutes) {
                                  return (
                                    <p className="text-xs text-red-600 mt-1">End time must be after start time</p>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddTimeSlot(dayIndex)}
                              disabled={saving}
                              className="flex-1"
                            >
                              {saving ? 'Adding...' : 'Add'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowAddModal(null)
                                setNewTimeSlot({ startTime: '', endTime: '' })
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {daySlots.length === 0 ? (
                      <p className="text-sm text-gray-700 text-center py-4">
                        No time slots added yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {daySlots
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {slot.startTime} - {slot.endTime}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTimeSlot(slot.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
