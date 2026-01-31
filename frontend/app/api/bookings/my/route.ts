import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/bookings/my - Get current user's bookings
export async function GET(req: NextRequest) {
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
      return NextResponse.json([])
    }

    const bookings = await prisma.booking.findMany({
      where: {
        clientId: client.id,
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        serviceSession: {
          select: {
            id: true,
            name: true,
            themeColor: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching user bookings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
