import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardClient from '@/components/DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const userOrg = session.user.organizations?.find(
    (org) => org.role === 'OWNER' || org.role === 'ADMIN'
  )

  if (!userOrg) {
    redirect('/home')
  }

  const now = new Date()

  let sessionsCount = 0
  let activeBookingsCount = 0
  let totalBookingsCount = 0
  let clientsCount = 0

  try {
    const adminUserOrgs = await prisma.userOrganization.findMany({
      where: { organizationId: userOrg.organization.id, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    })
    const adminUserIds = adminUserOrgs.map((u) => u.userId)

    ;[sessionsCount, activeBookingsCount, totalBookingsCount, clientsCount] = await Promise.all([
      prisma.serviceSession.count({
        where: { organizationId: userOrg.organization.id },
      }),
      prisma.booking.count({
        where: {
          organizationId: userOrg.organization.id,
          startTime: { gt: now },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      prisma.booking.count({
        where: { organizationId: userOrg.organization.id },
      }),
      prisma.client.count({
        where: {
          organizationId: userOrg.organization.id,
          OR: [
            { userId: null },
            { userId: { notIn: adminUserIds } },
          ],
        },
      }),
    ])
  } catch (err) {
    console.error('Dashboard DB error (likely DB cold start):', err)
  }

  return (
    <DashboardClient
      userName={session.user.name}
      userEmail={session.user.email}
      activeBookingsCount={activeBookingsCount}
      totalBookingsCount={totalBookingsCount}
      sessionsCount={sessionsCount}
      clientsCount={clientsCount}
    />
  )
}
