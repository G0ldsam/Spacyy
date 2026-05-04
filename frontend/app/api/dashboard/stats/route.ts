import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )
    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = userOrg.organization.id
    const now = new Date()

    const adminUserOrgs = await prisma.userOrganization.findMany({
      where: { organizationId: orgId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    })
    const adminUserIds = adminUserOrgs.map((u) => u.userId)

    const [sessionsCount, activeBookingsCount, reservedBookingsCount, totalBookingsCount, clientsCount] = await Promise.all([
      prisma.serviceSession.count({ where: { organizationId: orgId } }),
      prisma.booking.count({
        where: {
          organizationId: orgId,
          startTime: { gt: now },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      prisma.booking.count({
        where: {
          organizationId: orgId,
          startTime: { gt: now },
          status: 'RESERVED',
        },
      }),
      prisma.booking.count({ where: { organizationId: orgId } }),
      prisma.client.count({
        where: {
          organizationId: orgId,
          OR: [{ userId: null }, { userId: { notIn: adminUserIds } }],
        },
      }),
    ])

    return NextResponse.json({ sessionsCount, activeBookingsCount, reservedBookingsCount, totalBookingsCount, clientsCount })
  } catch (err) {
    console.error('Dashboard stats error:', err)
    return NextResponse.json({ sessionsCount: 0, activeBookingsCount: 0, reservedBookingsCount: 0, totalBookingsCount: 0, clientsCount: 0 })
  }
}
