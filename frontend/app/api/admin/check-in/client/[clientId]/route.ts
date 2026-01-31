import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

// GET /api/admin/check-in/[clientId] - Get client's booking for today
export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
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

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: params.clientId,
        organizationId: userOrg.organization.id,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Find today's booking for this client
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    const booking = await prisma.booking.findFirst({
      where: {
        clientId: params.clientId,
        startTime: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        serviceSession: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'No booking found for today' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      bookingId: booking.id,
      sessionName: booking.serviceSession?.name || 'Session',
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      status: booking.checkedIn ? 'CHECKED_IN' : 'PENDING',
    })
  } catch (error) {
    console.error('Error fetching check-in info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
