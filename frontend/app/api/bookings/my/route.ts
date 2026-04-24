import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/bookings/my - Get current user's bookings
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let client = await prisma.client.findFirst({
      where: {
        userId: session.user.id,
        organizationId: tenant.organizationId,
      },
      select: { id: true },
    })

    // Fallback: find by email (covers cases where userId wasn't linked yet)
    if (!client && session.user.email) {
      client = await prisma.client.findUnique({
        where: {
          organizationId_email: {
            organizationId: tenant.organizationId,
            email: session.user.email.toLowerCase(),
          },
        },
        select: { id: true },
      })

      // Link the userId so future lookups are fast
      if (client) {
        await prisma.client.update({
          where: { id: client.id },
          data: { userId: session.user.id },
        })
      }
    }

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
