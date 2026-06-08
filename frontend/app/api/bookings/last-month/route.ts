import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

function getOccurrenceInMonth(date: Date): { dayOfWeek: number; occurrence: number } {
  const dayOfWeek = date.getUTCDay()
  const occurrence = Math.ceil(date.getUTCDate() / 7)
  return { dayOfWeek, occurrence }
}

function getNthDayOfWeekInMonth(year: number, month: number, dayOfWeek: number, n: number): Date | null {
  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const firstTargetDay = ((dayOfWeek - firstOfMonth.getUTCDay() + 7) % 7) + 1
  const targetDay = firstTargetDay + (n - 1) * 7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  if (targetDay > daysInMonth) return null
  return new Date(Date.UTC(year, month, targetDay))
}

// GET /api/bookings/last-month
// Returns this month's equivalent dates for last month's booking pattern
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenantContext()
    const orgIds: string[] = tenant
      ? [tenant.organizationId]
      : (session.user.organizations?.map((o) => o.organization.id) ?? [])

    if (orgIds.length === 0) return NextResponse.json({ suggestions: [], clientSessionAllowance: null, activeBookingsCount: 0 })

    const client = await prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: { in: orgIds } },
      select: { id: true, sessionAllowance: true },
    })
    if (!client) return NextResponse.json({ suggestions: [], clientSessionAllowance: null, activeBookingsCount: 0 })

    const now = new Date()
    const thisYear = now.getUTCFullYear()
    const thisMonth = now.getUTCMonth()

    const lastMonthStart = new Date(Date.UTC(thisYear, thisMonth - 1, 1))
    const lastMonthEnd = new Date(Date.UTC(thisYear, thisMonth, 0, 23, 59, 59))

    const lastMonthBookings = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        startTime: { gte: lastMonthStart, lte: lastMonthEnd },
        status: { not: 'CANCELLED' },
        sessionId: { not: null },
      },
      include: {
        serviceSession: {
          select: { id: true, name: true, themeColor: true, slots: true, isActive: true },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    if (lastMonthBookings.length === 0) {
      return NextResponse.json({ suggestions: [], clientSessionAllowance: client.sessionAllowance, activeBookingsCount: 0 })
    }

    const activeBookingsCount = await prisma.booking.count({
      where: {
        clientId: client.id,
        status: { not: 'CANCELLED' },
        endTime: { gte: now },
      },
    })

    // Get client's existing bookings this month to skip duplicates
    const thisMonthStart = new Date(Date.UTC(thisYear, thisMonth, 1))
    const thisMonthEnd = new Date(Date.UTC(thisYear, thisMonth + 1, 0, 23, 59, 59))
    const existingThisMonth = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        startTime: { gte: thisMonthStart, lte: thisMonthEnd },
        status: { not: 'CANCELLED' },
      },
      select: { sessionId: true, startTime: true },
    })
    const existingSet = new Set(
      existingThisMonth.map((b) => `${b.sessionId}_${b.startTime.toISOString()}`)
    )

    // Batch-load all timeSlots for sessions that appeared last month
    const sessionIds = [...new Set(lastMonthBookings.map((b) => b.sessionId).filter(Boolean))] as string[]
    const allTimeSlots = await prisma.timeSlot.findMany({
      where: { serviceSessionId: { in: sessionIds } },
      select: { id: true, serviceSessionId: true, dayOfWeek: true, startTime: true, endTime: true },
    })

    // Deduplicate suggestions by (sessionId, thisMonthDate) so we don't show the same slot twice
    const seen = new Set<string>()
    const suggestions = []

    for (const booking of lastMonthBookings) {
      if (!booking.sessionId || !booking.serviceSession) continue
      if (!booking.serviceSession.isActive) continue

      const lastDate = booking.startTime
      const { dayOfWeek, occurrence } = getOccurrenceInMonth(lastDate)

      const startH = lastDate.getUTCHours().toString().padStart(2, '0')
      const startM = lastDate.getUTCMinutes().toString().padStart(2, '0')
      const startTimeStr = `${startH}:${startM}`

      const lastEndDate = booking.endTime
      const endH = lastEndDate.getUTCHours().toString().padStart(2, '0')
      const endM = lastEndDate.getUTCMinutes().toString().padStart(2, '0')
      const endTimeStr = `${endH}:${endM}`

      const thisMonthDate = getNthDayOfWeekInMonth(thisYear, thisMonth, dayOfWeek, occurrence)
      if (!thisMonthDate) continue

      const thisStart = new Date(Date.UTC(
        thisMonthDate.getUTCFullYear(), thisMonthDate.getUTCMonth(), thisMonthDate.getUTCDate(),
        parseInt(startH), parseInt(startM), 0
      ))
      const thisEnd = new Date(Date.UTC(
        thisMonthDate.getUTCFullYear(), thisMonthDate.getUTCMonth(), thisMonthDate.getUTCDate(),
        parseInt(endH), parseInt(endM), 0
      ))

      if (thisStart <= now) continue

      const suggestionKey = `${booking.sessionId}_${thisStart.toISOString()}`
      if (seen.has(suggestionKey)) continue
      seen.add(suggestionKey)

      if (existingSet.has(suggestionKey)) continue

      const matchingSlot = allTimeSlots.find(
        (ts) =>
          ts.serviceSessionId === booking.sessionId &&
          ts.dayOfWeek === dayOfWeek &&
          ts.startTime === startTimeStr &&
          ts.endTime === endTimeStr
      )
      if (!matchingSlot) continue

      const midnight = new Date(Date.UTC(thisMonthDate.getUTCFullYear(), thisMonthDate.getUTCMonth(), thisMonthDate.getUTCDate()))
      const exception = await prisma.timeSlotException.findUnique({
        where: { timeSlotId_date: { timeSlotId: matchingSlot.id, date: midnight } },
      })
      if (exception) continue

      const bookedCount = await prisma.booking.count({
        where: {
          sessionId: booking.sessionId,
          startTime: thisStart,
          endTime: thisEnd,
          status: { not: 'CANCELLED' },
        },
      })

      const availableSlots = booking.serviceSession.slots - bookedCount
      const isAvailable = availableSlots > 0

      suggestions.push({
        id: suggestionKey,
        sessionId: booking.sessionId,
        sessionName: booking.serviceSession.name,
        themeColor: booking.serviceSession.themeColor,
        startTime: thisStart.toISOString(),
        endTime: thisEnd.toISOString(),
        availableSlots,
        isAvailable,
        unavailableReason: !isAvailable ? 'full' : undefined,
      })
    }

    return NextResponse.json({
      suggestions,
      clientSessionAllowance: client.sessionAllowance,
      activeBookingsCount,
    })
  } catch (error) {
    console.error('Error fetching last month suggestions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
