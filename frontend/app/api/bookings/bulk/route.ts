import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/api-helpers'
import { z } from 'zod'
import { createNotifications } from '@/lib/notify'
import { notifyAdminBulkBooking, sendBulkBookingConfirmation } from '@/lib/email'

export const dynamic = 'force-dynamic'

type BookingRequest = { sessionId: string; startTime: string; endTime: string }
type ServiceSession = { id: string; name: string; slots: number }

async function createBookingsInTransaction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  requests: BookingRequest[],
  sessionMap: Map<string, ServiceSession>,
  clientId: string,
  organizationId: string,
  userId: string,
) {
  for (const r of requests) {
    const svc = sessionMap.get(r.sessionId)
    if (!svc) throw Object.assign(new Error(`Session not found: ${r.sessionId}`), { status: 400 })
    const startTime = new Date(r.startTime)
    const endTime = new Date(r.endTime)

    const booked = await tx.booking.count({
      where: { sessionId: r.sessionId, startTime, endTime, status: { not: 'CANCELLED' } },
    })
    if (booked >= svc.slots) {
      throw Object.assign(new Error(`${svc.name}: no slots available for this time`), { status: 409 })
    }

    const duplicate = await tx.booking.findFirst({
      where: { clientId, sessionId: r.sessionId, startTime, status: { not: 'CANCELLED' } },
    })
    if (duplicate) {
      throw Object.assign(new Error(`${svc.name}: already booked`), { status: 409 })
    }
  }

  return Promise.all(
    requests.map((r) =>
      tx.booking.create({
        data: {
          organizationId,
          sessionId: r.sessionId,
          clientId,
          userId,
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
          status: 'CONFIRMED',
          usedPendingSlot: false,
        },
      })
    )
  )
}

const bulkSchema = z.object({
  bookings: z
    .array(
      z.object({
        sessionId: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      })
    )
    .min(1)
    .max(20),
})

async function checkAllowance(
  clientId: string,
  sessionAllowance: number | null,
  requestCount: number,
  now: Date,
): Promise<NextResponse | null> {
  if (sessionAllowance === null) return null
  const activeCount = await prisma.booking.count({
    where: { clientId, status: { not: 'CANCELLED' }, endTime: { gte: now } },
  })
  const available = sessionAllowance - activeCount
  if (requestCount > available) {
    return NextResponse.json(
      { error: `Only ${available} session${available === 1 ? '' : 's'} remaining. Select fewer sessions.`, available },
      { status: 403 }
    )
  }
  return null
}

function preValidateRequests(
  requests: BookingRequest[],
  sessionMap: Map<string, ServiceSession>,
  now: Date,
): NextResponse | null {
  for (const r of requests) {
    const svc = sessionMap.get(r.sessionId)
    if (!svc) return NextResponse.json({ error: `Session not found: ${r.sessionId}` }, { status: 400 })
    if (new Date(r.startTime) <= now) {
      return NextResponse.json({ error: `${svc.name}: session has already started` }, { status: 400 })
    }
  }
  return null
}

// POST /api/bookings/bulk - Create multiple bookings at once (for monthly rebook flow)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenantContext()
    if (!tenant) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

    const body = await req.json()
    const { bookings: requests } = bulkSchema.parse(body)

    const client = await prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: tenant.organizationId },
      select: { id: true, sessionAllowance: true, name: true, email: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const now = new Date()

    const allowanceError = await checkAllowance(client.id, client.sessionAllowance, requests.length, now)
    if (allowanceError) return allowanceError

    const sessionIds = [...new Set(requests.map((r) => r.sessionId))]
    const serviceSessions = await prisma.serviceSession.findMany({
      where: { id: { in: sessionIds }, organizationId: tenant.organizationId, isActive: true },
      select: { id: true, name: true, slots: true },
    })
    const sessionMap = new Map(serviceSessions.map((s) => [s.id, s]))

    const validationError = preValidateRequests(requests, sessionMap, now)
    if (validationError) return validationError

    // Capacity and duplicate checks happen inside the transaction to prevent race conditions.
    let created: Awaited<ReturnType<typeof prisma.booking.create>>[]
    try {
      created = await prisma.$transaction((tx) =>
        createBookingsInTransaction(tx, requests, sessionMap, client.id, tenant.organizationId, session.user.id)
      )
    } catch (txError: any) {
      return NextResponse.json(
        { error: txError.message || 'Failed to create bookings' },
        { status: txError.status ?? 409 }
      )
    }

    // Fire-and-forget: one summary email + one push notification (not per-booking)
    const [org, admins] = await Promise.all([
      prisma.organization.findUnique({ where: { id: tenant.organizationId }, select: { name: true, brandPrimary: true } }),
      prisma.userOrganization.findMany({
        where: { organizationId: tenant.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
        include: { user: { select: { id: true, email: true } } },
      }),
    ])
    const orgName = org?.name ?? ''
    const adminUserIds = admins.map((a) => a.user.id)
    const adminEmails = admins.map((a) => a.user.email).filter(Boolean)

    const sessionList = requests.map((r) => ({
      name: sessionMap.get(r.sessionId)?.name ?? 'Session',
      startTime: new Date(r.startTime),
      endTime: new Date(r.endTime),
    }))

    notifyAdminBulkBooking({ adminEmails, orgName, clientName: client.name, count: created.length, sessions: sessionList, brandColor: org?.brandPrimary ?? undefined }).catch(console.error)
    createNotifications(adminUserIds, {
      title: 'Bulk booking',
      body: `${client.name} booked ${created.length} session${created.length === 1 ? '' : 's'}`,
      url: '/dashboard',
    }).catch(console.error)
    if (client.email) {
      sendBulkBookingConfirmation({ clientEmail: client.email, clientName: client.name, orgName, count: created.length, sessions: sessionList, brandColor: org?.brandPrimary ?? undefined }).catch(console.error)
    }

    return NextResponse.json({ created: created.length }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating bulk bookings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
