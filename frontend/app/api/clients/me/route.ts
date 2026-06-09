import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const clientSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  notes: true,
  sessionAllowance: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET() {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fast path: already linked by userId
    let client = await prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: tenant.organizationId },
      select: clientSelect,
    })

    // Upsert by email: links existing admin-created record or creates a new one atomically
    client ??= await prisma.client.upsert({
        where: {
          organizationId_email: {
            organizationId: tenant.organizationId,
            email: session.user.email || '',
          },
        },
        create: {
          userId: session.user.id,
          organizationId: tenant.organizationId,
          email: session.user.email || '',
          name: session.user.name || session.user.email || 'Client',
        },
        update: { userId: session.user.id },
        select: clientSelect,
      })

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
