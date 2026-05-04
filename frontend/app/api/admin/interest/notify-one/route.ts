import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { sendSpotAvailableNotification } from '@/lib/email'
import { createNotification } from '@/lib/notify'

export const dynamic = 'force-dynamic'

// POST /api/admin/interest/notify-one
// Body: { entryId }
export async function POST(req: NextRequest) {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const { entryId } = await req.json()
  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 })

  const entry = await prisma.interestEntry.findUnique({
    where: { id: entryId },
    include: {
      client: { select: { id: true, name: true, email: true, userId: true } },
      session: { select: { id: true, name: true } },
      timeSlot: { select: { startTime: true, endTime: true } },
      organization: { select: { name: true, slug: true } },
    },
  })

  if (!entry || entry.organizationId !== tenant.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Check for conflicting bookings — don't notify if client already has overlapping booking
  const startTime = new Date(entry.date)
  const [sh, sm] = entry.timeSlot.startTime.split(':').map(Number)
  startTime.setHours(sh, sm, 0, 0)
  const endTime = new Date(entry.date)
  const [eh, em] = entry.timeSlot.endTime.split(':').map(Number)
  endTime.setHours(eh, em, 0, 0)

  const conflictingBooking = await prisma.booking.findFirst({
    where: {
      clientId: entry.client.id,
      status: { not: 'CANCELLED' },
      OR: [
        { startTime: { lt: endTime }, endTime: { gt: startTime } }, // Overlap check
      ],
    },
  })

  if (conflictingBooking) {
    return NextResponse.json(
      { error: 'Client has a conflicting booking at this time' },
      { status: 409 }
    )
  }

  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
  const dateStr = entry.date.toISOString().split('T')[0]
  const bookingUrl = `https://${entry.organization.slug}.${mainDomain}/book/${entry.session.id}/${dateStr}`
  const formattedDate = entry.date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  await sendSpotAvailableNotification({
    clientEmail: entry.client.email,
    clientName: entry.client.name,
    orgName: entry.organization.name,
    sessionName: entry.session.name,
    date: formattedDate,
    startTime: entry.timeSlot.startTime,
    endTime: entry.timeSlot.endTime,
    bookingUrl,
  })

  if (entry.client.userId) {
    createNotification(entry.client.userId, {
      title: 'Spot available!',
      body: `A spot opened up for ${entry.session.name} on ${formattedDate}`,
      url: bookingUrl,
    }).catch(console.error)
  }

  await prisma.interestEntry.update({
    where: { id: entryId },
    data: { notifiedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}
