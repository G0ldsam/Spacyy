'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { PageSpinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { useLanguage } from '@/contexts/LanguageContext'

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

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function slotCapacityClass(isFull: boolean): string {
  return isFull ? 'text-red-600' : 'text-green-600'
}

function calDayClass(isPast: boolean, selected: boolean, today: boolean): string {
  if (isPast) return 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
  if (selected) return 'bg-[#8B1538] text-white'
  if (today) return 'bg-gray-200 text-gray-900'
  return 'hover:bg-gray-100 text-gray-700 border border-gray-200'
}

export default function BookPage() {
  const { t } = useLanguage()
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => fetch('/api/sessions').then(r => r.json()),
    enabled: status === 'authenticated',
  })

  const { data: allBookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['bookings-my'],
    queryFn: () => fetch('/api/bookings/my').then(r => r.json()),
    enabled: status === 'authenticated',
  })

  const myBookings = useMemo(() => {
    const now = new Date()
    return allBookings.filter(b => b.status !== 'CANCELLED' && new Date(b.endTime) >= now)
  }, [allBookings])

  const availableSessions = useMemo(() => {
    const dayOfWeek = selectedDate.getDay()
    return sessions
      .filter(s => s.timetable.some(slot => slot.dayOfWeek === dayOfWeek))
      .map(s => ({ ...s, timetable: s.timetable.filter(slot => slot.dayOfWeek === dayOfWeek) }))
  }, [sessions, selectedDate])

  const { data: slotBookedCounts = {} } = useQuery<Record<string, Record<string, number>>>({
    queryKey: ['slot-availability', availableSessions.map(s => s.id).join(','), toLocalDateStr(selectedDate)],
    queryFn: async () => {
      const dateStr = toLocalDateStr(selectedDate)
      const results = await Promise.all(
        availableSessions.map(async (s) => {
          try {
            const res = await fetch(`/api/bookings/availability?sessionId=${s.id}&date=${dateStr}`)
            if (!res.ok) return { id: s.id, countMap: {} as Record<string, number> }
            const bookings: { startTime: string; endTime: string }[] = await res.json()
            const countMap: Record<string, number> = {}
            bookings.forEach((b) => {
              const key = `${b.startTime}-${b.endTime}`
              countMap[key] = (countMap[key] || 0) + 1
            })
            return { id: s.id, countMap }
          } catch {
            return { id: s.id, countMap: {} as Record<string, number> }
          }
        })
      )
      const merged: Record<string, Record<string, number>> = {}
      results.forEach(({ id, countMap }) => { merged[id] = countMap })
      return merged
    },
    enabled: availableSessions.length > 0 && status === 'authenticated',
    staleTime: 2 * 60 * 1000,
  })

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

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const compareDate = new Date(date)
    compareDate.setHours(0, 0, 0, 0)
    return compareDate < today
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  const isSelected = (date: Date) =>
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear()

  const selectDate = (date: Date) => {
    if (!isPastDate(date)) setSelectedDate(date)
  }

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (status !== 'authenticated' || sessionsLoading || bookingsLoading) return <PageSpinner />

  const isAdmin = session?.user?.organizations?.some(o => o.role === 'OWNER' || o.role === 'ADMIN') ?? false
  const weekDays = getWeekDays(selectedDate)
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]
  const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

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
                {t('book.back')}
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('book.title')}</h1>
              <p className="text-gray-800 mt-2 text-sm sm:text-base">
                {t('book.select_date')}
              </p>
            </div>
          </div>

          {!isAdmin && (
            <Link href="/rebook" className="block mb-6">
              <div className="rounded-2xl bg-gradient-to-r from-[#8B1538] to-[#a01a42] p-4 text-white flex items-center justify-between gap-4 shadow-md hover:shadow-lg hover:opacity-95 transition-all">
                <div>
                  <p className="font-bold text-sm leading-tight">Have a session allowance?</p>
                  <p className="text-xs opacity-75 mt-0.5">Book multiple sessions at once</p>
                </div>
                <div className="shrink-0 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                  Book all at once
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          )}

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3 mb-6 w-full">
            {/* Calendar - Week View */}
            <div className="lg:col-span-1 w-full min-w-0">
              <Card className="w-full overflow-hidden">
                <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs sm:text-sm md:text-base break-words flex-1 min-w-0">{weekRange}</CardTitle>
                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                        ‹
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('next')} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                        ›
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  <div className="flex gap-0.5 sm:gap-1 md:gap-1.5 w-full">
                    {weekDays.map((date, index) => {
                      const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
                      return (
                        <button
                          key={toLocalDateStr(date)}
                          onClick={() => selectDate(date)}
                          disabled={isPastDate(date)}
                          className={`flex-1 flex flex-col items-center justify-center p-1 sm:p-1.5 md:p-2 lg:p-3 rounded-md text-[10px] sm:text-xs md:text-sm font-medium transition-colors min-h-[55px] sm:min-h-[65px] md:min-h-[75px] lg:min-h-[80px] flex-shrink-0 ${calDayClass(isPastDate(date), isSelected(date), isToday(date))}`}
                        >
                          <span className="text-[9px] sm:text-[10px] md:text-xs mb-0.5 sm:mb-1 opacity-70">{dayName}</span>
                          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold">{date.getDate()}</span>
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
                <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                  <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                    {t('book.available', { date: formatDate(selectedDate) })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6">
                  {availableSessions.length === 0 ? (
                    <div className="text-center py-8 sm:py-12">
                      <p className="text-sm sm:text-base text-gray-700 mb-2 break-words px-2">
                        {t('book.no_sessions')}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 break-words px-2">
                        {t('book.no_sessions_hint')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {availableSessions.map((sessionItem) => (
                        <Link
                          key={sessionItem.id}
                          href={`/book/${sessionItem.id}/${toLocalDateStr(selectedDate)}`}
                          className="block w-full"
                        >
                          <div
                            className="border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow w-full"
                            style={{ borderLeftColor: sessionItem.themeColor, borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words">
                                  {sessionItem.name}
                                </h3>
                                {sessionItem.description && (
                                  <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">
                                    {sessionItem.description}
                                  </p>
                                )}
                              </div>
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={{ backgroundColor: sessionItem.themeColor }}
                              />
                            </div>
                            <div className="mt-3">
                              <p className="text-xs text-gray-600 mb-2">{t('book.time_slots')}</p>
                              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {sessionItem.timetable
                                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                  .map((slot) => {
                                    const key = `${slot.startTime}-${slot.endTime}`
                                    const booked = slotBookedCounts[sessionItem.id]?.[key] ?? null
                                    const remaining = booked !== null ? sessionItem.slots - booked : null
                                    const isFull = remaining !== null && remaining <= 0
                                    return (
                                      <span
                                        key={slot.id}
                                        className="px-2 sm:px-3 py-1 bg-gray-100 rounded-md text-xs sm:text-sm text-gray-900 whitespace-nowrap flex items-center gap-1.5"
                                      >
                                        {slot.startTime} - {slot.endTime}
                                        {remaining !== null && (
                                          <span className={`font-semibold ${slotCapacityClass(isFull)}`}>
                                            {remaining}/{sessionItem.slots}
                                          </span>
                                        )}
                                      </span>
                                    )
                                  })}
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
          <Card className="w-full overflow-hidden">
            <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
              <CardTitle className="text-sm sm:text-base md:text-lg">{t('book.my_bookings')}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              {myBookings.length === 0 ? (
                <p className="text-center text-sm sm:text-base text-gray-700 py-8">{t('book.no_bookings')}</p>
              ) : (
                <div className="space-y-3">
                  {myBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-gray-200 rounded-lg p-3 sm:p-4 w-full"
                      style={{ borderLeftColor: booking.serviceSession?.themeColor || '#8B1538', borderLeftWidth: '4px' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words">
                            {booking.serviceSession?.name || 'Session'}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">
                            {new Date(booking.startTime).toLocaleDateString('en-US', {
                              timeZone: 'UTC',
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-700 break-words">
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
                        <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 bg-green-100 text-green-800">
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
