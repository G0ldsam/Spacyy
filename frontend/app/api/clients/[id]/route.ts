import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clientSchema } from '@/lib/validation'
import { z } from 'zod'

// PATCH /api/clients/[id] - Update client
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Allow updating sessionAllowance separately
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      sessionAllowance: z.number().int().positive().nullable().optional(),
    })

    const validated = updateSchema.parse(body)

    // Get organization from user (must be owner/admin)
    const userOrg = session.user.organizations?.find(
      (org) => org.role === 'OWNER' || org.role === 'ADMIN'
    )

    if (!userOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify client exists and belongs to organization
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    })

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (existingClient.organizationId !== userOrg.organization.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update client
    const updated = await prisma.client.update({
      where: { id: params.id },
      data: validated,
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
