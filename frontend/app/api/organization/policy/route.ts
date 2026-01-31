import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const policySchema = z.object({
  bookingChangeHours: z.number().int().min(0).nullable().optional(),
  requireMembershipForBooking: z.boolean().optional(),
})

// GET /api/organization/policy - Get policy settings
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization from user (must be owner/admin)
    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: userOrg.organization.id },
      select: {
        bookingChangeHours: true,
        requireMembershipForBooking: true,
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json(organization)
  } catch (error) {
    console.error('Error fetching policy settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/organization/policy - Update policy settings
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = policySchema.parse(body)

    // Get organization from user (must be owner/admin)
    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.organization.update({
      where: { id: userOrg.organization.id },
      data: {
        bookingChangeHours: validated.bookingChangeHours ?? undefined,
        requireMembershipForBooking: validated.requireMembershipForBooking ?? undefined,
      },
      select: {
        bookingChangeHours: true,
        requireMembershipForBooking: true,
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

    console.error('Error updating policy settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
