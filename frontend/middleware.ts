import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { getTenantFromHost, getTenantFromLocalhost } from '@/lib/tenant'

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname
    const hostname = req.headers.get('host') || ''

    // Detect organization from domain/subdomain
    let tenantInfo = null
    
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      // Development: use query parameter or env var
      const slug = getTenantFromLocalhost(req.nextUrl)
      if (slug) {
        const { prisma } = await import('@/lib/prisma')
        const org = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true, slug: true, name: true }
        })
        if (org) {
          tenantInfo = {
            organizationId: org.id,
            slug: org.slug,
            name: org.name,
            type: 'subdomain' as const
          }
        }
      }
    } else {
      // Production: detect from hostname
      tenantInfo = await getTenantFromHost(hostname)
    }
    
    // If no tenant found and not main domain, show 404
    const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'
    const isMainDomain = hostname === mainDomain || hostname === `www.${mainDomain}` || hostname.includes('localhost')
    
    if (!tenantInfo && !isMainDomain) {
      return NextResponse.rewrite(new URL('/404', req.url))
    }
    
    // Create response with tenant headers
    const response = NextResponse.next()
    
    if (tenantInfo) {
      response.headers.set('x-tenant-id', tenantInfo.organizationId)
      response.headers.set('x-tenant-slug', tenantInfo.slug)
      response.headers.set('x-tenant-name', tenantInfo.name)
      response.headers.set('x-tenant-type', tenantInfo.type)
    }
    
    // If has token and on login page, redirect based on mustChangePassword and role
    if (token && path.startsWith('/login')) {
      if ((token as any).mustChangePassword) {
        const redirectResponse = NextResponse.redirect(new URL('/change-password', req.url))
        if (tenantInfo) {
          redirectResponse.headers.set('x-tenant-id', tenantInfo.organizationId)
          redirectResponse.headers.set('x-tenant-slug', tenantInfo.slug)
          redirectResponse.headers.set('x-tenant-name', tenantInfo.name)
          redirectResponse.headers.set('x-tenant-type', tenantInfo.type)
        }
        return redirectResponse
      }
      // Check if user is admin/owner or client
      const organizations = (token as any).organizations || []
      const isAdmin = organizations.some((org: any) => org.role === 'OWNER' || org.role === 'ADMIN')
      const redirectResponse = isAdmin 
        ? NextResponse.redirect(new URL('/dashboard', req.url))
        : NextResponse.redirect(new URL('/home', req.url))
      
      if (tenantInfo) {
        redirectResponse.headers.set('x-tenant-id', tenantInfo.organizationId)
        redirectResponse.headers.set('x-tenant-slug', tenantInfo.slug)
        redirectResponse.headers.set('x-tenant-name', tenantInfo.name)
        redirectResponse.headers.set('x-tenant-type', tenantInfo.type)
      }
      return redirectResponse
    }

    // If user must change password and not on change-password page, redirect
    if (token && (token as any).mustChangePassword && !path.startsWith('/change-password')) {
      const redirectResponse = NextResponse.redirect(new URL('/change-password', req.url))
      if (tenantInfo) {
        redirectResponse.headers.set('x-tenant-id', tenantInfo.organizationId)
        redirectResponse.headers.set('x-tenant-slug', tenantInfo.slug)
        redirectResponse.headers.set('x-tenant-name', tenantInfo.name)
        redirectResponse.headers.set('x-tenant-type', tenantInfo.type)
      }
      return redirectResponse
    }

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        
        // Allow access to login and change-password pages
        if (path.startsWith('/login') || path.startsWith('/change-password')) {
          return true
        }
        
        // Require token for protected routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/book/:path*', '/home/:path*', '/my-sessions/:path*', '/login', '/change-password', '/clients/:path*', '/sessions/:path*', '/bookings/:path*', '/policy/:path*', '/membership/:path*', '/admin/:path*'],
}
