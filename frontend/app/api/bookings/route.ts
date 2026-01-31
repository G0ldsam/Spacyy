import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bookingSchema } from '@/lib/validation'
import { checkBookingConflict } from '@/shared/lib/booking'

// GET /api/bookings - List bookings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const hasAccess = session.user.organizations?.some(
      (org) => org.id === organizationId
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const bookings = await prisma.booking.findMany({
      where: {
        organizationId,
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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Get organization from user
    const userOrg = session.user.organizations?.[0]
    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }
    const organizationId = userOrg.organization.id

    // Validate booking data
    const validated = bookingSchema.parse({
      ...body,
      clientId: body.clientId,
      startTime: body.startTime,
      endTime: body.endTime,
      notes: body.notes,
    })

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

    const hasAccess = session.user.organizations?.some(
      (org) => org.organization.id === finalOrganizationId
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization to check policies
    const organization = await prisma.organization.findUnique({
      where: { id: finalOrganizationId },
      select: {
        requireMembershipForBooking: true,
      },
    })

    // Check membership requirement policy
    if (organization?.requireMembershipForBooking) {
      const client = await prisma.client.findUnique({
        where: { id: validated.clientId },
        select: {
          sessionAllowance: true,
        },
      })

      if (client && client.sessionAllowance !== null) {
        // Count active bookings for this client
        const activeBookingsCount = await prisma.booking.count({
          where: {
            clientId: validated.clientId,
            status: {
              not: 'CANCELLED',
            },
          },
        })

        // Check if client has available slots
        if (activeBookingsCount >= client.sessionAllowance) {
          return NextResponse.json(
            { error: 'No available session slots. Please check your membership status.' },
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
    })

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
