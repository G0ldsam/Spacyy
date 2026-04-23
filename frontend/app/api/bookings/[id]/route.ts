import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'
import { notifyAdminCancellation } from '@/lib/email'
import { sendPushToUsers } from '@/lib/push'

export const dynamic = 'force-dynamic'

// GET /api/bookings/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const client = await prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: tenant.organizationId },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        serviceSession: { select: { id: true, name: true, description: true, themeColor: true } },
        organization: { select: { bookingChangeHours: true } },
      },
    })
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.clientId !== client.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/bookings/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { status: newStatus, isReschedule } = body
    if (!newStatus) return NextResponse.json({ error: 'Status is required' }, { status: 400 })

    // Determine if the caller is an admin/owner of this org
    const userOrg = session.user.organizations?.find(
      (org) => org.organization.id === tenant.organizationId
    )
    const isAdmin = userOrg?.role === 'OWNER' || userOrg?.role === 'ADMIN'

    const existingBooking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        organization: { select: { bookingChangeHours: true, name: true } },
        client: { select: { id: true, name: true } },
        serviceSession: { select: { name: true } },
      },
    })
    if (!existingBooking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    if (isAdmin) {
      // Admins can update any booking within their org
      if (existingBooking.organizationId !== tenant.organizationId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Clients can only update their own booking
      const client = await prisma.client.findFirst({
        where: { userId: session.user.id, organizationId: tenant.organizationId },
      })
      if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      if (existingBooking.clientId !== client.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Enforce booking change policy for non-cancellation changes
      if (newStatus !== 'CANCELLED' && existingBooking.organization.bookingChangeHours !== null) {
        const hoursUntil =
          (new Date(existingBooking.startTime).getTime() - Date.now()) / (1000 * 60 * 60)
        if (hoursUntil < existingBooking.organization.bookingChangeHours) {
          return NextResponse.json(
            {
              error: `Bookings can only be changed ${existingBooking.organization.bookingChangeHours} hours or more before the session starts.`,
            },
            { status: 403 }
          )
        }
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: { status: newStatus },
    })

    // Notify org admins when a CLIENT (not admin) cancels or reschedules
    if (!isAdmin && newStatus === 'CANCELLED') {
      const admins = await prisma.userOrganization.findMany({
        where: {
          organizationId: tenant.organizationId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        include: { user: { select: { id: true, email: true } } },
      })
      const adminEmails = admins.map((a) => a.user.email).filter(Boolean) as string[]
      const adminUserIds = admins.map((a) => a.user.id)
      const action = isReschedule ? 'rescheduled' : 'cancelled'

      notifyAdminCancellation({
        adminEmails,
        orgName: existingBooking.organization.name,
        clientName: existingBooking.client.name,
        sessionName: existingBooking.serviceSession?.name ?? 'Session',
        startTime: existingBooking.startTime,
        isReschedule: isReschedule === true,
      }).catch(console.error)

      sendPushToUsers(adminUserIds, {
        title: `Booking ${action}`,
        body: `${existingBooking.client.name} ${action} their ${existingBooking.serviceSession?.name ?? 'session'} booking`,
        url: '/dashboard',
      }).catch(console.error)
    }

    return NextResponse.json(updatedBooking)
  } catch (error: any) {
    console.error('Error updating booking:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
