import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/interest?sessionId=&timeSlotId=&date=
// Admins get the full list with client details.
// Clients get only their own entry for this slot.
export async function GET(req: NextRequest) {
  const result = await verifyTenantAccess()
  if ('error' in result) return result.error
  const { tenant } = result

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const sessionId = searchParams.get('sessionId')
  const timeSlotId = searchParams.get('timeSlotId')
  const date = searchParams.get('date')

  if (!sessionId || !timeSlotId || !date) {
    return NextResponse.json({ error: 'sessionId, timeSlotId and date are required' }, { status: 400 })
  }

  const entryDate = new Date(date)
  entryDate.setHours(0, 0, 0, 0)
  const nextDay = new Date(entryDate)
  nextDay.setDate(nextDay.getDate() + 1)

  const userOrg = session.user.organizations?.find(
    (org) => org.organization.id === tenant.organizationId
  )
  const isAdmin = userOrg?.role === 'OWNER' || userOrg?.role === 'ADMIN'

  if (isAdmin) {
    const entries = await prisma.interestEntry.findMany({
      where: {
        organizationId: tenant.organizationId,
        sessionId,
        timeSlotId,
        date: { gte: entryDate, lt: nextDay },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(entries)
  }

  // Client — return only their own entry
  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, organizationId: tenant.organizationId },
  })
  if (!client) return NextResponse.json(null)

  const entry = await prisma.interestEntry.findFirst({
    where: {
      organizationId: tenant.organizationId,
      sessionId,
      timeSlotId,
      clientId: client.id,
      date: { gte: entryDate, lt: nextDay },
    },
  })
  return NextResponse.json(entry)
}

// POST /api/interest
// Body: { sessionId, timeSlotId, date }
export async function POST(req: NextRequest) {
  const result = await verifyTenantAccess()
  if ('error' in result) return result.error
  const { tenant } = result

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, organizationId: tenant.organizationId },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await req.json()
  const { sessionId, timeSlotId, date } = body

  if (!sessionId || !timeSlotId || !date) {
    return NextResponse.json({ error: 'sessionId, timeSlotId and date are required' }, { status: 400 })
  }

  // Verify session belongs to this org
  const serviceSession = await prisma.serviceSession.findUnique({
    where: { id: sessionId },
    select: { organizationId: true },
  })
  if (!serviceSession || serviceSession.organizationId !== tenant.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entryDate = new Date(date)
  entryDate.setHours(0, 0, 0, 0)

  const entry = await prisma.interestEntry.upsert({
    where: { sessionId_timeSlotId_date_clientId: { sessionId, timeSlotId, date: entryDate, clientId: client.id } },
    create: { organizationId: tenant.organizationId, sessionId, timeSlotId, date: entryDate, clientId: client.id },
    update: {},
  })

  return NextResponse.json(entry, { status: 201 })
}
