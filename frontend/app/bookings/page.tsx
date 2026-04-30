'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DAYS_OF_WEEK } from '@/shared/types/session'
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
  client: { id: string; name: string; email: string }
  startTime: string
  endTime: string
  status: string
  checkedIn: boolean
  checkedInAt: string | null
  userId: string | null
}

interface SlotException {
  id: string
  reason: string | null
}

interface InterestEntry {
  id: string
  client: { name: string; email: string }
  notifiedAt: string | null
}

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function BookingsPage() {
  const { t } = useLanguage()
  const { data: session, status } = useSession()
  const router = useRouter()

  // — calendar / session list —
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [availableSessions, setAvailableSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set())
  // sessionId → "HH:mm-HH:mm" → count
  const [slotBookedCounts, setSlotBookedCounts] = useState<Record<string, Record<string, number>>>({})
  // sessionId → "HH:mm-HH:mm" → Booking[]
  const [slotBookings, setSlotBookings] = useState<Record<string, Record<string, Booking[]>>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  // — detail panel —
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null)
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [exceptions, setExceptions] = useState<Record<string, SlotException>>({})
  const [interestLists, setInterestLists] = useState<Record<string, InterestEntry[]>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  // — modal / action state —
  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [action, setAction] = useState<'assign' | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [closingSlotId, setClosingSlotId] = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [closingSaving, setClosingSaving] = useState(false)
  const [notifyingSlotId, setNotifyingSlotId] = useState<string | null>(null)

  const isAdmin = session?.user?.organizations?.some(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  // — effects —
  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') fetchSessions()
  }, [status, router])

  useEffect(() => {
    if (sessions.length > 0) {
      filterSessionsByDate()
      if (selectedSession) { setSelectedSession(null); setSelectedTimeSlot(null) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, sessions])

  useEffect(() => {
    const week = getWeekDays(selectedDate)
    const start = toLocalDateStr(week[0])
    const end = toLocalDateStr(week[6])
    fetch(`/api/bookings/dates?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => { if (data.dates) setBookedDates(new Set(data.dates)) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  useEffect(() => {
    if (availableSessions.length > 0) fetchAllSlotAvailability(availableSessions, selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSessions, selectedDate])

  // — data fetchers —
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      if (!res.ok) throw new Error()
      setSessions(await res.json())
    } catch {
      console.error('Failed to fetch sessions')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllSlotAvailability = async (sessionsToFetch: Session[], date: Date) => {
    setAvailabilityLoading(true)
    const dateStr = toLocalDateStr(date)
    const results = await Promise.all(
      sessionsToFetch.map(async (s) => {
        try {
          const res = await fetch(`/api/bookings/availability?sessionId=${s.id}&date=${dateStr}`)
          if (!res.ok) return { id: s.id, countMap: {} as Record<string, number>, bookingsMap: {} as Record<string, Booking[]> }
          const list: Booking[] = await res.json()
          const countMap: Record<string, number> = {}
          const bookingsMap: Record<string, Booking[]> = {}
          list.forEach((b) => {
            const key = `${b.startTime}-${b.endTime}`
            countMap[key] = (countMap[key] || 0) + 1
            if (!bookingsMap[key]) bookingsMap[key] = []
            bookingsMap[key].push(b)
          })
          return { id: s.id, countMap, bookingsMap }
        } catch {
          return { id: s.id, countMap: {} as Record<string, number>, bookingsMap: {} as Record<string, Booking[]> }
        }
      })
    )
    const mergedCounts: Record<string, Record<string, number>> = {}
    const mergedBookings: Record<string, Record<string, Booking[]>> = {}
    results.forEach(({ id, countMap, bookingsMap }) => {
      mergedCounts[id] = countMap
      mergedBookings[id] = bookingsMap
    })
    setSlotBookedCounts(mergedCounts)
    setSlotBookings(mergedBookings)
    setAvailabilityLoading(false)
  }

  const refreshSession = async (sessionId: string) => {
    const dateStr = toLocalDateStr(selectedDate)
    try {
      const res = await fetch(`/api/bookings/availability?sessionId=${sessionId}&date=${dateStr}`)
      if (!res.ok) return
      const list: Booking[] = await res.json()
      const countMap: Record<string, number> = {}
      const bookingsMap: Record<string, Booking[]> = {}
      list.forEach((b) => {
        const key = `${b.startTime}-${b.endTime}`
        countMap[key] = (countMap[key] || 0) + 1
        if (!bookingsMap[key]) bookingsMap[key] = []
        bookingsMap[key].push(b)
      })
      setSlotBookedCounts((prev) => ({ ...prev, [sessionId]: countMap }))
      setSlotBookings((prev) => ({ ...prev, [sessionId]: bookingsMap }))
    } catch {}
  }

  // — session/date helpers —
  const filterSessionsByDate = () => {
    const dow = selectedDate.getDay()
    const filtered = sessions.filter((s) => s.timetable.some((sl) => sl.dayOfWeek === dow))
    setAvailableSessions(filtered.map((s) => ({ ...s, timetable: s.timetable.filter((sl) => sl.dayOfWeek === dow) })))
  }

  const handleSessionClick = async (sess: Session) => {
    setSelectedSession(sess)
    setSelectedTimeSlot(null)
    setExceptions({})
    setInterestLists({})
    setDetailLoading(true)
    const dateStr = toLocalDateStr(selectedDate)
    const daySlots = sess.timetable.filter((sl) => sl.dayOfWeek === selectedDate.getDay())
    const [clientsRes, exceptionsRes, ...interestResults] = await Promise.all([
      fetch('/api/clients'),
      fetch(`/api/sessions/${sess.id}/exceptions?date=${dateStr}`),
      ...daySlots.map((sl) =>
        fetch(`/api/interest?sessionId=${sess.id}&timeSlotId=${sl.id}&date=${dateStr}`)
          .then((r) => (r.ok ? r.json().then((entries) => ({ slotId: sl.id, entries })) : null))
          .catch(() => null)
      ),
    ])
    if (clientsRes.ok) setClients(await clientsRes.json())
    if (exceptionsRes.ok) setExceptions(await exceptionsRes.json())
    const newInterests: Record<string, InterestEntry[]> = {}
    interestResults.forEach((result) => {
      if (result) newInterests[result.slotId] = result.entries
    })
    setInterestLists(newInterests)
    setDetailLoading(false)
  }

  // — action handlers —
  const handleTimeSlotClick = (timeSlot: TimeSlot) => {
    setSelectedTimeSlot((prev) => (prev?.id === timeSlot.id ? null : timeSlot))
    setShowModal(false)
    setAction(null)
    setSelectedClientId('')
    setSelectedBooking(null)
  }

  const handleCheckIn = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/admin/check-in/booking/${bookingId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      if (selectedSession) refreshSession(selectedSession.id)
    } catch (error: any) { alert(error.message || 'Failed to check in client') }
  }

  const handleAssign = async () => {
    if (!selectedClientId || !selectedTimeSlot || !selectedSession) return
    try {
      const [sh, sm] = selectedTimeSlot.startTime.split(':').map(Number)
      const [eh, em] = selectedTimeSlot.endTime.split(':').map(Number)
      const dateStr = toLocalDateStr(selectedDate)
      const startTime = new Date(`${dateStr}T00:00:00Z`)
      startTime.setUTCHours(sh, sm, 0, 0)
      const endTime = new Date(`${dateStr}T00:00:00Z`)
      endTime.setUTCHours(eh, em, 0, 0)
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession.id, clientId: selectedClientId, startTime: startTime.toISOString(), endTime: endTime.toISOString() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      setShowModal(false); setAction(null); setSelectedClientId(''); setSelectedBooking(null)
      refreshSession(selectedSession.id)
    } catch (error: any) { alert(error.message || 'Failed to assign client') }
  }

  const handleCancel = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) })
      if (!res.ok) throw new Error('Failed to cancel')
      setShowModal(false); setSelectedBooking(null)
      if (selectedSession) refreshSession(selectedSession.id)
    } catch (error: any) { alert(error.message || 'Failed to cancel booking') }
  }

  const handleEmpty = async () => {
    if (!selectedTimeSlot || !selectedSession) return
    const key = `${selectedTimeSlot.startTime}-${selectedTimeSlot.endTime}`
    const active = (slotBookings[selectedSession.id]?.[key] || []).filter((b) => b.status !== 'CANCELLED')
    if (active.length === 0) { alert('Slot already empty'); return }
    try {
      await Promise.all(active.map((b) =>
        fetch(`/api/bookings/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) })
      ))
      setSelectedTimeSlot(null)
      refreshSession(selectedSession.id)
    } catch (error: any) { alert(error.message || 'Failed to empty slot') }
  }

  const handleCloseOccurrence = async (timeSlot: TimeSlot) => {
    if (!selectedSession) return
    setClosingSaving(true)
    try {
      const res = await fetch(`/api/sessions/${selectedSession.id}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlotId: timeSlot.id, date: toLocalDateStr(selectedDate), reason: closeReason.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to close')
      const { exception, cancelledCount } = await res.json()
      setExceptions((prev) => ({ ...prev, [timeSlot.id]: exception }))
      setClosingSlotId(null); setCloseReason('')
      if (cancelledCount > 0) refreshSession(selectedSession.id)
    } catch (error: any) { alert(error.message || 'Failed to close occurrence') }
    finally { setClosingSaving(false) }
  }

  const handleReopen = async (timeSlotId: string) => {
    if (!selectedSession) return
    const exc = exceptions[timeSlotId]
    if (!exc) return
    try {
      const res = await fetch(`/api/sessions/${selectedSession.id}/exceptions/${exc.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to reopen')
      setExceptions((prev) => { const n = { ...prev }; delete n[timeSlotId]; return n })
    } catch (error: any) { alert(error.message || 'Failed to reopen') }
  }

  const handleNotifyAll = async (timeSlot: TimeSlot) => {
    if (!selectedSession) return
    setNotifyingSlotId(timeSlot.id)
    try {
      const dateStr = toLocalDateStr(selectedDate)
      const res = await fetch('/api/interest/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession.id, timeSlotId: timeSlot.id, date: dateStr }),
      })
      if (!res.ok) throw new Error('Failed to notify')
      const { notifiedCount } = await res.json()
      const slotRes = await fetch(`/api/interest?sessionId=${selectedSession.id}&timeSlotId=${timeSlot.id}&date=${dateStr}`)
      if (slotRes.ok) { const updated = await slotRes.json(); setInterestLists((prev) => ({ ...prev, [timeSlot.id]: updated })) }
      alert(`Notifications sent to ${notifiedCount} client${notifiedCount !== 1 ? 's' : ''}.`)
    } catch (error: any) { alert(error.message || 'Failed to send notifications') }
    finally { setNotifyingSlotId(null) }
  }

  // — calendar helpers —
  const getWeekDays = (date: Date) => {
    const week = []
    const start = new Date(date)
    const day = start.getDay()
    const diff = start.getDate() - (day === 0 ? 6 : day - 1)
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(diff + i)
      week.push(d)
    }
    return week
  }

  const navigateWeek = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + (dir === 'next' ? 7 : -7))
    setSelectedDate(d)
  }

  const isToday = (d: Date) => {
    const t = new Date()
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
  }
  const isDateSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
  const hasBookings = (d: Date) => bookedDates.has(toLocalDateStr(d))
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (status === 'loading' || loading) return <PageSpinner />

  const weekDays = getWeekDays(selectedDate)
  const weekRange = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="mobile-container w-full">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 w-full">
          <div className="mb-6 sm:mb-8">
            <Link href="/dashboard" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {t('bookings.back')}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('bookings.title')}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">{t('bookings.select_date')}</p>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3 w-full">
            {/* Calendar */}
            <div className="lg:col-span-1 w-full min-w-0">
              <Card className="w-full overflow-hidden">
                <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xs sm:text-sm md:text-base break-words flex-1 min-w-0">{weekRange}</CardTitle>
                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')} className="h-7 w-7 sm:h-8 sm:w-8 p-0">‹</Button>
                      <Button variant="outline" size="sm" onClick={() => navigateWeek('next')} className="h-7 w-7 sm:h-8 sm:w-8 p-0">›</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                  <div className="flex gap-0.5 sm:gap-1 md:gap-1.5 w-full">
                    {weekDays.map((date, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(date)}
                        className={`flex-1 flex flex-col items-center justify-center p-1 sm:p-1.5 md:p-2 rounded-md text-[10px] sm:text-xs font-medium transition-colors min-h-[55px] sm:min-h-[65px] md:min-h-[75px] ${
                          isDateSelected(date) ? 'bg-[#8B1538] text-white' : isToday(date) ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        <span className="text-[9px] sm:text-[10px] mb-0.5 opacity-70">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                        <span className="text-xs sm:text-base font-semibold">{date.getDate()}</span>
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${hasBookings(date) ? isDateSelected(date) ? 'bg-white' : 'bg-[#8B1538]' : 'invisible'}`} />
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-700 mt-2 sm:mt-3 text-center">{t('bookings.selected', { date: formatDate(selectedDate) }) || `Selected: ${formatDate(selectedDate)}`}</p>
                </CardContent>
              </Card>
            </div>

            {/* Sessions panel */}
            <div className="lg:col-span-2 w-full min-w-0">
              <Card className="w-full overflow-hidden">
                {selectedSession ? (
                  <>
                    <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm sm:text-base md:text-lg lg:text-xl break-words">{selectedSession.name}</CardTitle>
                          <p className="text-xs sm:text-sm text-gray-700 mt-1">{formatDate(selectedDate)}</p>
                        </div>
                        <button
                          onClick={() => { setSelectedSession(null); setSelectedTimeSlot(null) }}
                          className="text-gray-500 hover:text-gray-900 flex-shrink-0 p-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                      {availabilityLoading || detailLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="w-6 h-6 border-2 border-[#8B1538] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedSession.timetable
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((timeSlot) => {
                              const key = `${timeSlot.startTime}-${timeSlot.endTime}`
                              const activeBookings = (slotBookings[selectedSession.id]?.[key] || []).filter((b) => b.status !== 'CANCELLED')
                              const remaining = Math.max(0, selectedSession.slots - activeBookings.length)
                              const isExpanded = selectedTimeSlot?.id === timeSlot.id
                              const exception = exceptions[timeSlot.id]
                              const isClosed = !!exception
                              const isClosing = closingSlotId === timeSlot.id

                              return (
                                <div key={timeSlot.id}>
                                  {/* Time slot row */}
                                  <div
                                    onClick={() => !isClosed && handleTimeSlotClick(timeSlot)}
                                    className={[
                                      'relative p-3 sm:p-4 rounded-lg border-2 transition-colors w-full',
                                      isClosed ? 'border-red-200 bg-red-50 cursor-default' :
                                      isExpanded ? 'border-[#8B1538] bg-[#8B1538]/5 cursor-pointer' :
                                      remaining > 0 ? 'border-green-200 bg-green-50 cursor-pointer hover:shadow-md' :
                                      'border-red-200 bg-red-50 cursor-pointer hover:shadow-md',
                                    ].join(' ')}
                                  >
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm sm:text-base font-semibold text-gray-900">
                                            {timeSlot.startTime} - {timeSlot.endTime}
                                          </span>
                                          {isClosed && (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                                              {t('booking_slot.closed')}
                                            </span>
                                          )}
                                        </div>
                                        {!isClosed ? (
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-gray-600">
                                              {activeBookings.length}/{selectedSession.slots}{' '}
                                              {activeBookings.length === 1 ? 'booking' : 'bookings'}
                                            </span>
                                            {activeBookings.length > 0 && (
                                              <>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-green-700 font-medium">
                                                  {t('booking_slot.checked_in_count', { count: activeBookings.filter((b) => b.checkedIn).length })}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-red-600 mt-1">
                                            {exception.reason ? t('booking_slot.reason', { reason: exception.reason }) : t('booking_slot.cancelled')}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                        {isAdmin && (
                                          isClosed ? (
                                            <button onClick={() => handleReopen(timeSlot.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
                                              {t('booking_slot.reopen')}
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => { setClosingSlotId(isClosing ? null : timeSlot.id); setCloseReason('') }}
                                              className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
                                            >
                                              {isClosing ? t('booking_slot.cancel_slot') : t('booking_slot.close_occurrence')}
                                            </button>
                                          )
                                        )}
                                        {!isClosed && (
                                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${remaining > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                            {t(remaining === 1 ? 'bookings.slots_left_one' : 'bookings.slots_left_other', { count: remaining })}
                                          </span>
                                        )}
                                        {!isClosed && (
                                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>

                                    {/* Inline close form */}
                                    {isClosing && !isClosed && (
                                      <div onClick={(e) => e.stopPropagation()} className="mt-3 pt-3 border-t border-red-200 space-y-2">
                                        <input
                                          type="text"
                                          placeholder={t('booking_slot.reason_placeholder')}
                                          value={closeReason}
                                          onChange={(e) => setCloseReason(e.target.value)}
                                          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                                        />
                                        <div className="flex gap-2">
                                          <Button size="sm" disabled={closingSaving} onClick={() => handleCloseOccurrence(timeSlot)} className="bg-red-600 hover:bg-red-700 text-white flex-1">
                                            {closingSaving ? 'Closing…' : t('booking_slot.close_confirm')}
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => { setClosingSlotId(null); setCloseReason('') }} className="flex-1">
                                            {t('booking_slot.cancel_slot')}
                                          </Button>
                                        </div>
                                        {activeBookings.length > 0 && (
                                          <p className="text-xs text-red-600">
                                            {t(activeBookings.length === 1 ? 'booking_slot.close_cancel_warning_one' : 'booking_slot.close_cancel_warning_other', { count: activeBookings.length })}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Expanded booking list */}
                                  {isExpanded && !isClosed && (
                                    <div className="mt-1 ml-3 border-l-2 border-gray-200 pl-3 space-y-2 pb-1">
                                      {activeBookings.map((booking) => (
                                        <div
                                          key={booking.id}
                                          className={`text-sm rounded px-3 py-2 flex items-center justify-between gap-2 ${booking.checkedIn ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}
                                        >
                                          <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => { setSelectedBooking(booking); setShowModal(true); setAction(null) }}
                                          >
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-gray-900 font-medium">{booking.client.name}</span>
                                              {booking.checkedIn ? (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{t('booking_slot.checked_in_badge')}</span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{t('booking_slot.pending')}</span>
                                              )}
                                            </div>
                                            <span className="text-xs text-gray-600 block mt-0.5">{booking.client.email}</span>
                                            {booking.checkedIn && booking.checkedInAt && (
                                              <span className="text-xs text-green-700 block mt-0.5">
                                                {t('booking_slot.checked_in_at', { time: new Date(booking.checkedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) })}
                                              </span>
                                            )}
                                          </div>
                                          {!booking.checkedIn && (
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCheckIn(booking.id) }} className="flex-shrink-0 text-xs">
                                              {t('booking_slot.check_in_btn')}
                                            </Button>
                                          )}
                                        </div>
                                      ))}

                                      {/* Empty slots — click to assign */}
                                      {Array.from({ length: remaining }).map((_, i) => (
                                        <div
                                          key={`empty-${i}`}
                                          onClick={() => { setSelectedBooking(null); setShowModal(true); setAction('assign') }}
                                          className="text-sm text-gray-600 py-2 cursor-pointer hover:text-gray-900 border border-dashed border-gray-300 rounded px-3 hover:border-gray-400 transition-colors"
                                        >
                                          {t('booking_slot.empty_slot')}
                                        </div>
                                      ))}

                                      {activeBookings.length > 0 && (
                                        <div
                                          onClick={() => { if (confirm(t('booking_slot.cancel_all', { count: activeBookings.length }))) handleEmpty() }}
                                          className="text-sm text-red-600 py-2 cursor-pointer hover:text-red-800 font-medium"
                                        >
                                          {t('booking_slot.make_empty')}
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
                                              {remaining > 0 && (
                                                <button
                                                  onClick={() => handleNotifyAll(timeSlot)}
                                                  disabled={notifyingSlotId === timeSlot.id}
                                                  className="text-xs font-semibold text-[#8B1538] hover:text-[#6d1029] disabled:opacity-50"
                                                >
                                                  {notifyingSlotId === timeSlot.id ? 'Sending…' : `Notify all (${remaining} spot${remaining !== 1 ? 's' : ''} open)`}
                                                </button>
                                              )}
                                            </div>
                                            <div className="space-y-1">
                                              {interested.map((entry) => (
                                                <div key={entry.id} className="flex items-center justify-between text-xs text-gray-700 px-2 py-1.5 bg-gray-50 rounded">
                                                  <span>{entry.client.name} <span className="text-gray-400">{entry.client.email}</span></span>
                                                  {entry.notifiedAt && <span className="text-green-600 ml-2 shrink-0">Notified</span>}
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
                  </>
                ) : (
                  <>
                    <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                      <CardTitle className="text-sm sm:text-base md:text-lg break-words">
                        {t('bookings.available', { date: formatDate(selectedDate) })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      {availableSessions.length === 0 ? (
                        <div className="text-center py-8 sm:py-12">
                          <p className="text-sm sm:text-base text-gray-700 mb-2 break-words px-2">{t('bookings.no_sessions', { day: DAYS_OF_WEEK[selectedDate.getDay()] })}</p>
                          <p className="text-xs sm:text-sm text-gray-600 break-words px-2">{t('bookings.no_sessions_hint')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 sm:space-y-4">
                          {availableSessions.map((sess) => (
                            <div
                              key={sess.id}
                              onClick={() => handleSessionClick(sess)}
                              className="border border-gray-200 rounded-lg p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow w-full"
                              style={{ borderLeftColor: sess.themeColor, borderLeftWidth: '4px' }}
                            >
                              <div className="flex items-start justify-between mb-2 gap-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-base sm:text-lg text-gray-900 break-words">{sess.name}</h3>
                                  {sess.description && <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">{sess.description}</p>}
                                </div>
                                <div className="w-4 h-4 rounded-full flex-shrink-0 ml-2" style={{ backgroundColor: sess.themeColor }} />
                              </div>
                              <div className="mt-3">
                                <p className="text-xs text-gray-600 mb-2">{t('bookings.time_slots')}</p>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {sess.timetable
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                    .map((slot) => {
                                      const key = `${slot.startTime}-${slot.endTime}`
                                      const booked = slotBookedCounts[sess.id]?.[key] ?? null
                                      const rem = booked !== null ? sess.slots - booked : null
                                      const isFull = rem !== null && rem <= 0
                                      return (
                                        <span key={slot.id} className="px-2 sm:px-3 py-1 bg-gray-100 rounded-md text-xs sm:text-sm text-gray-900 whitespace-nowrap flex items-center gap-1.5">
                                          {slot.startTime} - {slot.endTime}
                                          {rem !== null && (
                                            <span className={`font-semibold ${isFull ? 'text-red-600' : 'text-green-600'}`}>{rem}/{sess.slots}</span>
                                          )}
                                        </span>
                                      )
                                    })}
                                </div>
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

      {/* Booking action modal */}
      {showModal && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}</h2>
                {selectedBooking && <p className="text-sm text-gray-700 mt-1">{selectedBooking.client.name} ({selectedBooking.client.email})</p>}
              </div>
              <button onClick={() => { setShowModal(false); setAction(null); setSelectedBooking(null) }} className="text-gray-500 hover:text-gray-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {!action ? (
                <div className="space-y-2">
                  {selectedBooking ? (
                    <Button variant="destructive" className="w-full" onClick={() => { if (confirm('Cancel this booking?')) handleCancel(selectedBooking.id) }}>
                      Cancel Booking
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => setAction('assign')}>Assign a Client</Button>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => { setShowModal(false); setAction(null); setSelectedBooking(null) }}>Close</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2 block">Select Client</label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full h-12 rounded-md border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538]"
                    >
                      <option value="">Choose a client…</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setAction(null); setSelectedClientId('') }}>Back</Button>
                    <Button className="flex-1" onClick={handleAssign} disabled={!selectedClientId}>Assign</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
