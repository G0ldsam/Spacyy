import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// DELETE /api/interest/[id] — client removes their own interest entry
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await verifyTenantAccess()
  if ('error' in result) return result.error
  const { tenant } = result

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, organizationId: tenant.organizationId },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const entry = await prisma.interestEntry.findUnique({ where: { id: params.id } })
  if (!entry || entry.clientId !== client.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.interestEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
