import { prisma } from '@/lib/prisma'

export interface TenantInfo {
  organizationId: string
  slug: string
  name: string
  type: 'subdomain' | 'custom' | 'main'
}

/**
 * Extract tenant info from hostname
 * 
 * Examples:
 *   - bodyglowpilates.spacyy.com → slug: bodyglowpilates, type: subdomain
 *   - book.bodyglowpilates.com → custom domain lookup
 *   - spacyy.com → main site (null)
 *   - localhost:3000 → use DEV_TENANT_SLUG or query param
 */
export async function getTenantFromHost(hostname: string): Promise<TenantInfo | null> {
  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
  
  // Remove port if present (localhost:3000)
  const host = hostname.split(':')[0]
  
  // Case 1: Localhost development
  if (host === 'localhost' || host === '127.0.0.1') {
    // Will be handled by getTenantFromLocalhost
    return null
  }
  
  // Case 2: Main domain (marketing site)
  if (host === mainDomain || host === `www.${mainDomain}`) {
    return null // No tenant, show marketing site
  }
  
  // Case 3: Subdomain (slug.spacyy.com)
  if (host.endsWith(`.${mainDomain}`)) {
    const slug = host.replace(`.${mainDomain}`, '')
    
    // Don't treat 'www' as a tenant
    if (slug === 'www') {
      return null
    }
    
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true }
    })
    
    if (!org) return null
    
    return {
      organizationId: org.id,
      slug: org.slug,
      name: org.name,
      type: 'subdomain'
    }
  }
  
  // Case 4: Custom domain (book.bodyglowpilates.com)
  const org = await prisma.organization.findFirst({
    where: {
      customDomain: host,
      customDomainVerified: true
    },
    select: { id: true, slug: true, name: true }
  })
  
  if (!org) return null
  
  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
    type: 'custom'
  }
}

/**
 * For localhost development - get tenant from query parameter or env var
 * Usage: http://localhost:3000?org=body-glow-pilates
 */
export function getTenantFromLocalhost(url: URL): string | null {
  // First check query parameter
  const orgParam = url.searchParams.get('org')
  if (orgParam) return orgParam
  
  // Fallback to environment variable
  return process.env.DEV_TENANT_SLUG || null
}

/**
 * Get tenant slug from request (works in both server and edge runtime)
 */
export function extractTenantSlug(hostname: string, mainDomain: string): string | null {
  const host = hostname.split(':')[0]
  
  // Subdomain check
  if (host.endsWith(`.${mainDomain}`)) {
    const slug = host.replace(`.${mainDomain}`, '')
    return slug === 'www' ? null : slug
  }
  
  return null
}
