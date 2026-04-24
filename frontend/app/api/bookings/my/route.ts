import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTenantContext } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/bookings/my - Get current user's bookings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to resolve tenant from hostname; fall back to any org the user belongs to
    const tenant = await getTenantContext()
    const orgIds: string[] = tenant
      ? [tenant.organizationId]
      : (session.user.organizations?.map((o) => o.organization.id) ?? [])

    if (orgIds.length === 0) {
      return NextResponse.json([])
    }

    // Find client record(s) for this user across the resolved org(s)
    let client = await prisma.client.findFirst({
      where: {
        userId: session.user.id,
        organizationId: { in: orgIds },
      },
      select: { id: true, organizationId: true },
    })

    // Fallback: find by email (covers cases where userId wasn't linked yet)
    if (!client && session.user.email) {
      client = await prisma.client.findFirst({
        where: {
          email: session.user.email.toLowerCase(),
          organizationId: { in: orgIds },
        },
        select: { id: true, organizationId: true },
      })

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
        status: { not: 'CANCELLED' },
      },
      include: {
        serviceSession: {
          select: { id: true, name: true, themeColor: true },
        },
      },
      orderBy: { startTime: 'asc' },
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
