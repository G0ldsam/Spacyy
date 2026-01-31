import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const renewSchema = z.object({
  sessionsToAdd: z.number().int().positive(),
})

// POST /api/admin/clients/[id]/renew - Add sessions to client's allowance
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/owner
    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validated = renewSchema.parse(body)

    // Verify client belongs to organization
    const client = await prisma.client.findFirst({
      where: {
        id: params.id,
        organizationId: userOrg.organization.id,
      },
      select: {
        id: true,
        sessionAllowance: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Calculate new allowance
    let newAllowance: number | null
    if (client.sessionAllowance === null) {
      // If currently unlimited, keep it unlimited (can't add to unlimited)
      newAllowance = null
    } else {
      // Add sessions to existing allowance
      newAllowance = client.sessionAllowance + validated.sessionsToAdd
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        sessionAllowance: newAllowance,
      },
      select: {
        id: true,
        name: true,
        email: true,
        sessionAllowance: true,
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

    console.error('Error renewing membership:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
