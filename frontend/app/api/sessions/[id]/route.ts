import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serviceSessionSchema } from '@/lib/validation'
import { verifyTenantAccess, verifyTenantAdmin } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/sessions/[id] - Get single session
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const serviceSession = await prisma.serviceSession.findUnique({
      where: { id: params.id },
      include: {
        timetable: {
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' },
          ],
        },
        organization: true,
      },
    })

    if (!serviceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify session belongs to tenant organization
    if (serviceSession.organizationId !== tenant.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(serviceSession)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/sessions/[id] - Update session
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const body = await req.json()
    const validated = serviceSessionSchema.parse(body)

    // Verify session exists and belongs to tenant organization
    const serviceSession = await prisma.serviceSession.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    })

    if (!serviceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (serviceSession.organizationId !== tenant.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.serviceSession.update({
      where: { id: params.id },
      data: {
        name: validated.name,
        description: validated.description,
        themeColor: validated.themeColor,
        slots: validated.slots,
      },
      include: {
        timetable: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[id] - Delete session
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    // Verify session exists and belongs to tenant organization
    const serviceSession = await prisma.serviceSession.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    })

    if (!serviceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (serviceSession.organizationId !== tenant.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete the session (cascade will delete timetable and bookings)
    await prisma.serviceSession.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
