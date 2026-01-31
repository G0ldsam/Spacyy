import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/sessions/[id]/timetable/[slotId] - Delete time slot
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; slotId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify time slot exists and user has access
    const timeSlot = await prisma.timeSlot.findUnique({
      where: { id: params.slotId },
      include: {
        serviceSession: {
          select: { organizationId: true },
        },
      },
    })

    if (!timeSlot) {
      return NextResponse.json({ error: 'Time slot not found' }, { status: 404 })
    }

    if (timeSlot.serviceSessionId !== params.id) {
      return NextResponse.json({ error: 'Time slot does not belong to this session' }, { status: 400 })
    }

    const hasAccess = session.user.organizations?.some(
      (org) => org.organization.id === timeSlot.serviceSession.organizationId && (org.role === 'OWNER' || org.role === 'ADMIN')
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.timeSlot.delete({
      where: { id: params.slotId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting time slot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
