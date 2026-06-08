import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/api-helpers'
import { z } from 'zod'
import { createNotifications } from '@/lib/notify'

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
      select: { id: true, sessionAllowance: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const now = new Date()

    // Check slot availability against client's allowance
    if (client.sessionAllowance !== null) {
      const activeCount = await prisma.booking.count({
        where: {
          clientId: client.id,
          status: { not: 'CANCELLED' },
          endTime: { gte: now },
        },
      })
      const available = client.sessionAllowance - activeCount
      if (requests.length > available) {
        return NextResponse.json(
          {
            error: `Only ${available} session${available !== 1 ? 's' : ''} remaining. Select fewer sessions.`,
            available,
          },
          { status: 403 }
        )
      }
    }

    // Load service session metadata for all requested sessions
    const sessionIds = [...new Set(requests.map((r) => r.sessionId))]
    const serviceSessions = await prisma.serviceSession.findMany({
      where: { id: { in: sessionIds }, organizationId: tenant.organizationId, isActive: true },
      select: { id: true, name: true, slots: true },
    })
    const sessionMap = new Map(serviceSessions.map((s) => [s.id, s]))

    // Pre-validate: session existence and start times (fast checks, no race risk)
    for (const r of requests) {
      const svc = sessionMap.get(r.sessionId)
      if (!svc) {
        return NextResponse.json({ error: `Session not found: ${r.sessionId}` }, { status: 400 })
      }
      if (new Date(r.startTime) <= now) {
        return NextResponse.json({ error: `${svc.name}: session has already started` }, { status: 400 })
      }
    }

    // Create all bookings in a single interactive transaction.
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

    // Notify admins (fire-and-forget)
    const admins = await prisma.userOrganization.findMany({
      where: { organizationId: tenant.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
      include: { user: { select: { id: true } } },
    })
    const adminUserIds = admins.map((a) => a.user.id)

    createNotifications(adminUserIds, {
      title: 'Bulk booking',
      body: `${session.user.name || session.user.email} booked ${created.length} session${created.length !== 1 ? 's' : ''}`,
      url: '/dashboard',
    }).catch(console.error)

    return NextResponse.json({ created: created.length }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error creating bulk bookings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
