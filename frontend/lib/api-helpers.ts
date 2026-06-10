import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface TenantContext {
  organizationId: string
  slug: string
  name: string
  type: string
}

const getCachedOrgBySlug = unstable_cache(
  async (slug: string) =>
    prisma.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    }),
  ['tenant-slug'],
  { revalidate: 600 }
)

const getCachedOrgByDomain = unstable_cache(
  async (domain: string) =>
    prisma.organization.findFirst({
      where: { customDomain: domain, customDomainVerified: true },
      select: { id: true, slug: true, name: true },
    }),
  ['tenant-domain'],
  { revalidate: 600 }
)

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

  const host = headersList.get('host') || ''
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
  const hostname = host.split(':')[0]

  let org: { id: string; slug: string; name: string } | null = null
  let type = 'subdomain'

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const devSlug = process.env.DEV_TENANT_SLUG
    if (!devSlug) return null
    org = await getCachedOrgBySlug(devSlug)
    type = 'dev'
  } else if (hostname.endsWith(`.${mainDomain}`)) {
    const slug = hostname.replace(`.${mainDomain}`, '')
    if (slug && slug !== 'www') {
      org = await getCachedOrgBySlug(slug)
    }
  } else if (hostname !== mainDomain && hostname !== `www.${mainDomain}`) {
    org = await getCachedOrgByDomain(hostname)
    type = 'custom'
  }

  if (!org) return null

  return { organizationId: org.id, slug: org.slug, name: org.name, type }
}

export async function verifyTenantAccess(): Promise<
  { tenant: TenantContext } | { error: NextResponse }
> {
  const session = await getSession()

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

export async function verifyTenantAdmin(): Promise<
  { tenant: TenantContext } | { error: NextResponse }
> {
  const session = await getSession()

  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const tenant = await getTenantContext()

  if (!tenant) {
    // No hostname tenant — find admin org from JWT
    const adminOrg = session.user.organizations?.find(
      (o) => o.role === 'OWNER' || o.role === 'ADMIN'
    )
    if (!adminOrg) {
      return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) }
    }
    return {
      tenant: {
        organizationId: adminOrg.organization.id,
        slug: adminOrg.organization.slug,
        name: adminOrg.organization.name,
        type: 'session',
      },
    }
  }

  // Verify admin role from JWT — stale for at most one JWT lifetime after a role change
  const jwtOrg = session.user.organizations?.find(
    (o) =>
      o.organization.id === tenant.organizationId &&
      (o.role === 'OWNER' || o.role === 'ADMIN')
  )

  if (!jwtOrg) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) }
  }

  return { tenant }
}
