import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { availabilityQuerySchema } from '@/lib/validation'
import { generateTimeSlots, filterAvailableSlots } from '@/shared/lib/availability'

// GET /api/availability - Get available time slots
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const query = {
      organizationId: searchParams.get('organizationId') || '',
      startDate: searchParams.get('startDate') || new Date().toISOString(),
      endDate: searchParams.get('endDate') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      spaceId: searchParams.get('spaceId') || undefined,
    }

    const validated = availabilityQuerySchema.parse(query)

    // Verify user has access to this organization
    const hasAccess = session.user.organizations?.some(
      (org) => org.id === validated.organizationId
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get spaces
    const spaces = await prisma.space.findMany({
      where: {
        organizationId: validated.organizationId,
        isActive: true,
        ...(validated.spaceId && { id: validated.spaceId }),
      },
    })

    // Get existing bookings
    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: validated.organizationId,
        spaceId: validated.spaceId || undefined,
        status: {
          not: 'CANCELLED',
        },
        startTime: {
          gte: new Date(validated.startDate),
        },
        endTime: {
          lte: new Date(validated.endDate),
        },
      },
      select: {
        spaceId: true,
        startTime: true,
        endTime: true,
      },
    })

    // Generate time slots (30-minute intervals, 9 AM - 5 PM)
    const timeSlots = generateTimeSlots(
      new Date(validated.startDate),
      new Date(validated.endDate),
      30,
      9,
      17
    )

    // Group bookings by space
    const bookingsBySpace = bookings.reduce((acc, booking) => {
      if (!acc[booking.spaceId]) {
        acc[booking.spaceId] = []
      }
      acc[booking.spaceId].push({
        startTime: booking.startTime,
        endTime: booking.endTime,
      })
      return acc
    }, {} as Record<string, Array<{ startTime: Date; endTime: Date }>>)

    // Calculate availability for each space
    const availability = spaces.flatMap((space) => {
      const spaceBookings = bookingsBySpace[space.id] || []
      const availableSlots = filterAvailableSlots(timeSlots, spaceBookings)

      return availableSlots.map((slot) => ({
        startTime: slot.start,
        endTime: slot.end,
        available: true,
        spaceId: space.id,
        spaceName: space.name,
        capacity: space.capacity,
        currentBookings: spaceBookings.filter((b) => {
          const bookingStart = new Date(b.startTime)
          const bookingEnd = new Date(b.endTime)
          return (
            (bookingStart >= slot.start && bookingStart < slot.end) ||
            (bookingEnd > slot.start && bookingEnd <= slot.end) ||
            (bookingStart <= slot.start && bookingEnd >= slot.end)
          )
        }).length,
      }))
    })

    return NextResponse.json(availability)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
