import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // If no token, allow access to auth pages
    if (!token && path.startsWith('/login')) {
      return NextResponse.next()
    }

    // If no token and trying to access protected routes, redirect to login
    if (!token && !path.startsWith('/login')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // If has token and on login page, redirect to dashboard
    if (token && path.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/book/:path*', '/login'],
}
