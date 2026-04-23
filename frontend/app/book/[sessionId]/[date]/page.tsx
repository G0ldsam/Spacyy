'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface TimeSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface Booking {
  id: string
  startTime: string
  endTime: string
  status: string
  client: { id: string; name: string; email: string }
}

interface InterestEntry {
  id: string
  timeSlotId: string
}

export default function BookSessionPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const sessionId = params.sessionId as string
  const date = params.date as string

  const [sessionName, setSessionName] = useState('')
  const [sessionSlots, setSessionSlots] = useState(1)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [bookings, setBookings] = useState<Record<string, Booking[]>>({})
  const [loading, setLoading] = useState(true)
  const [bookingSlot, setBookingSlot] = useState<TimeSlot | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Interest state: timeSlotId -> entry (null = not interested)
  const [interests, setInterests] = useState<Record<string, InterestEntry | null>>({})
  const [interestLoading, setInterestLoading] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async () => {
    try {
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`)
      if (!sessionResponse.ok) throw new Error('Failed to fetch session')
      const sessionData = await sessionResponse.json()
      setSessionName(sessionData.name)
      setSessionSlots(sessionData.slots || 1)

      const selectedDate = new Date(date)
      const dayOfWeek = selectedDate.getDay()
      const dayTimeSlots = sessionData.timetable.filter(
        (slot: any) => slot.dayOfWeek === dayOfWeek
      )
      const sorted = dayTimeSlots.sort((a: any, b: any) =>
        a.startTime.localeCompare(b.startTime)
      )
      setTimeSlots(sorted)

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

      // Fetch interest entries for each slot
      await Promise.all(
        sorted.map(async (slot: TimeSlot) => {
          try {
            const res = await fetch(
              `/api/interest?sessionId=${sessionId}&timeSlotId=${slot.id}&date=${date}`
            )
            if (res.ok) {
              const entry = await res.json()
              setInterests((prev) => ({ ...prev, [slot.id]: entry }))
            }
          } catch {
            // non-fatal
          }
        })
      )
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [sessionId, date])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') fetchData()
  }, [status, router, fetchData])

  const getRemainingSlots = (timeSlot: TimeSlot) => {
    const key = `${timeSlot.startTime}-${timeSlot.endTime}`
    const activeBookings = (bookings[key] || []).filter((b) => b.status !== 'CANCELLED')
    return Math.max(0, sessionSlots - activeBookings.length)
  }

  const handleBookSlot = (timeSlot: TimeSlot) => {
    if (getRemainingSlots(timeSlot) > 0) {
      setBookingSlot(timeSlot)
      setShowConfirmModal(true)
    }
  }

  const confirmBooking = async () => {
    if (!bookingSlot || !session?.user?.id) return

    try {
      const selectedDate = new Date(date)
      const [startHour, startMin] = bookingSlot.startTime.split(':').map(Number)
      const [endHour, endMin] = bookingSlot.endTime.split(':').map(Number)
      const startTime = new Date(selectedDate)
      startTime.setHours(startHour, startMin, 0, 0)
      const endTime = new Date(selectedDate)
      endTime.setHours(endHour, endMin, 0, 0)

      const clientResponse = await fetch('/api/clients/me')
      if (!clientResponse.ok) throw new Error('Failed to get client information')
      const clientData = await clientResponse.json()

      const changingBookingId = sessionStorage.getItem('changingBookingId')

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          clientId: clientData.id,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create booking')
      }

      if (changingBookingId) {
        try {
          await fetch(`/api/bookings/${changingBookingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'CANCELLED', isReschedule: true }),
          })
          sessionStorage.removeItem('changingBookingId')
        } catch {
          // continue — new booking was created
        }
      }

      setShowConfirmModal(false)
      setBookingSlot(null)
      router.push('/home')
      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to book session')
    }
  }

  const handleToggleInterest = async (timeSlot: TimeSlot) => {
    const existing = interests[timeSlot.id]
    setInterestLoading((prev) => ({ ...prev, [timeSlot.id]: true }))

    try {
      if (existing) {
        await fetch(`/api/interest/${existing.id}`, { method: 'DELETE' })
        setInterests((prev) => ({ ...prev, [timeSlot.id]: null }))
      } else {
        const res = await fetch('/api/interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, timeSlotId: timeSlot.id, date }),
        })
        if (res.ok) {
          const entry = await res.json()
          setInterests((prev) => ({ ...prev, [timeSlot.id]: entry }))
        }
      }
    } catch {
      // non-fatal
    } finally {
      setInterestLoading((prev) => ({ ...prev, [timeSlot.id]: false }))
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

  if (status === 'loading' || loading) return <PageSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <Link
              href="/home"
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
              Back to Sessions
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{sessionName}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">{formatDate(date)}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Available Time Slots</CardTitle>
            </CardHeader>
            <CardContent>
              {timeSlots.length === 0 ? (
                <p className="text-center text-gray-700 py-8">No time slots for this day</p>
              ) : (
                <div className="space-y-3">
                  {timeSlots.map((timeSlot) => {
                    const remaining = getRemainingSlots(timeSlot)
                    const isAvailable = remaining > 0
                    const isInterested = !!interests[timeSlot.id]
                    const isLoadingInterest = interestLoading[timeSlot.id]

                    const [slotHour, slotMin] = timeSlot.startTime.split(':').map(Number)
                    const slotStart = new Date(date)
                    slotStart.setHours(slotHour, slotMin, 0, 0)
                    const isPast = slotStart <= new Date()

                    if (isPast) return null

                    return (
                      <div
                        key={timeSlot.id}
                        className={[
                          'relative p-4 rounded-lg border-2 transition-colors',
                          isAvailable
                            ? 'border-green-200 bg-green-50 cursor-pointer hover:shadow-md'
                            : 'border-red-200 bg-red-50',
                        ].join(' ')}
                        onClick={() => isAvailable && handleBookSlot(timeSlot)}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-lg font-semibold text-gray-900">
                            {timeSlot.startTime} - {timeSlot.endTime}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                'px-3 py-1 rounded-full text-sm font-semibold',
                                isAvailable ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
                              ].join(' ')}
                            >
                              {remaining} {remaining === 1 ? 'slot' : 'slots'} available
                            </span>
                            {!isAvailable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleInterest(timeSlot)
                                }}
                                disabled={isLoadingInterest}
                                className={[
                                  'px-3 py-1 rounded-full text-sm font-semibold border transition-colors',
                                  isInterested
                                    ? 'bg-[#8B1538] text-white border-[#8B1538]'
                                    : 'bg-white text-[#8B1538] border-[#8B1538] hover:bg-[#8B1538]/10',
                                ].join(' ')}
                              >
                                {isLoadingInterest
                                  ? '…'
                                  : isInterested
                                  ? "I'm interested ✓"
                                  : "I'm interested"}
                              </button>
                            )}
                          </div>
                        </div>
                        {!isAvailable && isInterested && (
                          <p className="text-xs text-[#8B1538] mt-2">
                            You&apos;re on the interest list. We&apos;ll notify you if a spot opens up.
                          </p>
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

      {showConfirmModal && bookingSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Booking</h2>
            <div className="space-y-3 mb-6">
              <p className="text-gray-700">
                <span className="font-semibold">Session:</span> {sessionName}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Date:</span> {formatDate(date)}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Time:</span> {bookingSlot.startTime} -{' '}
                {bookingSlot.endTime}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmModal(false)
                  setBookingSlot(null)
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmBooking}>
                Confirm Booking
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
