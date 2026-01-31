import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { timeSlotSchema } from '@/lib/validation'

// POST /api/sessions/[id]/timetable - Add time slot
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = timeSlotSchema.parse(body)

    // Verify session exists and user has access
    const serviceSession = await prisma.serviceSession.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    })

    if (!serviceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const hasAccess = session.user.organizations?.some(
      (org) => org.organization.id === serviceSession.organizationId && (org.role === 'OWNER' || org.role === 'ADMIN')
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const timeSlot = await prisma.timeSlot.create({
      data: {
        serviceSessionId: params.id,
        dayOfWeek: validated.dayOfWeek,
        startTime: validated.startTime,
        endTime: validated.endTime,
      },
    })

    return NextResponse.json(timeSlot, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating time slot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
