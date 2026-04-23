import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendRenewalReminder } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'

export const dynamic = 'force-dynamic'

// GET /api/cron/renewal-reminder
// Called daily by Vercel Cron. Finds clients whose last covered session starts within 24h
// and sends a renewal reminder email.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000) // 2h buffer for late runs

  // Find upcoming bookings in the next 24-26h window
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      status: { not: 'CANCELLED' },
      startTime: { gte: in24h, lt: in26h },
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          userId: true,
          sessionAllowance: true,
          pendingSlotsUsed: true,
        },
      },
      serviceSession: { select: { name: true } },
      organization: { select: { name: true } },
    },
  })

  const reminders: string[] = []

  for (const booking of upcomingBookings) {
    const { client } = booking
    if (client.sessionAllowance === null) continue // unlimited — skip

    // Count all future non-cancelled bookings for this client (including this one)
    const futureBookingsCount = await prisma.booking.count({
      where: {
        clientId: client.id,
        status: { not: 'CANCELLED' },
        endTime: { gte: now },
      },
    })

    // If their future bookings match their allowance exactly, this is their last covered session
    if (futureBookingsCount === client.sessionAllowance) {
      try {
        await sendRenewalReminder({
          clientEmail: client.email,
          clientName: client.name,
          orgName: booking.organization.name,
          sessionName: booking.serviceSession?.name ?? 'Session',
          startTime: booking.startTime,
        })
        if (client.userId) {
          sendPushToUser(client.userId, {
            title: 'Membership renewal reminder',
            body: `Your last covered session (${booking.serviceSession?.name ?? 'Session'}) is tomorrow. Contact ${booking.organization.name} to renew.`,
            url: '/membership',
          }).catch(console.error)
        }
        reminders.push(client.email)
      } catch (err) {
        console.error(`Failed to send renewal reminder to ${client.email}:`, err)
      }
    }
  }

  return NextResponse.json({ sent: reminders.length, emails: reminders })
}
