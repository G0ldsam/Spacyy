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
