import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { sendMembershipRenewedEmail } from '@/lib/email'
import { createNotification } from '@/lib/notify'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const renewSchema = z.object({
  sessionsToAdd: z.number().int().positive(),
})

// POST /api/admin/clients/[id]/renew - Add sessions to client's allowance
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const body = await req.json()
    const validated = renewSchema.parse(body)

    // Verify client belongs to organization
    const [client, org] = await Promise.all([
      prisma.client.findFirst({
        where: { id: params.id, organizationId: tenant.organizationId },
        select: { id: true, name: true, email: true, userId: true, sessionAllowance: true },
      }),
      prisma.organization.findUnique({
        where: { id: tenant.organizationId },
        select: { name: true },
      }),
    ])

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Count active bookings (non-cancelled and not past)
    const now = new Date()
    const activeBookingsCount = await prisma.booking.count({
      where: {
        clientId: params.id,
        status: {
          not: 'CANCELLED',
        },
        endTime: {
          gte: now, // Only count future bookings
        },
      },
    })

    // Calculate new allowance
    let newAllowance: number | null
    if (client.sessionAllowance === null) {
      // If currently unlimited, keep it unlimited (can't add to unlimited)
      newAllowance = null
    } else {
      // If all sessions are used, reset to 0 and add new sessions
      // Otherwise, add to existing allowance
      if (activeBookingsCount >= client.sessionAllowance) {
        // All sessions used - reset to 0 and add new sessions
        newAllowance = validated.sessionsToAdd
      } else {
        // Some sessions remaining - add to existing allowance
        newAllowance = client.sessionAllowance + validated.sessionsToAdd
      }
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: {
        sessionAllowance: newAllowance,
        pendingSlotsUsed: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        sessionAllowance: true,
        pendingSlotsUsed: true,
      },
    })

    if (newAllowance !== null) {
      const orgName = org?.name ?? ''
      if (updated.email) {
        sendMembershipRenewedEmail({
          clientEmail: updated.email,
          clientName: updated.name,
          orgName,
          sessionsAdded: validated.sessionsToAdd,
          newAllowance,
        }).catch(console.error)
      }
      if (updated.userId) {
        createNotification(updated.userId, {
          title: 'Membership renewed',
          body: `${validated.sessionsToAdd} session${validated.sessionsToAdd !== 1 ? 's' : ''} added to your ${orgName} membership`,
          url: '/home',
        }).catch(console.error)
      }
    }

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
