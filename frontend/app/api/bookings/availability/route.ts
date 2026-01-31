import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/bookings/availability - Get bookings for a specific session and date
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')
    const date = searchParams.get('date')

    if (!sessionId || !date) {
      return NextResponse.json(
        { error: 'sessionId and date are required' },
        { status: 400 }
      )
    }

    // Parse the date
    const selectedDate = new Date(date)
    const startOfDay = new Date(selectedDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDate)
    endOfDay.setHours(23, 59, 59, 999)

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
      const startTime = booking.startTime.toTimeString().slice(0, 5) // HH:mm format
      const endTime = booking.endTime.toTimeString().slice(0, 5) // HH:mm format
      return {
        id: booking.id,
        startTime,
        endTime,
        status: booking.status,
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
