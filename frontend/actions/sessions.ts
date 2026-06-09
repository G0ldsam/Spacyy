'use server'

import { prisma } from '@/lib/prisma'
import { serviceSessionSchema } from '@/lib/validation'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { ActionResult } from './bookings'

export type { ActionResult }

export async function createSession(body: unknown): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const validated = serviceSessionSchema.parse(body)

    const serviceSession = await prisma.serviceSession.create({
      data: {
        organizationId: tenant.organizationId,
        name: validated.name,
        description: validated.description,
        themeColor: validated.themeColor,
        slots: validated.slots,
      },
      include: { timetable: true },
    })

    revalidatePath('/sessions')
    revalidateTag(`sessions-${tenant.organizationId}`)

    return { data: serviceSession }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error creating session:', error)
    return { error: error.message || 'Internal server error' }
  }
}

export async function updateSession(id: string, body: unknown): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const validated = serviceSessionSchema.parse(body)

    const existing = await prisma.serviceSession.findUnique({ where: { id }, select: { organizationId: true } })
    if (!existing) return { error: 'Session not found' }
    if (existing.organizationId !== tenant.organizationId) return { error: 'Forbidden' }

    const updated = await prisma.serviceSession.update({
      where: { id },
      data: {
        name: validated.name,
        description: validated.description,
        themeColor: validated.themeColor,
        slots: validated.slots,
      },
      include: { timetable: true },
    })

    revalidatePath('/sessions')
    revalidateTag(`sessions-${tenant.organizationId}`)

    return { data: updated }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error updating session:', error)
    return { error: error.message || 'Internal server error' }
  }
}

export async function deleteSession(id: string): Promise<ActionResult<void>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const existing = await prisma.serviceSession.findUnique({ where: { id }, select: { organizationId: true } })
    if (!existing) return { error: 'Session not found' }
    if (existing.organizationId !== tenant.organizationId) return { error: 'Forbidden' }

    await prisma.serviceSession.delete({ where: { id } })

    revalidatePath('/sessions')
    revalidateTag(`sessions-${tenant.organizationId}`)

    return { data: undefined }
  } catch (error: any) {
    console.error('Error deleting session:', error)
    return { error: error.message || 'Internal server error' }
  }
}
