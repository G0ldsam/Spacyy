import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // If has token and on login page, redirect based on mustChangePassword and role
    if (token && path.startsWith('/login')) {
      if ((token as any).mustChangePassword) {
        return NextResponse.redirect(new URL('/change-password', req.url))
      }
      // Check if user is admin/owner or client
      const organizations = (token as any).organizations || []
      const isAdmin = organizations.some((org: any) => org.role === 'OWNER' || org.role === 'ADMIN')
      if (isAdmin) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      } else {
        return NextResponse.redirect(new URL('/home', req.url))
      }
    }

    // If user must change password and not on change-password page, redirect
    if (token && (token as any).mustChangePassword && !path.startsWith('/change-password')) {
      return NextResponse.redirect(new URL('/change-password', req.url))
    }

    return NextResponse.next()
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
