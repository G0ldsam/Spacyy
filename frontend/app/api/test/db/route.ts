import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔍 Testing database connection...')
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
    console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0)
    
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ 
        error: 'DATABASE_URL not found',
        env: process.env.NODE_ENV 
      }, { status: 500 })
    }

    // Import prisma and test connection
    const { prisma } = await import('@/lib/prisma')
    
    // Simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connection successful')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection working',
      result,
      env: process.env.NODE_ENV
    })
    
  } catch (error) {
    console.error('🚨 Database connection failed:', error)
    
    return NextResponse.json({ 
      error: 'Database connection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      env: process.env.NODE_ENV
    }, { status: 500 })
  }
}