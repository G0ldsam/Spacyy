import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clientSchema } from '@/lib/validation'
import { z } from 'zod'
import { verifyTenantAdmin } from '@/lib/api-helpers'

// PATCH /api/clients/[id] - Update client
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

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

    // Verify client exists and belongs to organization
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
      select: { organizationId: true },
    })

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (existingClient.organizationId !== tenant.organizationId) {
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

// DELETE /api/clients/[id] - Delete client
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    // Verify client exists and belongs to organization
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
      select: { organizationId: true, userId: true },
    })

    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (existingClient.organizationId !== tenant.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Clean up associated User/UserOrganization if applicable
    if (existingClient.userId) {
      // Remove them from this organization's access
      await prisma.userOrganization.deleteMany({
        where: {
          userId: existingClient.userId,
          organizationId: tenant.organizationId,
        },
      })

      // If they belong to no other organizations, we can safely delete the user account entirely
      const remainingOrgs = await prisma.userOrganization.count({
        where: { userId: existingClient.userId },
      })

      if (remainingOrgs === 0) {
        await prisma.user.delete({
          where: { id: existingClient.userId },
        })
      }
    }

    // Delete the client
    await prisma.client.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
