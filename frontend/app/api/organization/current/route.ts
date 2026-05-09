import { NextResponse } from 'next/server'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/organization/current — returns the current tenant's org ID for client-side role checks
export async function GET() {
  const result = await verifyTenantAccess()
  if ('error' in result) return result.error
  const { tenant } = result
  return NextResponse.json({ id: tenant.organizationId, slug: tenant.slug })
}
