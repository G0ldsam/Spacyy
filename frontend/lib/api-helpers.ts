import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface TenantContext {
  organizationId: string
  slug: string
  name: string
  type: string
}

/**
 * Get tenant context from request host header.
 * First tries middleware-injected headers, then resolves directly from hostname.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const headersList = headers()

  // Fast path: middleware already resolved the tenant
  const tenantId = headersList.get('x-tenant-id')
  const tenantSlug = headersList.get('x-tenant-slug')
  const tenantName = headersList.get('x-tenant-name')
  const tenantType = headersList.get('x-tenant-type')

  if (tenantId && tenantSlug) {
    return {
      organizationId: tenantId,
      slug: tenantSlug,
      name: tenantName || '',
      type: tenantType || 'subdomain',
    }
  }

  // Fallback: resolve from host header directly
  const host = headersList.get('host') || ''
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
  const hostname = host.split(':')[0]

  let org: { id: string; slug: string; name: string } | null = null
  let type = 'subdomain'

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local dev: use DEV_TENANT_SLUG env var
    const devSlug = process.env.DEV_TENANT_SLUG
    if (!devSlug) return null
    org = await prisma.organization.findUnique({
      where: { slug: devSlug },
      select: { id: true, slug: true, name: true },
    })
    type = 'dev'
  } else if (hostname.endsWith(`.${mainDomain}`)) {
    const slug = hostname.replace(`.${mainDomain}`, '')
    if (slug && slug !== 'www') {
      org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true },
      })
    }
  } else if (hostname !== mainDomain && hostname !== `www.${mainDomain}`) {
    // Custom domain lookup
    org = await prisma.organization.findFirst({
      where: { customDomain: hostname, customDomainVerified: true },
      select: { id: true, slug: true, name: true },
    })
    type = 'custom'
  }

  if (!org) return null

  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
    type,
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

  if (tenant) {
    const hasAccess = session.user.organizations?.some(
      (org) => org.organization.id === tenant.organizationId
    )
    if (!hasAccess) {
      return { error: NextResponse.json({ error: 'Forbidden - No access to this organization' }, { status: 403 }) }
    }
    return { tenant }
  }

  // No tenant from hostname — fall back to the user's own org (e.g. client on main domain)
  const sessionOrg = session.user.organizations?.[0]
  if (!sessionOrg) {
    return { error: NextResponse.json({ error: 'No organization context' }, { status: 400 }) }
  }

  return {
    tenant: {
      organizationId: sessionOrg.organization.id,
      slug: sessionOrg.organization.slug,
      name: sessionOrg.organization.name,
      type: 'session',
    },
  }
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
