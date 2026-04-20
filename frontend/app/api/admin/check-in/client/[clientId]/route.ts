import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'
import { verifyTenantAdmin } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/admin/check-in/[clientId] - Get client's booking for today
export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: params.clientId,
        organizationId: tenant.organizationId,
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
