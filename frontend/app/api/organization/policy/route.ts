import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verifyTenantAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const policySchema = z.object({
  bookingChangeHours: z.number().int().min(0).nullable().optional(),
  allowPendingSlot: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const organization = await prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      select: {
        bookingChangeHours: true,
        allowPendingSlot: true,
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json(organization)
  } catch (error) {
    console.error('Error fetching policy settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const body = await req.json()
    const validated = policySchema.parse(body)

    const updated = await prisma.organization.update({
      where: { id: tenant.organizationId },
      data: {
        bookingChangeHours: validated.bookingChangeHours ?? undefined,
        allowPendingSlot: validated.allowPendingSlot ?? undefined,
      },
      select: {
        bookingChangeHours: true,
        allowPendingSlot: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error updating policy settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
