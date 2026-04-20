import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  async function middleware(req) {
    try {
      console.log('🌐 Simplified middleware executing for:', req.headers.get('host'))
      
      const token = req.nextauth.token
      const path = req.nextUrl.pathname
      
      // Skip all tenant detection for now - just handle auth redirects
      
      // If has token and on login page, redirect to dashboard/home
      if (token && path.startsWith('/login')) {
        console.log('✅ User logged in, redirecting from login page')
        if ((token as any).mustChangePassword) {
          return NextResponse.redirect(new URL('/change-password', req.url))
        }
        // Check if user is admin/owner or client
        const organizations = (token as any).organizations || []
        const isAdmin = organizations.some((org: any) => org.role === 'OWNER' || org.role === 'ADMIN')
        return isAdmin 
          ? NextResponse.redirect(new URL('/dashboard', req.url))
          : NextResponse.redirect(new URL('/home', req.url))
      }

      // If user must change password and not on change-password page, redirect
      if (token && (token as any).mustChangePassword && !path.startsWith('/change-password')) {
        return NextResponse.redirect(new URL('/change-password', req.url))
      }

      return NextResponse.next()
    } catch (error) {
      console.error('🚨 Simplified middleware error:', error)
      // Always return a response to prevent complete failure
      return NextResponse.next()
    }
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
