import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/bookings/dates?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns the distinct dates (YYYY-MM-DD) that have at least one non-cancelled booking
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const { searchParams } = req.nextUrl
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
    }

    const startDate = new Date(start)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)

    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: tenant.organizationId,
        startTime: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
      select: { startTime: true },
    })

    const dates = [...new Set(
      bookings.map((b) => b.startTime.toISOString().split('T')[0])
    )]

    return NextResponse.json({ dates })
  } catch (error) {
    console.error('Error fetching booking dates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
