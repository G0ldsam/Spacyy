import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET /api/bookings/availability - Get bookings for a specific session and date
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const searchParams = req.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')
    const date = searchParams.get('date')

    if (!sessionId || !date) {
      return NextResponse.json(
        { error: 'sessionId and date are required' },
        { status: 400 }
      )
    }

    // Parse the date as explicit UTC boundaries to match naive-UTC stored booking times
    const startOfDay = new Date(`${date}T00:00:00Z`)
    const endOfDay = new Date(`${date}T23:59:59.999Z`)

    // Get all bookings for this session on this date
    const bookings = await prisma.booking.findMany({
      where: {
        sessionId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        checkedIn: true,
        checkedInAt: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Group bookings by time slot (startTime-endTime)
    const timeSlotBookings = bookings.map((booking) => {
      // Use UTC hours so they match TimeSlot.startTime/endTime strings (stored as naive "local" UTC)
      const startTime = booking.startTime.toISOString().slice(11, 16) // HH:mm UTC
      const endTime = booking.endTime.toISOString().slice(11, 16) // HH:mm UTC
      return {
        id: booking.id,
        startTime,
        endTime,
        status: booking.status,
        checkedIn: booking.checkedIn,
        checkedInAt: booking.checkedInAt?.toISOString() || null,
        client: booking.client,
      }
    })

    return NextResponse.json(timeSlotBookings)
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
