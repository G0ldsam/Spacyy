import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serviceSessionSchema } from '@/lib/validation'
import { verifyTenantAccess, verifyTenantAdmin } from '@/lib/api-helpers'

// GET /api/sessions - List sessions
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error

    const { tenant } = result

    const sessions = await prisma.serviceSession.findMany({
      where: {
        organizationId: tenant.organizationId,
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
