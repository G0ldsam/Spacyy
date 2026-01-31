'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DAYS_OF_WEEK } from '@/shared/types/session'

interface TimeSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface Session {
  id: string
  name: string
  description: string | null
  themeColor: string
  slots: number
  timetable: TimeSlot[]
}

export default function BookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [availableSessions, setAvailableSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [timeSlotBookings, setTimeSlotBookings] = useState<Record<string, number>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchSessions()
    }
  }, [status, router])

  useEffect(() => {
    if (sessions.length > 0) {
      filterSessionsByDate()
      // Reset selected session when date changes
      if (selectedSession) {
        setSelectedSession(null)
        setTimeSlotBookings({})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, sessions])

  useEffect(() => {
    if (selectedSession) {
      fetchTimeSlotBookings(selectedSession.id, selectedDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession, selectedDate])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (!response.ok) throw new Error('Failed to fetch sessions')
      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSessionsByDate = () => {
    const dayOfWeek = selectedDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    const filtered = sessions.filter((session) => {
      return session.timetable.some((slot) => slot.dayOfWeek === dayOfWeek)
    })

    // Map sessions with only the relevant time slots for this day
    const mapped = filtered.map((session) => ({
      ...session,
      timetable: session.timetable.filter((slot) => slot.dayOfWeek === dayOfWeek),
    }))

    setAvailableSessions(mapped)
  }

  const fetchTimeSlotBookings = async (sessionId: string, date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0]
      const response = await fetch(
        `/api/bookings/availability?sessionId=${sessionId}&date=${dateStr}`
      )
      if (!response.ok) throw new Error('Failed to fetch bookings')
      const data = await response.json()
      
      // Create a map of timeSlotId -> booking count
      const bookingsMap: Record<string, number> = {}
      data.forEach((booking: any) => {
        const key = `${booking.startTime}-${booking.endTime}`
        bookingsMap[key] = (bookingsMap[key] || 0) + 1
      })
      
      setTimeSlotBookings(bookingsMap)
    } catch (error) {
      console.error('Error fetching time slot bookings:', error)
      setTimeSlotBookings({})
    }
  }

  const handleSessionClick = async (session: Session) => {
    setSelectedSession(session)
    await fetchTimeSlotBookings(session.id, selectedDate)
  }

  const getRemainingSlots = (session: Session, timeSlot: TimeSlot) => {
    const key = `${timeSlot.startTime}-${timeSlot.endTime}`
    const bookedCount = timeSlotBookings[key] || 0
    return Math.max(0, session.slots - bookedCount)
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getWeekDays = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay() // 0 = Sunday, 1 = Monday, etc.
    // Calculate Monday of the week: if Sunday (0), go back 6 days; otherwise go back (day - 1) days
    const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1)
    
    for (let i = 0; i < 7; i++) {
      const weekDay = new Date(startOfWeek)
      weekDay.setDate(diff + i)
      week.push(weekDay)
    }
    
    return week
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setSelectedDate(newDate)
  }

  const selectDate = (date: Date) => {
    setSelectedDate(date)
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    )
  }

  const weekDays = getWeekDays(selectedDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="mobile-container w-full">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 w-full">
          <div className="mb-6 sm:mb-8">
            <Link href="/dashboard" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
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
              Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bookings</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">
              Select a date to view available sessions
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3 w-full">
            {/* Calendar - Week View */}
            <div className="lg:col-span-1 w-full min-w-0">
              <Card className="w-full overflow-hidden">
                <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs sm:text-sm md:text-base break-words flex-1 min-w-0">{weekRange}</CardTitle>
                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateWeek('prev')}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                      >
                        ‹
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateWeek('next')}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  <div className="flex gap-0.5 sm:gap-1 md:gap-1.5 w-full">
                    {weekDays.map((date, index) => {
                      const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
                      const dayNumber = date.getDate()
                      return (
                        <button
                          key={index}
                          onClick={() => selectDate(date)}
                          className={`
                            flex-1 flex flex-col items-center justify-center p-1 sm:p-1.5 md:p-2 lg:p-3 rounded-md text-[10px] sm:text-xs md:text-sm font-medium transition-colors min-h-[55px] sm:min-h-[65px] md:min-h-[75px] lg:min-h-[80px] flex-shrink-0
                            ${isSelected(date) 
                              ? 'bg-[#8B1538] text-white' 
                              : isToday(date)
                              ? 'bg-gray-200 text-gray-900'
                              : 'hover:bg-gray-100 text-gray-700 border border-gray-200'
                            }
                          `}
                        >
                          <span className="text-[9px] sm:text-[10px] md:text-xs mb-0.5 sm:mb-1 opacity-70">{dayName}</span>
                          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold">{dayNumber}</span>
                        </button>
                      )
                    })}
                  </div>
                  {selectedDate && (
                    <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 mt-2 sm:mt-3 md:mt-4 text-center break-words px-1 sm:px-2">
                      Selected: {formatDate(selectedDate)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Available Sessions */}
            <div className="lg:col-span-2 w-full min-w-0">
              <Card className="w-full overflow-hidden">
                {selectedSession ? (
                  <>
                    <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm sm:text-base md:text-lg lg:text-xl break-words">
                            {selectedSession.name}
                          </CardTitle>
                          <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">
                            {formatDate(selectedDate)}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedSession(null)}
                          className="text-gray-500 hover:text-gray-900 flex-shrink-0 p-1"
                          aria-label="Close"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 sm:h-6 sm:w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="space-y-3">
                        {selectedSession.timetable
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((timeSlot) => {
                            const remaining = getRemainingSlots(selectedSession, timeSlot)
                            const isAvailable = remaining > 0
                              return (
                                <div
                                  key={timeSlot.id}
                                  onClick={() => {
                                    const dateStr = selectedDate.toISOString().split('T')[0]
                                    router.push(`/bookings/${selectedSession.id}/${dateStr}`)
                                  }}
                                  className={`
                                    relative p-3 sm:p-4 rounded-lg border-2 transition-colors cursor-pointer hover:shadow-md w-full
                                    ${isAvailable 
                                      ? 'border-green-200 bg-green-50' 
                                      : 'border-red-200 bg-red-50'
                                    }
                                  `}
                                >
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 break-words">
                                      {timeSlot.startTime} - {timeSlot.endTime}
                                    </span>
                                    <span
                                      className={`
                                        px-3 py-1 rounded-full text-sm font-semibold
                                        ${isAvailable 
                                          ? 'bg-green-500 text-white' 
                                          : 'bg-red-500 text-white'
                                        }
                                      `}
                                    >
                                      {remaining} {remaining === 1 ? 'slot' : 'slots'} left
                                    </span>
                                  </div>
                                </div>
                              )
                          })}
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                      <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                        Available Sessions - {formatDate(selectedDate)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      {availableSessions.length === 0 ? (
                        <div className="text-center py-8 sm:py-12">
                          <p className="text-sm sm:text-base text-gray-700 mb-2 break-words px-2">
                            No sessions available for {DAYS_OF_WEEK[selectedDate.getDay()]}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600 break-words px-2">
                            Select another date to see available sessions
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 sm:space-y-4">
                          {availableSessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => handleSessionClick(session)}
                              className="border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow w-full"
                              style={{ borderLeftColor: session.themeColor, borderLeftWidth: '4px' }}
                            >
                              <div className="flex items-start justify-between mb-2 gap-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words">
                                    {session.name}
                                  </h3>
                                  {session.description && (
                                    <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">
                                      {session.description}
                                    </p>
                                  )}
                                </div>
                                <div
                                  className="w-4 h-4 rounded-full flex-shrink-0 ml-2"
                                  style={{ backgroundColor: session.themeColor }}
                                />
                              </div>
                              <div className="mt-3">
                                <p className="text-xs text-gray-600 mb-2">Available time slots:</p>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {session.timetable
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                    .map((slot) => (
                                      <span
                                        key={slot.id}
                                        className="px-2 sm:px-3 py-1 bg-gray-100 rounded-md text-xs sm:text-sm text-gray-900 whitespace-nowrap"
                                      >
                                        {slot.startTime} - {slot.endTime}
                                      </span>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-600 mt-2">
                                  Slots available: {session.slots}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
