import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getCachedSessions } from '@/lib/cache'
import { getTenantContext } from '@/lib/api-helpers'
import { redirect } from 'next/navigation'
import { BookingHub } from '@/components/booking/BookingHub'

export const dynamic = 'force-dynamic'

export type Suggestion = {
  id: string
  sessionId: string
  sessionName: string
  themeColor: string
  startTime: string
  endTime: string
  isPreSelected: boolean
  isAvailable: boolean
  availableSlots: number
}

function getOccurrenceInMonth(date: Date) {
  return { dayOfWeek: date.getUTCDay(), occurrence: Math.ceil(date.getUTCDate() / 7) }
}

function getNthDayOfWeek(year: number, month: number, dow: number, n: number): Date | null {
  const first = new Date(Date.UTC(year, month, 1))
  const d = ((dow - first.getUTCDay() + 7) % 7) + 1 + (n - 1) * 7
  if (d > new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) return null
  return new Date(Date.UTC(year, month, d))
}

function getAllDaysOfWeekInMonth(year: number, month: number, dow: number): Date[] {
  const dates: Date[] = []
  const first = new Date(Date.UTC(year, month, 1))
  let d = ((dow - first.getUTCDay() + 7) % 7) + 1
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  while (d <= daysInMonth) {
    dates.push(new Date(Date.UTC(year, month, d)))
    d += 7
  }
  return dates
}

export default async function BookPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  let tenant = await getTenantContext()
  if (!tenant) {
    const sessionOrg = session.user.organizations?.[0]
    if (!sessionOrg) redirect('/home')
    tenant = {
      organizationId: sessionOrg.organization.id,
      slug: sessionOrg.organization.slug,
      name: sessionOrg.organization.name,
      type: 'session',
    }
  }

  const now = new Date()
  const yr = now.getUTCFullYear()
  const mo = now.getUTCMonth()

  const thisMonthStart = new Date(Date.UTC(yr, mo, 1))
  const thisMonthEnd   = new Date(Date.UTC(yr, mo + 1, 0, 23, 59, 59))
  const lastMonthStart = new Date(Date.UTC(yr, mo - 1, 1))
  const lastMonthEnd   = new Date(Date.UTC(yr, mo, 0, 23, 59, 59))

  const [client, sessions] = await Promise.all([
    prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: tenant.organizationId },
      select: { id: true, sessionAllowance: true },
    }),
    getCachedSessions(tenant.organizationId),
  ])

  if (!client) redirect('/home')

  const [
    lastMonthBookings,
    thisMonthClientBookings,
    capacityRows,
    exceptions,
    activeBookingsCount,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        clientId: client.id,
        startTime: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { not: 'CANCELLED' },
        sessionId: { not: null },
      },
      select: { sessionId: true, startTime: true, endTime: true },
    }),
    prisma.booking.findMany({
      where: {
        clientId: client.id,
        startTime: { gte: thisMonthStart, lte: thisMonthEnd },
        status: { not: 'CANCELLED' },
      },
      select: { sessionId: true, startTime: true },
    }),
    prisma.booking.groupBy({
      by: ['sessionId', 'startTime'],
      where: {
        organizationId: tenant.organizationId,
        startTime: { gte: thisMonthStart, lte: thisMonthEnd },
        status: { not: 'CANCELLED' },
      },
      _count: { _all: true },
    }),
    prisma.timeSlotException.findMany({
      where: {
        date: { gte: thisMonthStart, lte: thisMonthEnd },
        timeSlot: { serviceSession: { organizationId: tenant.organizationId } },
      },
      select: { timeSlotId: true, date: true },
    }),
    prisma.booking.count({
      where: { clientId: client.id, status: { not: 'CANCELLED' }, endTime: { gte: now } },
    }),
  ])

  const bookedMap = new Map<string, number>(
    capacityRows.map(r => [`${r.sessionId}_${r.startTime.toISOString()}`, r._count._all])
  )
  const clientBookedSet = new Set(
    thisMonthClientBookings.map(b => `${b.sessionId}_${b.startTime.toISOString()}`)
  )
  const exceptionSet = new Set(
    exceptions.map(e => `${e.timeSlotId}_${e.date.toISOString()}`)
  )
  const sessionMap = new Map(sessions.map(s => [s.id, s]))

  const preSelectedKeys = new Set<string>()
  const suggestions: Suggestion[] = []

  for (const lb of lastMonthBookings) {
    if (!lb.sessionId) continue
    const s = sessionMap.get(lb.sessionId)
    if (!s) continue

    const { dayOfWeek, occurrence } = getOccurrenceInMonth(lb.startTime)
    const sH = lb.startTime.getUTCHours().toString().padStart(2, '0')
    const sM = lb.startTime.getUTCMinutes().toString().padStart(2, '0')
    const eH = lb.endTime.getUTCHours().toString().padStart(2, '0')
    const eM = lb.endTime.getUTCMinutes().toString().padStart(2, '0')

    const equiv = getNthDayOfWeek(yr, mo, dayOfWeek, occurrence)
    if (!equiv) continue

    const thisStart = new Date(Date.UTC(yr, mo, equiv.getUTCDate(), +sH, +sM))
    const thisEnd   = new Date(Date.UTC(yr, mo, equiv.getUTCDate(), +eH, +eM))
    if (thisStart <= now) continue

    const key = `${lb.sessionId}_${thisStart.toISOString()}`
    if (preSelectedKeys.has(key) || clientBookedSet.has(key)) continue

    const ts = s.timetable.find(
      t => t.dayOfWeek === dayOfWeek && t.startTime === `${sH}:${sM}` && t.endTime === `${eH}:${eM}`
    )
    if (!ts) continue

    const midnight = new Date(Date.UTC(yr, mo, equiv.getUTCDate()))
    if (exceptionSet.has(`${ts.id}_${midnight.toISOString()}`)) continue

    const booked = bookedMap.get(key) ?? 0
    const available = s.slots - booked
    preSelectedKeys.add(key)

    suggestions.push({
      id: key,
      sessionId: lb.sessionId,
      sessionName: s.name,
      themeColor: s.themeColor,
      startTime: thisStart.toISOString(),
      endTime: thisEnd.toISOString(),
      isPreSelected: true,
      isAvailable: available > 0,
      availableSlots: available,
    })
  }

  for (const s of sessions) {
    for (const ts of s.timetable) {
      for (const date of getAllDaysOfWeekInMonth(yr, mo, ts.dayOfWeek)) {
        const [sH, sM] = ts.startTime.split(':').map(Number)
        const [eH, eM] = ts.endTime.split(':').map(Number)

        const thisStart = new Date(Date.UTC(yr, mo, date.getUTCDate(), sH, sM))
        const thisEnd   = new Date(Date.UTC(yr, mo, date.getUTCDate(), eH, eM))
        if (thisStart <= now) continue

        const key = `${s.id}_${thisStart.toISOString()}`
        if (preSelectedKeys.has(key) || clientBookedSet.has(key)) continue

        const midnight = new Date(Date.UTC(yr, mo, date.getUTCDate()))
        if (exceptionSet.has(`${ts.id}_${midnight.toISOString()}`)) continue

        const booked = bookedMap.get(key) ?? 0
        const available = s.slots - booked
        if (available <= 0) continue

        suggestions.push({
          id: key,
          sessionId: s.id,
          sessionName: s.name,
          themeColor: s.themeColor,
          startTime: thisStart.toISOString(),
          endTime: thisEnd.toISOString(),
          isPreSelected: false,
          isAvailable: true,
          availableSlots: available,
        })
      }
    }
  }

  suggestions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const slotsRemaining =
    client.sessionAllowance !== null ? client.sessionAllowance - activeBookingsCount : null

  return (
    <BookingHub
      suggestions={suggestions}
      slotsRemaining={slotsRemaining}
      clientSessionAllowance={client.sessionAllowance}
    />
  )
}
