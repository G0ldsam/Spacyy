import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/clients/[id] - Get client info for admin
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        sessionAllowance: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Verify client belongs to same organization
    if (client.id !== params.id) {
      // Additional check: verify organization
      const clientOrg = await prisma.client.findFirst({
        where: {
          id: params.id,
          organizationId: userOrg.organization.id,
        },
      })

      if (!clientOrg) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Count active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        clientId: params.id,
        status: {
          not: 'CANCELLED',
        },
      },
    })

    return NextResponse.json({
      ...client,
      activeBookings,
    })
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/clients/[id] - Update client (for membership renewal)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const body = await req.json()
    const { sessionAllowance } = body

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: userOrg.organization.id,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        sessionAllowance: sessionAllowance !== undefined ? sessionAllowance : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        sessionAllowance: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
