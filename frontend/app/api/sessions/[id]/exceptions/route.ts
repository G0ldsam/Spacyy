import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/sessions/[id]/exceptions?date=YYYY-MM-DD
// Returns a map of timeSlotId -> exception for all cancelled slots on that date
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const date = req.nextUrl.searchParams.get('date')
  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }

  const exceptionDate = new Date(date)
  exceptionDate.setHours(0, 0, 0, 0)
  const nextDay = new Date(exceptionDate)
  nextDay.setDate(nextDay.getDate() + 1)

  const exceptions = await prisma.timeSlotException.findMany({
    where: {
      date: { gte: exceptionDate, lt: nextDay },
      timeSlot: {
        serviceSessionId: params.id,
        serviceSession: { organizationId: tenant.organizationId },
      },
    },
  })

  const map = Object.fromEntries(exceptions.map((e) => [e.timeSlotId, e]))
  return NextResponse.json(map)
}

// POST /api/sessions/[id]/exceptions
// Body: { timeSlotId, date, reason? }
// Closes one occurrence: creates exception + cancels existing bookings + restores allowance
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const body = await req.json()
  const { timeSlotId, date, reason } = body

  if (!timeSlotId || !date) {
    return NextResponse.json({ error: 'timeSlotId and date are required' }, { status: 400 })
  }

  const timeSlot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId },
    include: { serviceSession: { select: { id: true, organizationId: true } } },
  })

  if (
    !timeSlot ||
    timeSlot.serviceSession.id !== params.id ||
    timeSlot.serviceSession.organizationId !== tenant.organizationId
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const exceptionDate = new Date(date)
  exceptionDate.setHours(0, 0, 0, 0)

  const exception = await prisma.timeSlotException.upsert({
    where: { timeSlotId_date: { timeSlotId, date: exceptionDate } },
    create: { timeSlotId, date: exceptionDate, reason: reason || null },
    update: { reason: reason || null },
  })

  // Find bookings that match this exact time slot on this date
  const [startHour, startMin] = timeSlot.startTime.split(':').map(Number)
  const [endHour, endMin] = timeSlot.endTime.split(':').map(Number)
  const exactStart = new Date(date)
  exactStart.setHours(startHour, startMin, 0, 0)
  const exactEnd = new Date(date)
  exactEnd.setHours(endHour, endMin, 0, 0)

  const bookingsToCancel = await prisma.booking.findMany({
    where: {
      sessionId: params.id,
      startTime: exactStart,
      endTime: exactEnd,
      status: { not: 'CANCELLED' },
    },
    include: {
      client: { select: { id: true, sessionAllowance: true, pendingSlotsUsed: true } },
    },
  })

  if (bookingsToCancel.length > 0) {
    for (const booking of bookingsToCancel) {
      const cancelOp = prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      })

      if (booking.client.sessionAllowance !== null) {
        const restoreOp =
          booking.client.pendingSlotsUsed > 0
            ? prisma.client.update({
                where: { id: booking.client.id },
                data: { pendingSlotsUsed: { decrement: 1 } },
              })
            : prisma.client.update({
                where: { id: booking.client.id },
                data: { sessionAllowance: { increment: 1 } },
              })
        await prisma.$transaction([cancelOp, restoreOp])
      } else {
        await cancelOp
      }
    }
  }

  return NextResponse.json({ exception, cancelledCount: bookingsToCancel.length }, { status: 201 })
}
