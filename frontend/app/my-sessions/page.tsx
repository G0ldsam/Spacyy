'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { useLanguage } from '@/contexts/LanguageContext'

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

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function bookingStatusClass(s: string): string {
  if (s === 'CONFIRMED') return 'bg-green-100 text-green-800'
  if (s === 'CANCELLED') return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
}

export default function MySessionsPage() {
  const { t } = useLanguage()
  const { status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const { data: allBookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings-my'],
    queryFn: () => fetch('/api/bookings/my').then(r => r.json()),
    enabled: status === 'authenticated',
  })

  const myBookings = useMemo(() => {
    const now = new Date()
    return allBookings.filter(b => b.status !== 'CANCELLED' && new Date(b.endTime) >= now)
  }, [allBookings])

  const bookingsByDate = useMemo(() => {
    const grouped: Record<string, Booking[]> = {}
    myBookings.forEach((booking) => {
      const dateKey = toLocalDateStr(new Date(booking.startTime))
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(booking)
    })
    return grouped
  }, [myBookings])

  const getWeekDays = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
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
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setSelectedDate(newDate)
  }

  const selectDate = (date: Date) => {
    if (isPastDate(date)) return
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

  const isSelected = (date: Date) =>
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear()

  function calDayClass(date: Date): string {
    if (isPastDate(date)) return 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
    if (isSelected(date)) return 'bg-brand text-white'
    if (isToday(date)) return 'bg-gray-200 text-gray-900'
    return 'hover:bg-gray-100 text-gray-700 border border-gray-200'
  }

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const getSelectedDateBookings = () => bookingsByDate[toLocalDateStr(selectedDate)] || []

  if (status !== 'authenticated' || isLoading) return <PageSpinner />

  const weekDays = getWeekDays(selectedDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const selectedDateBookings = getSelectedDateBookings()

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="mobile-container w-full">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 w-full">
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
                {t('my_sessions.back')}
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('my_sessions.title')}</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                {t('my_sessions.subtitle')}
              </p>
            </div>
          </div>

          {myBookings.length === 0 && (
            <Link href="/book" className="block mb-6">
              <div className="rounded-2xl p-4 text-white flex items-center justify-between gap-4 shadow-md hover:shadow-lg hover:opacity-95 transition-all" style={{ background: 'var(--brand-button-gradient)' }}>
                <div>
                  <p className="font-bold text-sm leading-tight">No upcoming sessions</p>
                  <p className="text-xs opacity-75 mt-0.5">Tap to book your sessions for this month</p>
                </div>
                <div className="shrink-0 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                  Book now
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          )}

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
                      const dateKey = toLocalDateStr(date)
                      const hasBookings = bookingsByDate[dateKey] && bookingsByDate[dateKey].length > 0

                      return (
                        <button
                          key={toLocalDateStr(date)}
                          onClick={() => selectDate(date)}
                          disabled={isPastDate(date)}
                          className={`flex-1 flex flex-col items-center justify-center p-1 sm:p-1.5 md:p-2 lg:p-3 rounded-md text-[10px] sm:text-xs md:text-sm font-medium transition-colors min-h-[55px] sm:min-h-[65px] md:min-h-[75px] lg:min-h-[80px] flex-shrink-0 ${calDayClass(date)}`}
                        >
                          <span className="text-[9px] sm:text-[10px] md:text-xs mb-0.5 sm:mb-1 opacity-70">{dayName}</span>
                          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold">{dayNumber}</span>
                          {hasBookings && (
                            <span className={`mt-0.5 sm:mt-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isSelected(date) ? 'bg-white' : 'bg-brand'}`} />
                          )}
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

            {/* Bookings for Selected Date */}
            <div className="lg:col-span-2 w-full min-w-0">
              <Card className="w-full overflow-hidden">
                <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                  <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                    {t('my_sessions.sessions_on', { date: formatDate(selectedDate) })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6">
                  {selectedDateBookings.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                      <p className="text-sm sm:text-base text-gray-700 mb-2 break-words px-2">
                        {t('my_sessions.no_sessions')}
                      </p>
                      <Link href="/book" className={buttonVariants('outline', 'sm', 'text-xs sm:text-sm')}>
                        {t('my_sessions.book_link')}
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateBookings.map((booking) => (
                        <Link
                          key={booking.id}
                          href={`/my-sessions/${booking.id}`}
                          className="block w-full"
                        >
                          <div
                            className="border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow w-full"
                            style={{ borderLeftColor: booking.serviceSession?.themeColor || 'var(--brand-primary)', borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words">
                                  {booking.serviceSession?.name || 'Session'}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">
                                  {new Date(booking.startTime).toLocaleTimeString('en-US', {
                                    timeZone: 'UTC',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })} - {new Date(booking.endTime).toLocaleTimeString('en-US', {
                                    timeZone: 'UTC',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <span
                                className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${bookingStatusClass(booking.status)}`}
                              >
                                {booking.status}
                              </span>
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
        </div>
      </div>
    </div>
  )
}
