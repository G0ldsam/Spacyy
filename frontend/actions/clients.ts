'use server'

import { prisma } from '@/lib/prisma'
import { clientSchema } from '@/lib/validation'
import { hash } from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { sendWelcomeEmail, sendMembershipRenewedEmail } from '@/lib/email'
import { createNotification } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from './bookings'

export type { ActionResult }

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sessionAllowance: z.number().int().positive().nullable().optional(),
})

export async function createClient(body: unknown): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const validated = clientSchema.parse(body)
    const organizationId = tenant.organizationId

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true, brandPrimary: true },
    })

    const existing = await prisma.client.findUnique({
      where: { organizationId_email: { organizationId, email: validated.email } },
    })
    if (existing) return { error: 'Client with this email already exists' }

    let tempPassword: string | null = null
    let userId: string | null = null

    if (validated.createAccount) {
      const existingUser = await prisma.user.findUnique({ where: { email: validated.email } })
      if (existingUser) return { error: 'User with this email already exists' }

      tempPassword = randomBytes(4).toString('hex')
      const hashedPassword = await hash(tempPassword, 10)

      const user = await prisma.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          password: hashedPassword,
          mustChangePassword: true,
          organizations: { create: { organizationId, role: 'CLIENT' } },
        },
      })
      userId = user.id

      if (org) {
        const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
        const loginUrl = `https://${org.slug}.${mainDomain}/login`
        sendWelcomeEmail({
          clientEmail: validated.email,
          clientName: validated.name,
          orgName: org.name,
          loginUrl,
          tempPassword,
          brandColor: org.brandPrimary ?? undefined,
        }).catch(console.error)
      }
    }

    const client = await prisma.client.create({
      data: {
        organizationId,
        userId,
        email: validated.email,
        name: validated.name,
        phone: validated.phone,
        notes: validated.notes,
      },
    })

    revalidatePath('/clients')

    return { data: { ...client, tempPassword } }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error creating client:', error)
    return { error: error.message || 'Internal server error' }
  }
}

export async function updateClient(id: string, body: unknown): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const validated = updateClientSchema.parse(body)

    const existingClient = await prisma.client.findUnique({ where: { id }, select: { organizationId: true } })
    if (!existingClient) return { error: 'Client not found' }
    if (existingClient.organizationId !== tenant.organizationId) return { error: 'Forbidden' }

    const updated = await prisma.client.update({ where: { id }, data: validated })

    revalidatePath('/clients')

    return { data: updated }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error updating client:', error)
    return { error: error.message || 'Internal server error' }
  }
}

export async function deleteClient(id: string): Promise<ActionResult<void>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const existingClient = await prisma.client.findUnique({ where: { id }, select: { organizationId: true, userId: true } })
    if (!existingClient) return { error: 'Client not found' }
    if (existingClient.organizationId !== tenant.organizationId) return { error: 'Forbidden' }

    if (existingClient.userId) {
      await prisma.userOrganization.deleteMany({
        where: { userId: existingClient.userId, organizationId: tenant.organizationId },
      })
      const remainingOrgs = await prisma.userOrganization.count({ where: { userId: existingClient.userId } })
      if (remainingOrgs === 0) {
        await prisma.user.delete({ where: { id: existingClient.userId } })
      }
    }

    await prisma.client.delete({ where: { id } })

    revalidatePath('/clients')

    return { data: undefined }
  } catch (error: any) {
    console.error('Error deleting client:', error)
    return { error: error.message || 'Internal server error' }
  }
}

const renewSchema = z.object({ sessionsToAdd: z.number().int().positive() })

export async function renewMembership(id: string, sessionsToAdd: number): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    renewSchema.parse({ sessionsToAdd })

    const [client, org] = await Promise.all([
      prisma.client.findFirst({
        where: { id, organizationId: tenant.organizationId },
        select: { id: true, name: true, email: true, userId: true, sessionAllowance: true, pendingSlotsUsed: true },
      }),
      prisma.organization.findUnique({ where: { id: tenant.organizationId }, select: { name: true, brandPrimary: true } }),
    ])
    if (!client) return { error: 'Client not found' }

    const now = new Date()
    const activeBookingsCount = await prisma.booking.count({
      where: { clientId: id, status: { not: 'CANCELLED' }, endTime: { gte: now } },
    })

    const newAllowance: number | null =
      client.sessionAllowance === null ? null : activeBookingsCount + sessionsToAdd

    const updated = await prisma.client.update({
      where: { id },
      data: { sessionAllowance: newAllowance, pendingSlotsUsed: 0 },
      select: { id: true, name: true, email: true, sessionAllowance: true, pendingSlotsUsed: true, userId: true },
    })

    if (newAllowance !== null) {
      const orgName = org?.name ?? ''
      if (updated.email) {
        sendMembershipRenewedEmail({
          clientEmail: updated.email,
          clientName: updated.name,
          orgName,
          sessionsAdded: sessionsToAdd,
          newAllowance,
          brandColor: org?.brandPrimary ?? undefined,
        }).catch(console.error)
      }
      if (updated.userId) {
        createNotification(updated.userId, {
          title: 'Membership renewed',
          body: `${sessionsToAdd} session${sessionsToAdd !== 1 ? 's' : ''} added to your ${org?.name ?? ''} membership`,
          url: '/rebook',
        }).catch(console.error)
      }
    }

    revalidatePath('/clients')
    revalidatePath('/admin/membership')

    return { data: updated }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error renewing membership:', error)
    return { error: error.message || 'Internal server error' }
  }
}
