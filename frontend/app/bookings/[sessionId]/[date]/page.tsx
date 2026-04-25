'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Booking {
  id: string
  client: {
    id: string
    name: string
    email: string
  }
  startTime: string
  endTime: string
  status: string
  checkedIn: boolean
  checkedInAt: string | null
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
}

interface SlotException {
  id: string
  reason: string | null
}

export default function TimeSlotBookingsPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const sessionId = params.sessionId as string
  const date = params.date as string

  const [sessionName, setSessionName] = useState('')
  const [sessionSlots, setSessionSlots] = useState(1)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [bookings, setBookings] = useState<Record<string, Booking[]>>({})
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [action, setAction] = useState<'assign' | 'cancel' | null>(null)

  // Exception state (timeSlotId -> exception)
  const [exceptions, setExceptions] = useState<Record<string, SlotException>>({})
  const [closingSlotId, setClosingSlotId] = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [closingSaving, setClosingSaving] = useState(false)

  // Interest list state (timeSlotId -> entries)
  const [interestLists, setInterestLists] = useState<
    Record<string, Array<{ id: string; client: { name: string; email: string }; notifiedAt: string | null }>>
  >({})
  const [notifyingSlotId, setNotifyingSlotId] = useState<string | null>(null)

  const isAdmin = session?.user?.organizations?.some(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  const fetchData = useCallback(async () => {
    try {
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`)
      if (!sessionResponse.ok) throw new Error('Failed to fetch session')
      const sessionData = await sessionResponse.json()
      setSessionName(sessionData.name)
      setSessionSlots(Number(sessionData.slots) || 1)

      const selectedDate = new Date(date)
      const dayOfWeek = selectedDate.getDay()
      const dayTimeSlots = sessionData.timetable.filter(
        (slot: any) => slot.dayOfWeek === dayOfWeek
      )
      setTimeSlots(
        dayTimeSlots.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
      )

      const bookingsResponse = await fetch(
        `/api/bookings/availability?sessionId=${sessionId}&date=${date}`
      )
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json()
        const bookingsMap: Record<string, Booking[]> = {}
        bookingsData.forEach((booking: any) => {
          const key = `${booking.startTime}-${booking.endTime}`
          if (!bookingsMap[key]) bookingsMap[key] = []
          bookingsMap[key].push(booking)
        })
        setBookings(bookingsMap)
      }

      const clientsResponse = await fetch('/api/clients')
      if (clientsResponse.ok) {
        setClients(await clientsResponse.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionId, date])

  const fetchExceptions = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/exceptions?date=${date}`)
      if (res.ok) setExceptions(await res.json())
    } catch {
      // non-fatal
    }
  }, [sessionId, date])

  const fetchInterestLists = useCallback(
    async (slots: TimeSlot[]) => {
      await Promise.all(
        slots.map(async (slot) => {
          try {
            const res = await fetch(
              `/api/interest?sessionId=${sessionId}&timeSlotId=${slot.id}&date=${date}`
            )
            if (res.ok) {
              const entries = await res.json()
              setInterestLists((prev) => ({ ...prev, [slot.id]: entries }))
            }
          } catch {
            // non-fatal
          }
        })
      )
    },
    [sessionId, date]
  )

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchData().then(() => {
        // fetchInterestLists is called after timeSlots are set via fetchData
      })
      fetchExceptions()
    }
  }, [status, router, fetchData, fetchExceptions])

  // Fetch interest lists once time slots are loaded
  useEffect(() => {
    if (timeSlots.length > 0 && isAdmin) {
      fetchInterestLists(timeSlots)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSlots, isAdmin])

  const handleTimeSlotClick = (timeSlot: TimeSlot) => {
    setSelectedTimeSlot(timeSlot)
    setShowModal(false)
    setAction(null)
    setSelectedClientId('')
    setSelectedBooking(null)
  }

  const handleClientClick = (booking: Booking | null) => {
    setSelectedBooking(booking)
    setShowModal(true)
    setAction(null)
    setSelectedClientId('')
  }

  const handleCheckIn = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/admin/check-in/booking/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to check in')
      }
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to check in client')
    }
  }

  const handleAssign = async () => {
    if (!selectedClientId || !selectedTimeSlot) return
    try {
      const [startHour, startMin] = selectedTimeSlot.startTime.split(':').map(Number)
      const [endHour, endMin] = selectedTimeSlot.endTime.split(':').map(Number)
      // Use UTC so "16:00" is stored as T16:00:00Z regardless of browser timezone
      const startTime = new Date(`${date}T00:00:00Z`)
      startTime.setUTCHours(startHour, startMin, 0, 0)
      const endTime = new Date(`${date}T00:00:00Z`)
      endTime.setUTCHours(endHour, endMin, 0, 0)

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          clientId: selectedClientId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create booking')
      }
      setShowModal(false)
      setSelectedTimeSlot(null)
      setSelectedBooking(null)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to assign client')
    }
  }

  const handleCancel = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!response.ok) throw new Error('Failed to cancel booking')
      setShowModal(false)
      setSelectedTimeSlot(null)
      setSelectedBooking(null)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to cancel booking')
    }
  }

  const handleEmpty = async () => {
    if (!selectedTimeSlot) return
    const key = `${selectedTimeSlot.startTime}-${selectedTimeSlot.endTime}`
    const slotBookings = bookings[key] || []
    const activeBookings = slotBookings.filter((b) => b.status !== 'CANCELLED')
    if (activeBookings.length === 0) {
      alert('This slot is already empty')
      return
    }
    try {
      await Promise.all(
        activeBookings.map((booking) =>
          fetch(`/api/bookings/${booking.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'CANCELLED' }),
          })
        )
      )
      setSelectedTimeSlot(null)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to empty slot')
    }
  }

  const handleCloseOccurrence = async (timeSlot: TimeSlot) => {
    setClosingSaving(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSlotId: timeSlot.id,
          date,
          reason: closeReason.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to close occurrence')
      const { exception, cancelledCount } = await res.json()
      setExceptions((prev) => ({ ...prev, [timeSlot.id]: exception }))
      setClosingSlotId(null)
      setCloseReason('')
      if (cancelledCount > 0) {
        fetchData()
      }
    } catch (error: any) {
      alert(error.message || 'Failed to close occurrence')
    } finally {
      setClosingSaving(false)
    }
  }

  const handleNotifyAll = async (timeSlot: TimeSlot) => {
    setNotifyingSlotId(timeSlot.id)
    try {
      const res = await fetch('/api/interest/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, timeSlotId: timeSlot.id, date }),
      })
      if (!res.ok) throw new Error('Failed to send notifications')
      const { notifiedCount } = await res.json()
      // Refresh interest list to show updated notifiedAt
      await fetchInterestLists([timeSlot])
      alert(`Notifications sent to ${notifiedCount} client${notifiedCount !== 1 ? 's' : ''}.`)
    } catch (error: any) {
      alert(error.message || 'Failed to send notifications')
    } finally {
      setNotifyingSlotId(null)
    }
  }

  const handleReopen = async (timeSlotId: string) => {
    const exception = exceptions[timeSlotId]
    if (!exception) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/exceptions/${exception.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to reopen')
      setExceptions((prev) => {
        const next = { ...prev }
        delete next[timeSlotId]
        return next
      })
    } catch (error: any) {
      alert(error.message || 'Failed to reopen occurrence')
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (status === 'loading' || loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <Link
              href="/bookings"
              className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Bookings
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{sessionName}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">{formatDate(date)}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Time Slots</CardTitle>
            </CardHeader>
            <CardContent>
              {timeSlots.length === 0 ? (
                <p className="text-center text-gray-700 py-8">No time slots for this day</p>
              ) : (
                <div className="space-y-4">
                  {timeSlots.map((timeSlot) => {
                    const key = `${timeSlot.startTime}-${timeSlot.endTime}`
                    const slotBookings = bookings[key] || []
                    const activeBookings = slotBookings.filter((b) => b.status !== 'CANCELLED')
                    const isSelected = selectedTimeSlot?.id === timeSlot.id
                    const emptySlotsCount = Math.max(0, sessionSlots - activeBookings.length)
                    const exception = exceptions[timeSlot.id]
                    const isClosed = !!exception
                    const isClosing = closingSlotId === timeSlot.id

                    return (
                      <div key={timeSlot.id}>
                        <div
                          onClick={() => !isClosed && handleTimeSlotClick(timeSlot)}
                          className={[
                            'border rounded-lg p-4 transition-shadow',
                            isClosed
                              ? 'border-red-200 bg-red-50 cursor-default'
                              : 'cursor-pointer hover:shadow-md',
                            isSelected && !isClosed ? 'border-[#8B1538] bg-[#8B1538]/5' : '',
                            !isClosed && !isSelected ? 'border-gray-200' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {timeSlot.startTime} - {timeSlot.endTime}
                                </h3>
                                {isClosed && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                                    Closed
                                  </span>
                                )}
                              </div>
                              {isClosed ? (
                                <p className="text-sm text-red-600 mt-1">
                                  {exception.reason
                                    ? `Reason: ${exception.reason}`
                                    : 'This occurrence has been cancelled'}
                                </p>
                              ) : (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-600">
                                    {activeBookings.length}/{sessionSlots}{' '}
                                    {activeBookings.length === 1 ? 'booking' : 'bookings'}
                                  </span>
                                  {activeBookings.length > 0 && (
                                    <>
                                      <span className="text-xs text-gray-400">•</span>
                                      <span className="text-xs text-green-700 font-medium">
                                        {activeBookings.filter((b) => b.checkedIn).length} checked in
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Admin actions */}
                            {isAdmin && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0"
                              >
                                {isClosed ? (
                                  <button
                                    onClick={() => handleReopen(timeSlot.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                                  >
                                    Re-open
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setClosingSlotId(isClosing ? null : timeSlot.id)
                                      setCloseReason('')
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
                                  >
                                    {isClosing ? 'Cancel' : 'Close occurrence'}
                                  </button>
                                )}
                              </div>
                            )}

                            {!isClosed && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${
                                  isSelected ? 'rotate-90' : ''
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </div>

                          {/* Inline close form */}
                          {isClosing && !isClosed && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-3 pt-3 border-t border-red-200 space-y-2"
                            >
                              <input
                                type="text"
                                placeholder="Reason (optional)"
                                value={closeReason}
                                onChange={(e) => setCloseReason(e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={closingSaving}
                                  onClick={() => handleCloseOccurrence(timeSlot)}
                                  className="bg-red-600 hover:bg-red-700 text-white flex-1"
                                >
                                  {closingSaving ? 'Closing…' : 'Confirm close'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setClosingSlotId(null)
                                    setCloseReason('')
                                  }}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                              {activeBookings.length > 0 && (
                                <p className="text-xs text-red-600">
                                  This will cancel {activeBookings.length} existing booking
                                  {activeBookings.length !== 1 ? 's' : ''} and restore their session
                                  allowance.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expanded booking list */}
                        {isSelected && !isClosed && (
                          <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-4 space-y-2">
                            {activeBookings.map((booking) => (
                              <div
                                key={booking.id}
                                className={`text-sm rounded px-3 py-2 transition-colors flex items-center justify-between gap-2 ${
                                  booking.checkedIn
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-gray-50 border border-gray-200'
                                }`}
                              >
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() => handleClientClick(booking)}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-gray-900 font-medium">
                                      {booking.client.name}
                                    </span>
                                    {booking.checkedIn ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        ✓ Checked In
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-600 block mt-0.5">
                                    {booking.client.email}
                                  </span>
                                  {booking.checkedIn && booking.checkedInAt && (
                                    <span className="text-xs text-green-700 block mt-0.5">
                                      Checked in at{' '}
                                      {new Date(booking.checkedInAt).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  )}
                                </div>
                                {!booking.checkedIn && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCheckIn(booking.id)
                                    }}
                                    className="flex-shrink-0 text-xs"
                                  >
                                    Check In
                                  </Button>
                                )}
                              </div>
                            ))}
                            {Array.from({ length: emptySlotsCount }).map((_, index) => (
                              <div
                                key={`empty-${index}`}
                                onClick={() => handleClientClick(null)}
                                className="text-sm text-gray-600 py-2 cursor-pointer hover:text-gray-900 border border-dashed border-gray-300 rounded px-3 hover:border-gray-400 transition-colors"
                              >
                                Empty — Click to assign a client
                              </div>
                            ))}
                            {activeBookings.length > 0 && (
                              <div
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Cancel all ${activeBookings.length} booking(s) in this slot?`
                                    )
                                  ) {
                                    handleEmpty()
                                  }
                                }}
                                className="text-sm text-red-600 py-2 cursor-pointer hover:text-red-800 font-medium"
                              >
                                Make Slot Empty
                              </div>
                            )}

                            {/* Interest list */}
                            {isAdmin && (() => {
                              const interested = interestLists[timeSlot.id] || []
                              if (interested.length === 0) return null
                              return (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                      Interest list ({interested.length})
                                    </span>
                                    {emptySlotsCount > 0 && (
                                      <button
                                        onClick={() => handleNotifyAll(timeSlot)}
                                        disabled={notifyingSlotId === timeSlot.id}
                                        className="text-xs font-semibold text-[#8B1538] hover:text-[#6d1029] disabled:opacity-50"
                                      >
                                        {notifyingSlotId === timeSlot.id
                                          ? 'Sending…'
                                          : `Notify all (${emptySlotsCount} spot${emptySlotsCount !== 1 ? 's' : ''} open)`}
                                      </button>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    {interested.map((entry) => (
                                      <div
                                        key={entry.id}
                                        className="flex items-center justify-between text-xs text-gray-700 px-2 py-1.5 bg-gray-50 rounded"
                                      >
                                        <span>
                                          {entry.client.name}{' '}
                                          <span className="text-gray-400">
                                            {entry.client.email}
                                          </span>
                                        </span>
                                        {entry.notifiedAt && (
                                          <span className="text-green-600 ml-2 shrink-0">
                                            Notified
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking action modal */}
      {showModal && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}
                </h2>
                {selectedBooking && (
                  <p className="text-sm text-gray-700 mt-1">
                    {selectedBooking.client.name} ({selectedBooking.client.email})
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowModal(false)
                  setAction(null)
                  setSelectedBooking(null)
                }}
                className="text-gray-500 hover:text-gray-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {!action ? (
                <div className="space-y-2">
                  {selectedBooking ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        if (confirm('Are you sure you want to cancel this booking?')) {
                          handleCancel(selectedBooking.id)
                        }
                      }}
                    >
                      Cancel Booking
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => setAction('assign')}>
                      Assign a Client
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowModal(false)
                      setAction(null)
                      setSelectedBooking(null)
                    }}
                  >
                    Close
                  </Button>
                </div>
              ) : action === 'assign' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">
                      Select Client
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2"
                    >
                      <option value="">Choose a client…</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setAction(null)
                        setSelectedClientId('')
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleAssign}
                      disabled={!selectedClientId}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
