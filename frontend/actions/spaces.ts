'use server'

import { prisma } from '@/lib/prisma'
import { spaceSchema } from '@/lib/validation'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from './bookings'

export type { ActionResult }

export async function createSpace(body: unknown): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const validated = spaceSchema.parse(body)

    const space = await prisma.space.create({
      data: {
        organizationId: tenant.organizationId,
        name: validated.name,
        description: validated.description,
        capacity: validated.capacity || 1,
        metadata: validated.metadata,
      },
    })

    revalidatePath('/spaces')

    return { data: space }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error creating space:', error)
    return { error: error.message || 'Internal server error' }
  }
}
