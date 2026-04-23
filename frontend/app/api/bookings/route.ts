import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bookingSchema } from '@/lib/validation'
import { checkBookingConflict } from '@/shared/lib/booking'
import { verifyTenantAccess } from '@/lib/api-helpers'
import { notifyAdminNewBooking, sendBookingConfirmation } from '@/lib/email'
import { createNotifications } from '@/lib/notify'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/bookings - List bookings
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: tenant.organizationId,
      },
      include: {
        space: {
          select: {
            id: true,
            name: true,
            capacity: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/bookings - Create booking
export async function POST(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    const organizationId = tenant.organizationId

    // Validate booking data
    const validated = bookingSchema.parse({
      ...body,
      clientId: body.clientId,
      startTime: body.startTime,
      endTime: body.endTime,
      notes: body.notes,
    })

    // Prevent clients from booking sessions that have already started (admins can still assign)
    const isAdmin = session.user.organizations?.some(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )
    if (!isAdmin && new Date(validated.startTime) <= new Date()) {
      return NextResponse.json({ error: 'This session has already started' }, { status: 400 })
    }

    // Get organization from session or space
    let finalOrganizationId = organizationId
    if (validated.spaceId) {
      const space = await prisma.space.findUnique({
        where: { id: validated.spaceId },
        select: { organizationId: true },
      })
      if (!space) {
        return NextResponse.json({ error: 'Space not found' }, { status: 404 })
      }
      finalOrganizationId = space.organizationId
    } else if (validated.sessionId) {
      const serviceSession = await prisma.serviceSession.findUnique({
        where: { id: validated.sessionId },
        select: { organizationId: true },
      })
      if (!serviceSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      finalOrganizationId = serviceSession.organizationId
    }

    // Verify the resource belongs to the same organization as tenant
    if (finalOrganizationId !== tenant.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization policy and client slot info
    const [organization, client] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: finalOrganizationId },
        select: { allowPendingSlot: true },
      }),
      prisma.client.findUnique({
        where: { id: validated.clientId },
        select: { sessionAllowance: true },
      }),
    ])

    let usePendingSlot = false

    // Check slot availability when client has a limited allowance
    if (client && client.sessionAllowance !== null) {
      const now = new Date()
      const activeBookingsCount = await prisma.booking.count({
        where: {
          clientId: validated.clientId,
          status: { not: 'CANCELLED' },
          endTime: { gte: now },
        },
      })

      if (activeBookingsCount >= client.sessionAllowance) {
        if (organization?.allowPendingSlot) {
          usePendingSlot = true
        } else {
          return NextResponse.json(
            { error: 'No available session slots. Please renew your membership.' },
            { status: 403 }
          )
        }
      }
    }

    // Check for conflicts - count existing bookings for this time slot
    const existingBookings = await prisma.booking.findMany({
      where: {
        sessionId: validated.sessionId || undefined,
        spaceId: validated.spaceId || undefined,
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        status: {
          not: 'CANCELLED',
        },
      },
    })

    // If it's a session booking, check if slots are available
    if (validated.sessionId) {
      const serviceSession = await prisma.serviceSession.findUnique({
        where: { id: validated.sessionId },
        select: { slots: true },
      })
      if (serviceSession && existingBookings.length >= serviceSession.slots) {
        return NextResponse.json(
          { error: 'No slots available for this time' },
          { status: 409 }
        )
      }
    }

    const booking = await prisma.booking.create({
      data: {
        organizationId: finalOrganizationId,
        spaceId: validated.spaceId,
        sessionId: validated.sessionId,
        clientId: validated.clientId,
        userId: session.user.id,
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        notes: validated.notes,
      },
      include: {
        space: { select: { id: true, name: true, capacity: true } },
        client: { select: { id: true, name: true, email: true } },
        serviceSession: { select: { name: true } },
        organization: { select: { name: true } },
      },
    })

    if (usePendingSlot) {
      await prisma.client.update({
        where: { id: validated.clientId },
        data: { pendingSlotsUsed: { increment: 1 } },
      })
    }

    // Notify admins + send client confirmation (fire-and-forget)
    const sessionName = booking.serviceSession?.name ?? booking.space?.name ?? 'Session'
    const orgName = booking.organization?.name ?? ''

    const admins = await prisma.userOrganization.findMany({
      where: { organizationId: finalOrganizationId, role: { in: ['OWNER', 'ADMIN'] } },
      include: { user: { select: { id: true, email: true } } },
    })
    const adminEmails = admins.map((a) => a.user.email).filter(Boolean) as string[]
    const adminUserIds = admins.map((a) => a.user.id)

    notifyAdminNewBooking({
      adminEmails,
      orgName,
      clientName: booking.client.name,
      sessionName,
      startTime: booking.startTime,
    }).catch(console.error)

    createNotifications(adminUserIds, {
      title: 'New booking',
      body: `${booking.client.name} booked ${sessionName} on ${booking.startTime.toLocaleDateString()}`,
      url: '/dashboard',
    }).catch(console.error)

    sendBookingConfirmation({
      clientEmail: booking.client.email,
      clientName: booking.client.name,
      orgName,
      sessionName,
      startTime: booking.startTime,
      endTime: booking.endTime,
    }).catch(console.error)

    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
