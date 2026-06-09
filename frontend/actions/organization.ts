'use server'

import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from './bookings'

export type { ActionResult }

const policySchema = z.object({
  bookingChangeHours: z.number().int().min(0).nullable().optional(),
  allowPendingSlot: z.boolean().optional(),
  cancellationPolicy: z.enum(['ALLOW_REFUND', 'RESCHEDULE_ONLY', 'FORFEIT_SLOT']).optional(),
})

export async function updatePolicy(body: unknown): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const validated = policySchema.parse(body)

    const updated = await prisma.organization.update({
      where: { id: tenant.organizationId },
      data: {
        bookingChangeHours: validated.bookingChangeHours ?? undefined,
        allowPendingSlot: validated.allowPendingSlot ?? undefined,
        cancellationPolicy: validated.cancellationPolicy ?? undefined,
      },
      select: {
        bookingChangeHours: true,
        allowPendingSlot: true,
        cancellationPolicy: true,
      },
    })

    revalidatePath('/policy')

    return { data: updated }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error updating policy:', error)
    return { error: error.message || 'Internal server error' }
  }
}
