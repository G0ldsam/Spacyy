import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serviceSessionSchema } from '@/lib/validation'
import { verifyTenantAccess, verifyTenantAdmin, getTenantContext } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/sessions - List sessions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve org: tenant context first, fall back to user's session org
    const tenant = await getTenantContext()
    const organizationId = tenant
      ? tenant.organizationId
      : session.user.organizations?.[0]?.organization.id

    if (!organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 })
    }

    // Verify user belongs to this org
    const hasAccess = session.user.organizations?.some(
      (org) => org.organization.id === organizationId
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sessions = await prisma.serviceSession.findMany({
      where: {
        organizationId,
      },
      include: {
        timetable: {
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' },
          ],
        },
        _count: {
          select: {
            bookings: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/sessions - Create session
export async function POST(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error

    const { tenant } = result

    const body = await req.json()
    const validated = serviceSessionSchema.parse(body)

    const serviceSession = await prisma.serviceSession.create({
      data: {
        organizationId: tenant.organizationId,
        name: validated.name,
        description: validated.description,
        themeColor: validated.themeColor,
        slots: validated.slots,
      },
      include: {
        timetable: true,
      },
    })

    return NextResponse.json(serviceSession, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
