'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/auth/LogoutButton'

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

interface Booking {
  id: string
  serviceSession: {
    id: string
    name: string
    themeColor: string
  } | null
  startTime: string
  endTime: string
  status: string
}

export default function BookPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [sessions, setSessions] = useState<Session[]>([])
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [availableSessions, setAvailableSessions] = useState<Session[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchSessions()
      fetchMyBookings()
    }
  }, [status, router])

  useEffect(() => {
    // Reset to today if selected date is in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selected = new Date(selectedDate)
    selected.setHours(0, 0, 0, 0)
    if (selected < today) {
      setSelectedDate(new Date())
      return
    }
    if (sessions.length > 0) {
      filterSessionsByDate()
    }
  }, [selectedDate, sessions])

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

  const fetchMyBookings = async () => {
    try {
      const response = await fetch('/api/bookings/my')
      if (response.ok) {
        const data = await response.json()
        setMyBookings(data)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    }
  }

  const filterSessionsByDate = () => {
    const dayOfWeek = selectedDate.getDay()
    
    const filtered = sessions.filter((session) => {
      return session.timetable.some((slot) => slot.dayOfWeek === dayOfWeek)
    })

    const mapped = filtered.map((session) => ({
      ...session,
      timetable: session.timetable.filter((slot) => slot.dayOfWeek === dayOfWeek),
    }))

    setAvailableSessions(mapped)
  }

  const getWeekDays = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    
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
    // Prevent selecting past dates
    if (isPastDate(date)) {
      return
    }
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

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate < today
  }

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  const formatDate = (date: Date) => {
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

  const weekDays = getWeekDays(selectedDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mobile-container">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8 relative">
            <div className="absolute top-0 right-0">
              <LogoutButton />
            </div>
            <div>
              <Link href="/home" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
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
                Back to Home
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Book a Session</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                Select a date to view available sessions
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            {/* Calendar - Week View */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{weekRange}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateWeek('prev')}
                      >
                        ‹
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateWeek('next')}
                      >
                        ›
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1">
                    {weekDays.map((date, index) => {
                      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index]
                      const dayNumber = date.getDate()
                      return (
                        <button
                          key={index}
                          onClick={() => selectDate(date)}
                          disabled={isPastDate(date)}
                          className={`
                            flex-1 flex flex-col items-center justify-center p-3 rounded-md text-sm font-medium transition-colors min-h-[80px]
                            ${isPastDate(date)
                              ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
                              : isSelected(date) 
                              ? 'bg-[#8B1538] text-white' 
                              : isToday(date)
                              ? 'bg-gray-200 text-gray-900'
                              : 'hover:bg-gray-100 text-gray-700 border border-gray-200'
                            }
                          `}
                        >
                          <span className="text-xs mb-1 opacity-70">{dayName}</span>
                          <span className="text-lg font-semibold">{dayNumber}</span>
                        </button>
                      )
                    })}
                  </div>
                  {selectedDate && (
                    <p className="text-sm text-gray-700 mt-4 text-center">
                      Selected: {formatDate(selectedDate)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Available Sessions */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Available Sessions - {formatDate(selectedDate)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {availableSessions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-700 mb-2">
                        No sessions available for this day
                      </p>
                      <p className="text-sm text-gray-600">
                        Select another date to see available sessions
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {availableSessions.map((sessionItem) => (
                        <Link
                          key={sessionItem.id}
                          href={`/book/${sessionItem.id}/${selectedDate.toISOString().split('T')[0]}`}
                        >
                          <div
                            className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                            style={{ borderLeftColor: sessionItem.themeColor, borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-semibold text-lg text-gray-900">
                                  {sessionItem.name}
                                </h3>
                                {sessionItem.description && (
                                  <p className="text-sm text-gray-700 mt-1">
                                    {sessionItem.description}
                                  </p>
                                )}
                              </div>
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0 ml-2"
                                style={{ backgroundColor: sessionItem.themeColor }}
                              />
                            </div>
                            <div className="mt-3">
                              <p className="text-xs text-gray-600 mb-2">Available time slots:</p>
                              <div className="flex flex-wrap gap-2">
                                {sessionItem.timetable
                                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                  .map((slot) => (
                                    <span
                                      key={slot.id}
                                      className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-900"
                                    >
                                      {slot.startTime} - {slot.endTime}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* My Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>My Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {myBookings.length === 0 ? (
                <p className="text-center text-gray-700 py-8">No bookings yet</p>
              ) : (
                <div className="space-y-3">
                  {myBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-gray-200 rounded-lg p-4"
                      style={{ borderLeftColor: booking.serviceSession?.themeColor || '#8B1538', borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">
                            {booking.serviceSession?.name || 'Session'}
                          </h3>
                          <p className="text-sm text-gray-700 mt-1">
                            {new Date(booking.startTime).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-gray-700">
                            {new Date(booking.startTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} - {new Date(booking.endTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            booking.status === 'CONFIRMED'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
