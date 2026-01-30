import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bookingSchema } from '@/shared/lib/validation'
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
    const validated = bookingSchema.parse(body)

    // Verify user has access to the organization
    // You'll need to get organizationId from the space
    const space = await prisma.space.findUnique({
      where: { id: validated.spaceId },
      select: { organizationId: true },
    })

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 })
    }

    const hasAccess = session.user.organizations?.some(
      (org) => org.id === space.organizationId
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for conflicts
    const existingBookings = await prisma.booking.findMany({
      where: {
        spaceId: validated.spaceId,
        status: {
          not: 'CANCELLED',
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    })

    if (checkBookingConflict(validated, existingBookings)) {
      return NextResponse.json(
        { error: 'Time slot is already booked' },
        { status: 409 }
      )
    }

    const booking = await prisma.booking.create({
      data: {
        organizationId: space.organizationId,
        spaceId: validated.spaceId,
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
