import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serviceSessionSchema } from '@/lib/validation'

// GET /api/sessions - List sessions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization from user's first organization
    const userOrg = session.user.organizations?.[0]
    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }
    const organizationId = userOrg.organization.id

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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = serviceSessionSchema.parse(body)

    // Get organization from user (must be owner/admin)
    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organizationId = userOrg.organization.id

    const serviceSession = await prisma.serviceSession.create({
      data: {
        organizationId,
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
