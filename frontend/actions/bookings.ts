'use server'

import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { bookingSchema } from '@/lib/validation'
import { verifyTenantAccess, getTenantContext } from '@/lib/api-helpers'
import {
  notifyAdminNewBooking,
  sendBookingConfirmation,
  sendPendingSlotWarning,
  notifyAdminPendingSlotUsed,
  notifyAdminCancellation,
  notifyClientCancellation,
  notifyClientAdminCancellation,
  notifyAdminBulkBooking,
  sendBulkBookingConfirmation,
} from '@/lib/email'
import { createNotification, createNotifications } from '@/lib/notify'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { BookingStatus } from '@prisma/client'

export type ActionResult<T = void> =
  | { data: T; error?: never }
  | { error: string; data?: never }

export async function createBooking(params: {
  sessionId?: string
  spaceId?: string
  clientId?: string | null
  startTime: string
  endTime: string
  notes?: string
}): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    const validated = bookingSchema.parse(params)

    const isAdmin = session.user.organizations?.some(
      (org) =>
        org.organization.id === tenant.organizationId &&
        (org.role === 'OWNER' || org.role === 'ADMIN')
    )
    if (!isAdmin && new Date(validated.startTime) <= new Date()) {
      return { error: 'This session has already started' }
    }

    let finalOrganizationId = tenant.organizationId
    let serviceSessionSlots: number | null = null

    if (validated.spaceId) {
      const space = await prisma.space.findUnique({
        where: { id: validated.spaceId },
        select: { organizationId: true },
      })
      if (!space) return { error: 'Space not found' }
      finalOrganizationId = space.organizationId
    } else if (validated.sessionId) {
      const svc = await prisma.serviceSession.findUnique({
        where: { id: validated.sessionId },
        select: { organizationId: true, slots: true },
      })
      if (!svc) return { error: 'Session not found' }
      finalOrganizationId = svc.organizationId
      serviceSessionSlots = svc.slots
    }

    if (finalOrganizationId !== tenant.organizationId) return { error: 'Forbidden' }

    const isReserved = !validated.clientId
    const startTimeDate = new Date(validated.startTime)
    const endTimeDate = new Date(validated.endTime)

    // Parallel: org policy + client allowance + duplicate check (latter two only if not reserved)
    const [organization, clientData, duplicate] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: finalOrganizationId },
        select: { allowPendingSlot: true, brandPrimary: true },
      }),
      isReserved
        ? Promise.resolve(null)
        : prisma.client.findUnique({
            where: { id: validated.clientId! },
            select: { sessionAllowance: true },
          }),
      isReserved
        ? Promise.resolve(null)
        : prisma.booking.findFirst({
            where: {
              clientId: validated.clientId,
              sessionId: validated.sessionId || undefined,
              startTime: startTimeDate,
              endTime: endTimeDate,
              status: { not: 'CANCELLED' },
            },
          }),
    ])

    let usePendingSlot = false

    if (!isReserved) {
      if (duplicate) return { error: 'You already have a booking for this session.' }

      if (clientData && clientData.sessionAllowance !== null) {
        const activeBookingsCount = await prisma.booking.count({
          where: {
            clientId: validated.clientId,
            status: { not: 'CANCELLED' },
            endTime: { gte: new Date() },
          },
        })
        if (activeBookingsCount >= clientData.sessionAllowance) {
          if (
            organization?.allowPendingSlot &&
            activeBookingsCount < clientData.sessionAllowance + 1
          ) {
            usePendingSlot = true
          } else {
            return { error: 'Δεν υπάρχουν διαθέσιμες θέσεις. Παρακαλώ ανανεώστε τη συνδρομή σας.' }
          }
        }
      }
    }

    const existingBookings = await prisma.booking.findMany({
      where: {
        sessionId: validated.sessionId || undefined,
        spaceId: validated.spaceId || undefined,
        startTime: startTimeDate,
        endTime: endTimeDate,
        status: { not: 'CANCELLED' },
      },
    })

    if (validated.sessionId && serviceSessionSlots !== null && existingBookings.length >= serviceSessionSlots) {
      return { error: 'No slots available for this time' }
    }

    const booking = await prisma.booking.create({
      data: {
        organizationId: finalOrganizationId,
        spaceId: validated.spaceId,
        sessionId: validated.sessionId,
        clientId: validated.clientId ?? null,
        userId: session.user.id,
        startTime: startTimeDate,
        endTime: endTimeDate,
        status: isReserved ? 'RESERVED' : 'CONFIRMED',
        usedPendingSlot: usePendingSlot,
        notes: validated.notes,
      },
      include: {
        space: { select: { id: true, name: true, capacity: true } },
        client: { select: { id: true, name: true, email: true } },
        serviceSession: { select: { name: true } },
        organization: { select: { name: true } },
      },
    })

    // Auto-remove from waitlist
    if (!isReserved && validated.clientId && validated.sessionId) {
      const bookingDate = new Date(validated.startTime)
      bookingDate.setHours(0, 0, 0, 0)
      const nextDay = new Date(bookingDate)
      nextDay.setDate(nextDay.getDate() + 1)
      const timeSlots = await prisma.timeSlot.findMany({
        where: { serviceSessionId: validated.sessionId },
        select: { id: true, startTime: true, endTime: true },
      })
      const startTimeStr = startTimeDate.toISOString().split('T')[1].slice(0, 5)
      const endTimeStr = endTimeDate.toISOString().split('T')[1].slice(0, 5)
      const matchingSlot = timeSlots.find(
        (ts) => ts.startTime === startTimeStr && ts.endTime === endTimeStr
      )
      if (matchingSlot) {
        await prisma.interestEntry
          .deleteMany({
            where: {
              clientId: validated.clientId,
              sessionId: validated.sessionId,
              timeSlotId: matchingSlot.id,
              date: { gte: bookingDate, lt: nextDay },
            },
          })
          .catch(console.error)
      }
    }

    if (!isReserved) {
      if (usePendingSlot) {
        await prisma.client.update({
          where: { id: validated.clientId! },
          data: { pendingSlotsUsed: { increment: 1 } },
        })
      }

      const sessionName = booking.serviceSession?.name ?? booking.space?.name ?? 'Session'
      const orgName = booking.organization?.name ?? ''
      const admins = await prisma.userOrganization.findMany({
        where: { organizationId: finalOrganizationId, role: { in: ['OWNER', 'ADMIN'] } },
        include: { user: { select: { id: true, email: true } } },
      })
      const adminEmails = admins.map((a) => a.user.email).filter(Boolean) as string[]
      const adminUserIds = admins.map((a) => a.user.id)

      notifyAdminNewBooking({
        adminEmails,
        orgName,
        clientName: booking.client!.name,
        sessionName,
        startTime: booking.startTime,
        brandColor: organization?.brandPrimary ?? undefined,
      }).catch(console.error)
      createNotifications(adminUserIds, {
        title: 'New booking',
        body: `${booking.client!.name} booked ${sessionName} on ${booking.startTime.toLocaleDateString()}`,
        url: '/dashboard',
      }).catch(console.error)

      if (usePendingSlot) {
        sendPendingSlotWarning({
          clientEmail: booking.client!.email,
          clientName: booking.client!.name,
          orgName,
          sessionName,
          startTime: booking.startTime,
          brandColor: organization?.brandPrimary ?? undefined,
        }).catch(console.error)
        notifyAdminPendingSlotUsed({
          adminEmails,
          orgName,
          clientName: booking.client!.name,
          sessionName,
          startTime: booking.startTime,
          brandColor: organization?.brandPrimary ?? undefined,
        }).catch(console.error)
        createNotifications(adminUserIds, {
          title: 'Pending slot used',
          body: `${booking.client!.name} booked ${sessionName} with no remaining allowance — 1 session owed on next renewal`,
          url: '/dashboard',
        }).catch(console.error)
      } else {
        sendBookingConfirmation({
          clientEmail: booking.client!.email,
          clientName: booking.client!.name,
          orgName,
          sessionName,
          startTime: booking.startTime,
          endTime: booking.endTime,
          brandColor: organization?.brandPrimary ?? undefined,
        }).catch(console.error)
      }
    }

    revalidatePath('/home')
    revalidatePath('/my-sessions')

    return { data: booking }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error creating booking:', error)
    return { error: error.message || 'Internal server error' }
  }
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  isReschedule?: boolean
): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    if (!status) return { error: 'Status is required' }

    const userOrg = session.user.organizations?.find((org) => org.organization.id === tenant.organizationId)
    const isAdmin = userOrg?.role === 'OWNER' || userOrg?.role === 'ADMIN'

    const existingBooking = await prisma.booking.findUnique({
      where: { id },
      include: {
        organization: { select: { bookingChangeHours: true, name: true, cancellationPolicy: true, brandPrimary: true } },
        client: { select: { id: true, name: true, email: true, userId: true, sessionAllowance: true, pendingSlotsUsed: true } },
        serviceSession: { select: { name: true } },
      },
    })
    if (!existingBooking) return { error: 'Booking not found' }

    if (isAdmin) {
      if (existingBooking.organizationId !== tenant.organizationId) return { error: 'Forbidden' }
    } else {
      const client = await prisma.client.findFirst({
        where: { userId: session.user.id, organizationId: tenant.organizationId },
      })
      if (!client) return { error: 'Client not found' }
      if (existingBooking.clientId !== client.id) return { error: 'Forbidden' }

      if (status === 'CANCELLED') {
        const policy = existingBooking.organization.cancellationPolicy
        if (policy === 'RESCHEDULE_ONLY' && !isReschedule) {
          return { error: 'Cancellations are not allowed. Please reschedule to another date instead.' }
        }
      }

      if (status !== 'CANCELLED' && existingBooking.organization.bookingChangeHours !== null) {
        const hoursUntil =
          (new Date(existingBooking.startTime).getTime() - Date.now()) / (1000 * 60 * 60)
        if (hoursUntil < existingBooking.organization.bookingChangeHours) {
          return {
            error: `Bookings can only be changed ${existingBooking.organization.bookingChangeHours} hours or more before the session starts.`,
          }
        }
      }
    }

    const updatedBooking = await prisma.booking.update({ where: { id }, data: { status } })

    // Slot accounting on cancellation
    if (status === 'CANCELLED' && existingBooking.clientId && existingBooking.client) {
      const client = existingBooking.client
      const cancellationPolicy = existingBooking.organization.cancellationPolicy

      if (client.sessionAllowance !== null) {
        const isPreSession = existingBooking.startTime > new Date()

        if (cancellationPolicy === 'FORFEIT_SLOT') {
          if (isPreSession || (!existingBooking.usedPendingSlot && client.sessionAllowance > 0)) {
            await prisma.client.update({
              where: { id: existingBooking.clientId },
              data: { sessionAllowance: { decrement: 1 } },
            })
          }
        } else if (isPreSession && existingBooking.usedPendingSlot && client.pendingSlotsUsed > 0) {
          await prisma.client.update({
            where: { id: existingBooking.clientId },
            data: { pendingSlotsUsed: { decrement: 1 } },
          })
        } else if (!isPreSession && !existingBooking.usedPendingSlot && client.sessionAllowance > 0) {
          await prisma.client.update({
            where: { id: existingBooking.clientId },
            data: { sessionAllowance: { decrement: 1 } },
          })
        }
      }
    }

    // Admin cancels client booking
    if (isAdmin && status === 'CANCELLED' && existingBooking.client) {
      if (existingBooking.client.email) {
        notifyClientAdminCancellation({
          clientEmail: existingBooking.client.email,
          clientName: existingBooking.client.name,
          orgName: existingBooking.organization.name,
          sessionName: existingBooking.serviceSession?.name ?? 'Session',
          startTime: existingBooking.startTime,
          brandColor: existingBooking.organization.brandPrimary ?? undefined,
        }).catch(console.error)
      }
      if (existingBooking.client.userId) {
        createNotification(existingBooking.client.userId, {
          title: 'Booking cancelled',
          body: `Your ${existingBooking.serviceSession?.name ?? 'session'} booking was cancelled by ${existingBooking.organization.name}`,
          url: '/home',
        }).catch(console.error)
      }
    }

    // Client cancels their own booking
    if (!isAdmin && status === 'CANCELLED' && existingBooking.client) {
      const admins = await prisma.userOrganization.findMany({
        where: { organizationId: tenant.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
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
        brandColor: existingBooking.organization.brandPrimary ?? undefined,
      }).catch(console.error)

      if (existingBooking.client.email) {
        notifyClientCancellation({
          clientEmail: existingBooking.client.email,
          clientName: existingBooking.client.name,
          orgName: existingBooking.organization.name,
          sessionName: existingBooking.serviceSession?.name ?? 'Session',
          startTime: existingBooking.startTime,
          brandColor: existingBooking.organization.brandPrimary ?? undefined,
        }).catch(console.error)
      }

      createNotifications(adminUserIds, {
        title: `Booking ${action}`,
        body: `${existingBooking.client.name} ${action} their ${existingBooking.serviceSession?.name ?? 'session'} booking`,
        url: '/dashboard',
      }).catch(console.error)
    }

    revalidatePath('/home')
    revalidatePath('/my-sessions')

    return { data: updatedBooking }
  } catch (error: any) {
    console.error('Error updating booking:', error)
    return { error: error.message || 'Internal server error' }
  }
}

const bulkSchema = z.object({
  bookings: z
    .array(z.object({ sessionId: z.string(), startTime: z.string(), endTime: z.string() }))
    .min(1)
    .max(20),
})

type BookingRequest = { sessionId: string; startTime: string; endTime: string }
type ServiceSessionInfo = { id: string; name: string; slots: number }

export async function bulkCreateBookings(
  bookings: BookingRequest[]
): Promise<ActionResult<{ created: number }>> {
  try {
    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    const tenant = await getTenantContext()
    if (!tenant) return { error: 'No tenant context' }

    const { bookings: requests } = bulkSchema.parse({ bookings })

    const client = await prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: tenant.organizationId },
      select: { id: true, sessionAllowance: true, name: true, email: true },
    })
    if (!client) return { error: 'Client not found' }

    const now = new Date()

    if (client.sessionAllowance !== null) {
      const activeCount = await prisma.booking.count({
        where: { clientId: client.id, status: { not: 'CANCELLED' }, endTime: { gte: now } },
      })
      const available = client.sessionAllowance - activeCount
      if (requests.length > available) {
        return {
          error: `Only ${available} session${available === 1 ? '' : 's'} remaining. Select fewer sessions.`,
        }
      }
    }

    const sessionIds = [...new Set(requests.map((r) => r.sessionId))]
    const serviceSessions = await prisma.serviceSession.findMany({
      where: { id: { in: sessionIds }, organizationId: tenant.organizationId, isActive: true },
      select: { id: true, name: true, slots: true },
    })
    const sessionMap = new Map<string, ServiceSessionInfo>(serviceSessions.map((s) => [s.id, s]))

    for (const r of requests) {
      const svc = sessionMap.get(r.sessionId)
      if (!svc) return { error: `Session not found: ${r.sessionId}` }
      if (new Date(r.startTime) <= now) return { error: `${svc.name}: session has already started` }
    }

    let created: Awaited<ReturnType<typeof prisma.booking.create>>[]
    try {
      created = await prisma.$transaction(async (tx) => {
        const parsedTimes = requests.map((r) => ({
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
        }))

        // Parallel capacity checks
        const capacityCounts = await Promise.all(
          requests.map((r, i) =>
            tx.booking.count({
              where: { sessionId: r.sessionId, startTime: parsedTimes[i].startTime, endTime: parsedTimes[i].endTime, status: { not: 'CANCELLED' } },
            })
          )
        )
        for (let i = 0; i < requests.length; i++) {
          const svc = sessionMap.get(requests[i].sessionId)!
          if (capacityCounts[i] >= svc.slots)
            throw Object.assign(new Error(`${svc.name}: no slots available for this time`), { status: 409 })
        }

        // Parallel duplicate checks
        const duplicates = await Promise.all(
          requests.map((r, i) =>
            tx.booking.findFirst({
              where: { clientId: client.id, sessionId: r.sessionId, startTime: parsedTimes[i].startTime, status: { not: 'CANCELLED' } },
              select: { id: true },
            })
          )
        )
        for (let i = 0; i < requests.length; i++) {
          if (duplicates[i]) {
            const svc = sessionMap.get(requests[i].sessionId)!
            throw Object.assign(new Error(`${svc.name}: already booked`), { status: 409 })
          }
        }

        return Promise.all(
          requests.map((r, i) =>
            tx.booking.create({
              data: {
                organizationId: tenant.organizationId,
                sessionId: r.sessionId,
                clientId: client.id,
                userId: session.user.id,
                startTime: parsedTimes[i].startTime,
                endTime: parsedTimes[i].endTime,
                status: 'CONFIRMED',
                usedPendingSlot: false,
              },
            })
          )
        )
      }, { timeout: 15000 })
    } catch (txError: any) {
      // Only expose intentional 409 errors (capacity/duplicate); hide internal errors
      if (txError.status === 409) return { error: txError.message }
      console.error('Bulk booking transaction error:', txError)
      return { error: 'Failed to create bookings. Please try again.' }
    }

    const [org, admins] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: tenant.organizationId },
        select: { name: true, brandPrimary: true },
      }),
      prisma.userOrganization.findMany({
        where: { organizationId: tenant.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
        include: { user: { select: { id: true, email: true } } },
      }),
    ])
    const orgName = org?.name ?? ''
    const adminUserIds = admins.map((a) => a.user.id)
    const adminEmails = admins.map((a) => a.user.email).filter(Boolean)
    const sessionList = requests.map((r) => ({
      name: sessionMap.get(r.sessionId)?.name ?? 'Session',
      startTime: new Date(r.startTime),
      endTime: new Date(r.endTime),
    }))

    notifyAdminBulkBooking({
      adminEmails,
      orgName,
      clientName: client.name,
      count: created.length,
      sessions: sessionList,
      brandColor: org?.brandPrimary ?? undefined,
    }).catch(console.error)
    createNotifications(adminUserIds, {
      title: 'Bulk booking',
      body: `${client.name} booked ${created.length} session${created.length === 1 ? '' : 's'}`,
      url: '/dashboard',
    }).catch(console.error)
    if (client.email) {
      sendBulkBookingConfirmation({
        clientEmail: client.email,
        clientName: client.name,
        orgName,
        count: created.length,
        sessions: sessionList,
        brandColor: org?.brandPrimary ?? undefined,
      }).catch(console.error)
    }

    revalidatePath('/my-sessions')
    revalidatePath('/home')

    return { data: { created: created.length } }
  } catch (error: any) {
    if (error.name === 'ZodError') return { error: 'Validation error' }
    console.error('Error creating bulk bookings:', error)
    return { error: error.message || 'Internal server error' }
  }
}
