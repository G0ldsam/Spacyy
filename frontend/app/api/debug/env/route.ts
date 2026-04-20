import { NextResponse } from 'next/server'

export async function GET() {
  // Only allow this in development or add authentication
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }
  
  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length || 0,
    NEXTAUTH_SECRET_EXISTS: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_MAIN_DOMAIN: process.env.NEXT_PUBLIC_MAIN_DOMAIN,
  }
  
  return NextResponse.json(envCheck)
}