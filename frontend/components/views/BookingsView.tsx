'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { PageSpinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DAYS_OF_WEEK } from '@/shared/types/session'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  useSessions,
  useClients,
  useMultipleAvailability,
  useBookedDates,
  useExceptions,
  useMultipleInterestLists,
  useCheckIn,
  useCreateBooking,
  useCancelBooking,
  useCloseOccurrence,
  useReopenOccurrence,
  useNotifyInterestList,
} from '@/hooks/useBookingsData'
import WaitlistNotifyModal from '@/components/WaitlistNotifyModal'

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
  client: { id: string; name: string; email: string } | null
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

interface Props {
  onBack?: () => void
}

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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

export default function BookingsView({ onBack }: Props) {
  const { t } = useLanguage()
  const { data: session, status } = useSession()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [action, setAction] = useState<'assign' | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [closingSlotId, setClosingSlotId] = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistModalData, setWaitlistModalData] = useState<{
    sessionId: string
    sessionName: string
    themeColor: string
    timeSlotId: string
    startTime: string
    endTime: string
    date: string
    entries: InterestEntry[]
  } | null>(null)

  const isAdmin = session?.user?.organizations?.some(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  const { data: sessions = [], isLoading: sessionsLoading } = useSessions()
  const { data: clients = [] } = useClients()

  const availableSessions = useMemo(() => {
    const dow = selectedDate.getDay()
    return sessions
      .filter((s) => s.timetable.some((sl) => sl.dayOfWeek === dow))
      .map((s) => ({ ...s, timetable: s.timetable.filter((sl) => sl.dayOfWeek === dow) }))
  }, [sessions, selectedDate])

  const dateStr = toLocalDateStr(selectedDate)
  const availabilityQueries = useMultipleAvailability(availableSessions, dateStr)
  const availabilityLoading = availabilityQueries.some((q) => q.isLoading)

  const { slotBookedCounts, slotBookings } = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {}
    const bookings: Record<string, Record<string, Booking[]>> = {}

    availableSessions.forEach((session, index) => {
      const queryData = availabilityQueries[index]?.data as Booking[] | undefined
      if (!queryData) return

      const countMap: Record<string, number> = {}
      const bookingsMap: Record<string, Booking[]> = {}

      queryData.forEach((b) => {
        const key = `${b.startTime}-${b.endTime}`
        countMap[key] = (countMap[key] || 0) + 1
        if (!bookingsMap[key]) bookingsMap[key] = []
        bookingsMap[key].push(b)
      })

      counts[session.id] = countMap
      bookings[session.id] = bookingsMap
    })

    return { slotBookedCounts: counts, slotBookings: bookings }
  }, [availableSessions, availabilityQueries])

  const weekDays = getWeekDays(selectedDate)
  const weekStart = toLocalDateStr(weekDays[0])
  const weekEnd = toLocalDateStr(weekDays[6])
  const { data: bookedDatesArray = [] } = useBookedDates(weekStart, weekEnd)
  const bookedDates = useMemo(() => new Set(bookedDatesArray), [bookedDatesArray])

  const { data: exceptions = {} } = useExceptions(selectedSession?.id || '', dateStr)

  const daySlots = selectedSession?.timetable.filter((sl) => sl.dayOfWeek === selectedDate.getDay()) || []
  const interestQueries = useMultipleInterestLists(selectedSession?.id || '', daySlots, dateStr)
  const interestLists = useMemo(() => {
    const lists: Record<string, InterestEntry[]> = {}
    daySlots.forEach((slot, index) => {
      const data = interestQueries[index]?.data as InterestEntry[] | undefined
      if (data) lists[slot.id] = data
    })
    return lists
  }, [daySlots, interestQueries])

  const detailLoading = interestQueries.some((q) => q.isLoading)

  const checkInMutation = useCheckIn()
  const createBookingMutation = useCreateBooking()
  const cancelBookingMutation = useCancelBooking()
  const closeOccurrenceMutation = useCloseOccurrence()
  const reopenOccurrenceMutation = useReopenOccurrence()
  const notifyInterestMutation = useNotifyInterestList()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (selectedSession) {
      setSelectedSession(null)
      setSelectedTimeSlot(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const handleSessionClick = (sess: Session) => {
    setSelectedSession(sess)
    setSelectedTimeSlot(null)
  }

  const handleTimeSlotClick = (timeSlot: TimeSlot) => {
    setSelectedTimeSlot((prev) => (prev?.id === timeSlot.id ? null : timeSlot))
    setShowModal(false)
    setAction(null)
    setSelectedClientId('')
    setSelectedBooking(null)
  }

  const handleCheckIn = async (bookingId: string) => {
    try {
      await checkInMutation.mutateAsync(bookingId)
    } catch (error: any) {
      alert(error.message || 'Failed to check in client')
    }
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

      const isReserved = selectedClientId === '__reserved__'
      await createBookingMutation.mutateAsync({
        sessionId: selectedSession.id,
        ...(isReserved ? {} : { clientId: selectedClientId }),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })

      setShowModal(false)
      setAction(null)
      setSelectedClientId('')
      setSelectedBooking(null)
    } catch (error: any) {
      alert(error.message || 'Failed to assign client')
    }
  }

  const handleCancel = async (bookingId: string) => {
    try {
      await cancelBookingMutation.mutateAsync(bookingId)
      setShowModal(false)
      setSelectedBooking(null)

      // Check if waitlist exists for this slot
      if (selectedSession && selectedTimeSlot) {
        const key = `${selectedTimeSlot.startTime}-${selectedTimeSlot.endTime}`
        const waitlist = interestLists[selectedSession.id]?.[key] || []
        if (waitlist.length > 0) {
          setWaitlistModalData({
            sessionId: selectedSession.id,
            sessionName: selectedSession.name,
            themeColor: selectedSession.themeColor,
            timeSlotId: selectedTimeSlot.id,
            startTime: selectedTimeSlot.startTime,
            endTime: selectedTimeSlot.endTime,
            date: toLocalDateStr(selectedDate),
            entries: waitlist,
          })
          setWaitlistModalOpen(true)
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to cancel booking')
    }
  }

  const handleEmpty = async () => {
    if (!selectedTimeSlot || !selectedSession) return
    const key = `${selectedTimeSlot.startTime}-${selectedTimeSlot.endTime}`
    const active = (slotBookings[selectedSession.id]?.[key] || []).filter((b) => b.status !== 'CANCELLED')
    if (active.length === 0) {
      alert('Slot already empty')
      return
    }
    try {
      await Promise.all(active.map((b) => cancelBookingMutation.mutateAsync(b.id)))
      setSelectedTimeSlot(null)
    } catch (error: any) {
      alert(error.message || 'Failed to empty slot')
    }
  }

  const handleCloseOccurrence = async (timeSlot: TimeSlot) => {
    if (!selectedSession) return
    try {
      await closeOccurrenceMutation.mutateAsync({
        sessionId: selectedSession.id,
        timeSlotId: timeSlot.id,
        date: toLocalDateStr(selectedDate),
        reason: closeReason.trim() || null,
      })
      setClosingSlotId(null)
      setCloseReason('')
    } catch (error: any) {
      alert(error.message || 'Failed to close occurrence')
    }
  }

  const handleReopen = async (timeSlotId: string) => {
    if (!selectedSession) return
    const exc = exceptions[timeSlotId]
    if (!exc) return
    try {
      await reopenOccurrenceMutation.mutateAsync({
        sessionId: selectedSession.id,
        exceptionId: exc.id,
        date: toLocalDateStr(selectedDate),
      })

      // Trigger waitlist modal after reopening
      const timeSlot = selectedSession.timetable.find((ts) => ts.id === timeSlotId)
      if (timeSlot) {
        const key = `${timeSlot.startTime}-${timeSlot.endTime}`
        const waitlist = interestLists[selectedSession.id]?.[key] || []
        if (waitlist.length > 0) {
          setWaitlistModalData({
            sessionId: selectedSession.id,
            sessionName: selectedSession.name,
            themeColor: selectedSession.themeColor,
            timeSlotId: timeSlot.id,
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime,
            date: toLocalDateStr(selectedDate),
            entries: waitlist,
          })
          setWaitlistModalOpen(true)
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to reopen')
    }
  }

  const handleNotifyAll = async (timeSlot: TimeSlot) => {
    if (!selectedSession) return
    try {
      const result = await notifyInterestMutation.mutateAsync({
        sessionId: selectedSession.id,
        timeSlotId: timeSlot.id,
        date: toLocalDateStr(selectedDate),
      })
      alert(`Notifications sent to ${result.notifiedCount} client${result.notifiedCount !== 1 ? 's' : ''}.`)
    } catch (error: any) {
      alert(error.message || 'Failed to send notifications')
    }
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

  if (status === 'loading' || sessionsLoading) return <PageSpinner />

  const weekRange = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const closingSaving = closeOccurrenceMutation.isPending
  const notifyingSlotId = notifyInterestMutation.isPending ? notifyInterestMutation.variables?.timeSlotId : null

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="mobile-container w-full">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 w-full">
          <div className="mb-6 sm:mb-8">
            {onBack ? (
              <button onClick={onBack} className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {t('bookings.back')}
              </button>
            ) : (
              <Link href="/dashboard" className="inline-flex items-center text-gray-700 hover:text-gray-900 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                {t('bookings.back')}
              </Link>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('bookings.title')}</h1>
            <p className="text-gray-800 mt-2 text-sm sm:text-base">{t('bookings.select_date')}</p>
          </div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3 w-full">
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
                                    {/* Row 1: time + status badge + chevron */}
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">
                                        {timeSlot.startTime} – {timeSlot.endTime}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {isClosed ? (
                                          <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                                            {t('booking_slot.closed')}
                                          </span>
                                        ) : (
                                          <>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${remaining > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                              {t(remaining === 1 ? 'bookings.slots_left_one' : 'bookings.slots_left_other', { count: remaining })}
                                            </span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Row 2: booking stats (left) + admin action (right) */}
                                    <div className="flex items-center justify-between gap-2 mt-1.5">
                                      {isClosed ? (
                                        <p className="text-xs text-red-500 min-w-0 truncate">
                                          {exception.reason ? t('booking_slot.reason', { reason: exception.reason }) : t('booking_slot.cancelled')}
                                        </p>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                                          <span className="tabular-nums">{activeBookings.length}/{selectedSession.slots} bookings</span>
                                          {activeBookings.length > 0 && (
                                            <>
                                              <span className="text-gray-300">·</span>
                                              <span className="text-green-600 font-medium whitespace-nowrap">
                                                {t('booking_slot.checked_in_count', { count: activeBookings.filter((b) => b.checkedIn).length })}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {isAdmin && (
                                        <div className="shrink-0">
                                          {isClosed ? (
                                            <button onClick={(e) => { e.stopPropagation(); handleReopen(timeSlot.id) }} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                                              {t('booking_slot.reopen')}
                                            </button>
                                          ) : (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setClosingSlotId(isClosing ? null : timeSlot.id); setCloseReason('') }}
                                              className="text-xs text-red-400 hover:text-red-600 font-medium"
                                            >
                                              {isClosing ? t('booking_slot.cancel_slot') : t('booking_slot.close_occurrence')}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

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

                                  {isExpanded && !isClosed && (
                                    <div className="mt-1 ml-3 border-l-2 border-gray-200 pl-3 space-y-2 pb-1">
                                      {activeBookings.map((booking) => (
                                        <div
                                          key={booking.id}
                                          className={`text-sm rounded px-3 py-2 flex items-center justify-between gap-2 ${booking.status === 'RESERVED' ? 'bg-purple-50 border border-purple-200' : booking.checkedIn ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}
                                        >
                                          <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => { setSelectedBooking(booking); setShowModal(true); setAction(null) }}
                                          >
                                            {booking.status === 'RESERVED' ? (
                                              <div className="flex items-center gap-2">
                                                <span className="text-purple-700 font-medium">Reserved</span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Reserved</span>
                                              </div>
                                            ) : (
                                              <>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-gray-900 font-medium">{booking.client?.name}</span>
                                                  {booking.checkedIn ? (
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">{t('booking_slot.checked_in_badge')}</span>
                                                  ) : (
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{t('booking_slot.pending')}</span>
                                                  )}
                                                </div>
                                                <span className="text-xs text-gray-600 block mt-0.5">{booking.client?.email}</span>
                                                {booking.checkedIn && booking.checkedInAt && (
                                                  <span className="text-xs text-green-700 block mt-0.5">
                                                    {t('booking_slot.checked_in_at', { time: new Date(booking.checkedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) })}
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </div>
                                          {!booking.checkedIn && booking.status !== 'RESERVED' && (
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCheckIn(booking.id) }} className="flex-shrink-0 text-xs">
                                              {t('booking_slot.check_in_btn')}
                                            </Button>
                                          )}
                                        </div>
                                      ))}

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
                        <div className="space-y-3 sm:space-y-4 relative">
                          {availabilityLoading && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                              <div className="w-6 h-6 border-2 border-[#8B1538] border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
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
                                      const booked = slotBookedCounts[sess.id]?.[key] ?? 0
                                      const isFull = booked >= sess.slots
                                      return (
                                        <span key={slot.id} className="px-2 sm:px-3 py-1 bg-gray-100 rounded-md text-xs sm:text-sm text-gray-900 whitespace-nowrap flex items-center gap-1.5">
                                          {slot.startTime} - {slot.endTime}
                                          <span className={`font-semibold ${isFull ? 'text-red-600' : 'text-green-600'}`}>{booked}/{sess.slots}</span>
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

      {showModal && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}</h2>
                {selectedBooking?.client && <p className="text-sm text-gray-700 mt-1">{selectedBooking.client.name} ({selectedBooking.client.email})</p>}
                {selectedBooking?.status === 'RESERVED' && <p className="text-sm text-purple-700 mt-1 font-medium">Reserved slot</p>}
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
                      <option value="__reserved__">— Reserved —</option>
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

      {/* Waitlist Notify Modal */}
      {waitlistModalOpen && waitlistModalData && (
        <WaitlistNotifyModal
          open={waitlistModalOpen}
          onClose={() => {
            setWaitlistModalOpen(false)
            setWaitlistModalData(null)
          }}
          sessionName={waitlistModalData.sessionName}
          themeColor={waitlistModalData.themeColor}
          startTime={waitlistModalData.startTime}
          endTime={waitlistModalData.endTime}
          date={waitlistModalData.date}
          sessionId={waitlistModalData.sessionId}
          timeSlotId={waitlistModalData.timeSlotId}
          entries={waitlistModalData.entries}
        />
      )}
    </div>
  )
}
