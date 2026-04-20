import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export interface TenantContext {
  organizationId: string
  slug: string
  name: string
  type: string
}

/**
 * Get tenant context from middleware headers
 * This should be called in API routes to get the current organization
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const headersList = headers()
  const tenantId = headersList.get('x-tenant-id')
  const tenantSlug = headersList.get('x-tenant-slug')
  const tenantName = headersList.get('x-tenant-name')
  const tenantType = headersList.get('x-tenant-type')

  if (!tenantId || !tenantSlug) {
    return null
  }

  return {
    organizationId: tenantId,
    slug: tenantSlug,
    name: tenantName || '',
    type: tenantType || 'subdomain'
  }
}

/**
 * Verify that the current user has access to the tenant organization
 * Returns the tenant context if authorized, or an error response
 */
export async function verifyTenantAccess(): Promise<
  { tenant: TenantContext } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tenant = await getTenantContext()
  
  if (!tenant) {
    return { error: NextResponse.json({ error: 'No organization context' }, { status: 400 }) }
  }

  // Verify user has access to this organization
  const hasAccess = session.user.organizations?.some(
    (org) => org.organization.id === tenant.organizationId
  )

  if (!hasAccess) {
    return { error: NextResponse.json({ error: 'Forbidden - No access to this organization' }, { status: 403 }) }
  }

  return { tenant }
}

/**
 * Verify user is an admin/owner of the tenant organization
 */
export async function verifyTenantAdmin(): Promise<
  { tenant: TenantContext } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tenant = await getTenantContext()
  
  if (!tenant) {
    return { error: NextResponse.json({ error: 'No organization context' }, { status: 400 }) }
  }

  // Verify user is admin of this organization
  const userOrg = session.user.organizations?.find(
    (org) => org.organization.id === tenant.organizationId && 
             (org.role === 'OWNER' || org.role === 'ADMIN')
  )

  if (!userOrg) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) }
  }

  return { tenant }
}
