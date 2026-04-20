import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/admin/clients/[id] - Get client info for admin
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: tenant.organizationId,
      },
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
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const body = await req.json()
    const { sessionAllowance } = body

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: tenant.organizationId,
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
