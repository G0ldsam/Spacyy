'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, router, sessionId, date])

  const fetchData = async () => {
    try {
      // Fetch session details
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`)
      if (!sessionResponse.ok) throw new Error('Failed to fetch session')
      const sessionData = await sessionResponse.json()
      setSessionName(sessionData.name)
      const slots = Number(sessionData.slots) || 1
      setSessionSlots(slots)

      // Get day of week for the date
      const selectedDate = new Date(date)
      const dayOfWeek = selectedDate.getDay()

      // Filter time slots for this day
      const dayTimeSlots = sessionData.timetable.filter(
        (slot: any) => slot.dayOfWeek === dayOfWeek
      )
      setTimeSlots(dayTimeSlots.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)))

      // Fetch bookings for this date
      const bookingsResponse = await fetch(
        `/api/bookings/availability?sessionId=${sessionId}&date=${date}`
      )
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json()
        const bookingsMap: Record<string, Booking[]> = {}
        bookingsData.forEach((booking: any) => {
          const key = `${booking.startTime}-${booking.endTime}`
          if (!bookingsMap[key]) {
            bookingsMap[key] = []
          }
          bookingsMap[key].push(booking)
        })
        setBookings(bookingsMap)
      }

      // Fetch clients
      const clientsResponse = await fetch('/api/clients')
      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json()
        setClients(clientsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleAssign = async () => {
    if (!selectedClientId || !selectedTimeSlot) return

    try {
      const selectedDate = new Date(date)
      const [startHour, startMin] = selectedTimeSlot.startTime.split(':').map(Number)
      const [endHour, endMin] = selectedTimeSlot.endTime.split(':').map(Number)

      const startTime = new Date(selectedDate)
      startTime.setHours(startHour, startMin, 0, 0)

      const endTime = new Date(selectedDate)
      endTime.setHours(endHour, endMin, 0, 0)

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      fetchData() // Refresh data
    } catch (error: any) {
      alert(error.message || 'Failed to assign client')
    }
  }

  const handleCancel = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel booking')
      }

      setShowModal(false)
      setSelectedTimeSlot(null)
      setSelectedBooking(null)
      fetchData() // Refresh data
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
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'CANCELLED' }),
          })
        )
      )

      setSelectedTimeSlot(null)
      fetchData() // Refresh data
    } catch (error: any) {
      alert(error.message || 'Failed to empty slot')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (status === 'loading' || loading) {
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
            <Link href="/bookings" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
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
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              {formatDate(date)}
            </p>
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

                    return (
                      <div key={timeSlot.id}>
                        <div
                          onClick={() => handleTimeSlotClick(timeSlot)}
                          className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${
                            isSelected
                              ? 'border-[#8B1538] bg-[#8B1538]/5'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {timeSlot.startTime} - {timeSlot.endTime}
                              </h3>
                              <span className="text-xs text-gray-600">
                                {activeBookings.length}/{sessionSlots} {activeBookings.length === 1 ? 'booking' : 'bookings'}
                              </span>
                            </div>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-5 w-5 transition-transform ${
                                isSelected ? 'rotate-90' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-4 space-y-2">
                            {/* Show existing bookings */}
                            {activeBookings.map((booking) => (
                              <div
                                key={booking.id}
                                onClick={() => handleClientClick(booking)}
                                className="text-sm text-gray-900 bg-gray-50 rounded px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
                              >
                                {booking.client.name} ({booking.client.email})
                              </div>
                            ))}
                            {/* Show empty slots */}
                            {Array.from({ length: emptySlotsCount }).map((_, index) => (
                              <div
                                key={`empty-${index}`}
                                onClick={() => handleClientClick(null)}
                                className="text-sm text-gray-600 py-2 cursor-pointer hover:text-gray-900 border border-dashed border-gray-300 rounded px-3 py-2 hover:border-gray-400 transition-colors"
                              >
                                Empty - Click to assign a client
                              </div>
                            ))}
                            {activeBookings.length > 0 && (
                              <div
                                onClick={() => {
                                  if (confirm(`Cancel all ${activeBookings.length} booking(s) in this slot?`)) {
                                    handleEmpty()
                                  }
                                }}
                                className="text-sm text-red-600 py-2 cursor-pointer hover:text-red-800 font-medium"
                              >
                                Make Slot Empty
                              </div>
                            )}
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

      {/* Modal */}
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
                    <Button
                      className="w-full"
                      onClick={() => setAction('assign')}
                    >
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
                      <option value="">Choose a client...</option>
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
