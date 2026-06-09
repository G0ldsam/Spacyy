import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// DELETE /api/interest/[id] — client removes their own interest entry, admin can remove any
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await verifyTenantAccess()
  if ('error' in result) return result.error
  const { tenant } = result

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userOrg = session.user.organizations?.find(
    (org) => org.organization.id === tenant.organizationId
  )
  const isAdmin = userOrg?.role === 'OWNER' || userOrg?.role === 'ADMIN'

  const entry = await prisma.interestEntry.findUnique({ where: { id: params.id } })
  if (!entry || entry.organizationId !== tenant.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Admin can delete any entry
  if (isAdmin) {
    await prisma.interestEntry.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  }

  // Client can only delete their own
  const client = await prisma.client.findFirst({
    where: { userId: session.user.id, organizationId: tenant.organizationId },
  })
  if (!client || entry.clientId !== client.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.interestEntry.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
