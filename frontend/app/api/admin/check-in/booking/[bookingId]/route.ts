import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/admin/check-in/booking/[bookingId] - Check in a client for their booking
export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/owner
    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify booking belongs to organization
    const booking = await prisma.booking.findFirst({
      where: {
        id: params.bookingId,
        organizationId: userOrg.organization.id,
        status: {
          not: 'CANCELLED',
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.checkedIn) {
      return NextResponse.json(
        { error: 'Client already checked in' },
        { status: 400 }
      )
    }

    // Check in the client
    const updated = await prisma.booking.update({
      where: { id: params.bookingId },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
        serviceSession: {
          select: {
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${updated.client.name} checked in for ${updated.serviceSession?.name || 'session'}`,
    })
  } catch (error) {
    console.error('Error checking in client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
