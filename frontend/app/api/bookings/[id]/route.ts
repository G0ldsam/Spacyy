import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/bookings/[id] - Get single booking
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get client for this user
    const userOrg = session.user.organizations?.[0]
    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const client = await prisma.client.findFirst({
      where: {
        userId: session.user.id,
        organizationId: userOrg.organization.id,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        serviceSession: {
          select: {
            id: true,
            name: true,
            description: true,
            themeColor: true,
          },
        },
        organization: {
          select: {
            bookingChangeHours: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify this booking belongs to the client
    if (booking.clientId !== client.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/bookings/[id] - Update booking (e.g., cancel)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Get client for this user
    const userOrg = session.user.organizations?.[0]
    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const client = await prisma.client.findFirst({
      where: {
        userId: session.user.id,
        organizationId: userOrg.organization.id,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Verify booking exists and belongs to client
    const existingBooking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        organization: {
          select: {
            bookingChangeHours: true,
          },
        },
      },
    })

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (existingBooking.clientId !== client.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check booking change policy (only for changing bookings, NOT for cancelling)
    // Cancellation is always allowed to free up the spot, but session allowance remains reduced
    if (newStatus !== existingBooking.status && newStatus !== 'CANCELLED' && existingBooking.organization.bookingChangeHours !== null) {
      const now = new Date()
      const bookingStart = new Date(existingBooking.startTime)
      const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilBooking < existingBooking.organization.bookingChangeHours) {
        return NextResponse.json(
          { 
            error: `Bookings can only be changed ${existingBooking.organization.bookingChangeHours} hours or more before the session starts.` 
          },
          { status: 403 }
        )
      }
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: newStatus,
      },
    })

    return NextResponse.json(updatedBooking)
  } catch (error: any) {
    console.error('Error updating booking:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
