import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/interest/my — returns all waitlist entries for the current client
export async function GET() {
  const result = await verifyTenantAccess()
  if ('error' in result) return result.error
  const { tenant } = result

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, organizationId: tenant.organizationId },
  })
  if (!client) return NextResponse.json([])

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const entries = await prisma.interestEntry.findMany({
    where: {
      clientId: client.id,
      organizationId: tenant.organizationId,
      date: { gte: now },
    },
    include: {
      session: { select: { id: true, name: true, themeColor: true } },
      timeSlot: { select: { id: true, startTime: true, endTime: true } },
    },
    orderBy: [{ date: 'asc' }, { timeSlot: { startTime: 'asc' } }],
  })

  return NextResponse.json(entries)
}
