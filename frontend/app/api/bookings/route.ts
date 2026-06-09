import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bookingSchema } from '@/lib/validation'
import { verifyTenantAccess, verifyTenantAdmin } from '@/lib/api-helpers'
import { notifyAdminNewBooking, sendBookingConfirmation, sendPendingSlotWarning, notifyAdminPendingSlotUsed } from '@/lib/email'
import { createNotifications } from '@/lib/notify'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/bookings - List bookings (admin/owner only)
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
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
      (org) => org.organization.id === tenant.organizationId &&
               (org.role === 'OWNER' || org.role === 'ADMIN')
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

    const isReserved = !validated.clientId

    // Get organization policy (always needed for org name in notifications)
    const organization = await prisma.organization.findUnique({
      where: { id: finalOrganizationId },
      select: { allowPendingSlot: true, brandPrimary: true },
    })

    let usePendingSlot = false

    if (!isReserved) {
      const client = await prisma.client.findUnique({
        where: { id: validated.clientId! },
        select: { sessionAllowance: true },
      })

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
          if (organization?.allowPendingSlot && activeBookingsCount < client.sessionAllowance + 1) {
            usePendingSlot = true
          } else {
            return NextResponse.json(
              { error: 'Δεν υπάρχουν διαθέσιμες θέσεις. Παρακαλώ ανανεώστε τη συνδρομή σας.' },
              { status: 403 }
            )
          }
        }
      }

      // Prevent same client booking the same session+time twice
      const duplicate = await prisma.booking.findFirst({
        where: {
          clientId: validated.clientId,
          sessionId: validated.sessionId || undefined,
          startTime: new Date(validated.startTime),
          endTime: new Date(validated.endTime),
          status: { not: 'CANCELLED' },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'You already have a booking for this session.' },
          { status: 409 }
        )
      }
    }

    // Check for conflicts - count existing bookings for this time slot (RESERVED counts toward capacity)
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
        clientId: validated.clientId ?? null,
        userId: session.user.id,
        startTime: new Date(validated.startTime),
        endTime: new Date(validated.endTime),
        status: isReserved ? 'RESERVED' : 'CONFIRMED',
        usedPendingSlot: usePendingSlot,
        notes: validated.notes,
      },
      include: {
        space: { select: { id: true, name: true, capacity: true } },
        client: { select: { id: true, name: true, email: true } },
        serviceSession: { select: { name: true } },
        organization: { select: { name: true } },
      },
    })

    // Auto-remove client from waitlist if they just booked this slot
    if (!isReserved && validated.clientId && validated.sessionId) {
      const bookingDate = new Date(validated.startTime)
      bookingDate.setHours(0, 0, 0, 0)
      const nextDay = new Date(bookingDate)
      nextDay.setDate(nextDay.getDate() + 1)

      // Find matching timeSlot by comparing start/end times
      const timeSlots = await prisma.timeSlot.findMany({
        where: { serviceSessionId: validated.sessionId },
        select: { id: true, startTime: true, endTime: true },
      })
      const startTimeStr = new Date(validated.startTime).toISOString().split('T')[1].slice(0, 5)
      const endTimeStr = new Date(validated.endTime).toISOString().split('T')[1].slice(0, 5)
      const matchingSlot = timeSlots.find(
        (ts) => ts.startTime === startTimeStr && ts.endTime === endTimeStr
      )

      if (matchingSlot) {
        await prisma.interestEntry.deleteMany({
          where: {
            clientId: validated.clientId,
            sessionId: validated.sessionId,
            timeSlotId: matchingSlot.id,
            date: { gte: bookingDate, lt: nextDay },
          },
        }).catch(console.error) // Fire-and-forget
      }
    }

    if (!isReserved) {
      if (usePendingSlot) {
        await prisma.client.update({
          where: { id: validated.clientId! },
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
        clientName: booking.client!.name,
        sessionName,
        startTime: booking.startTime,
        brandColor: organization?.brandPrimary ?? undefined,
      }).catch(console.error)

      createNotifications(adminUserIds, {
        title: 'New booking',
        body: `${booking.client!.name} booked ${sessionName} on ${booking.startTime.toLocaleDateString()}`,
        url: '/dashboard',
      }).catch(console.error)

      if (usePendingSlot) {
        sendPendingSlotWarning({
          clientEmail: booking.client!.email,
          clientName: booking.client!.name,
          orgName,
          sessionName,
          startTime: booking.startTime,
          brandColor: organization?.brandPrimary ?? undefined,
        }).catch(console.error)

        notifyAdminPendingSlotUsed({
          adminEmails,
          orgName,
          clientName: booking.client!.name,
          sessionName,
          startTime: booking.startTime,
          brandColor: organization?.brandPrimary ?? undefined,
        }).catch(console.error)

        createNotifications(adminUserIds, {
          title: 'Pending slot used',
          body: `${booking.client!.name} booked ${sessionName} with no remaining allowance — 1 session owed on next renewal`,
          url: '/dashboard',
        }).catch(console.error)
      } else {
        sendBookingConfirmation({
          clientEmail: booking.client!.email,
          clientName: booking.client!.name,
          orgName,
          sessionName,
          startTime: booking.startTime,
          endTime: booking.endTime,
          brandColor: organization?.brandPrimary ?? undefined,
        }).catch(console.error)
      }
    }

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
