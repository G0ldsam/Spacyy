import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { sendSpotAvailableNotification } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST /api/interest/notify
// Body: { sessionId, timeSlotId, date }
// Admin triggers mass notification to all interested clients for a specific slot.
export async function POST(req: NextRequest) {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const body = await req.json()
  const { sessionId, timeSlotId, date } = body

  if (!sessionId || !timeSlotId || !date) {
    return NextResponse.json({ error: 'sessionId, timeSlotId and date are required' }, { status: 400 })
  }

  const entryDate = new Date(date)
  entryDate.setHours(0, 0, 0, 0)
  const nextDay = new Date(entryDate)
  nextDay.setDate(nextDay.getDate() + 1)

  const [entries, timeSlot, serviceSession, org] = await Promise.all([
    prisma.interestEntry.findMany({
      where: {
        organizationId: tenant.organizationId,
        sessionId,
        timeSlotId,
        date: { gte: entryDate, lt: nextDay },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.timeSlot.findUnique({ where: { id: timeSlotId } }),
    prisma.serviceSession.findUnique({ where: { id: sessionId }, select: { name: true } }),
    prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: { name: true, slug: true },
    }),
  ])

  if (!timeSlot || !serviceSession || !org) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
  const dateStr = entryDate.toISOString().split('T')[0]
  const bookingUrl = `https://${org.slug}.${mainDomain}/book/${sessionId}/${dateStr}`

  const formattedDate = entryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Send emails + update notifiedAt
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      await sendSpotAvailableNotification({
        clientEmail: entry.client.email,
        clientName: entry.client.name,
        orgName: org.name,
        sessionName: serviceSession.name,
        date: formattedDate,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        bookingUrl,
      })
      await prisma.interestEntry.update({
        where: { id: entry.id },
        data: { notifiedAt: new Date() },
      })
    })
  )

  const notifiedCount = results.filter((r) => r.status === 'fulfilled').length

  return NextResponse.json({ notifiedCount, total: entries.length })
}
