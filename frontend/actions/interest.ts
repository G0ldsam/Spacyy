'use server'

import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { verifyTenantAccess } from '@/lib/api-helpers'
import { sendInterestListConfirmation, notifyAdminInterestEntry } from '@/lib/email'
import { createNotification, createNotifications } from '@/lib/notify'
import type { ActionResult } from './bookings'

export type { ActionResult }

export async function addInterest(params: {
  sessionId: string
  timeSlotId: string
  date: string
}): Promise<ActionResult<any>> {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return { error: 'Unauthorized' }
    const { tenant } = result

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    const { sessionId, timeSlotId, date } = params
    if (!sessionId || !timeSlotId || !date) return { error: 'sessionId, timeSlotId and date are required' }

    const client = await prisma.client.findFirst({
      where: { userId: session.user.id, organizationId: tenant.organizationId },
    })
    if (!client) return { error: 'Client not found' }

    const serviceSession = await prisma.serviceSession.findUnique({ where: { id: sessionId }, select: { organizationId: true } })
    if (!serviceSession || serviceSession.organizationId !== tenant.organizationId) {
      return { error: 'Not found' }
    }

    const entryDate = new Date(date)
    entryDate.setHours(0, 0, 0, 0)

    const entry = await prisma.interestEntry.upsert({
      where: { sessionId_timeSlotId_date_clientId: { sessionId, timeSlotId, date: entryDate, clientId: client.id } },
      create: { organizationId: tenant.organizationId, sessionId, timeSlotId, date: entryDate, clientId: client.id },
      update: {},
    })

    // Fire-and-forget notifications
    ;(async () => {
      const [sessionData, timeSlotData, orgData, admins] = await Promise.all([
        prisma.serviceSession.findUnique({ where: { id: sessionId }, select: { name: true } }),
        prisma.timeSlot.findUnique({ where: { id: timeSlotId }, select: { startTime: true, endTime: true } }),
        prisma.organization.findUnique({ where: { id: tenant.organizationId }, select: { name: true, brandPrimary: true } }),
        prisma.userOrganization.findMany({
          where: { organizationId: tenant.organizationId, role: { in: ['OWNER', 'ADMIN'] } },
          include: { user: { select: { id: true, email: true } } },
        }),
      ])
      if (!sessionData || !timeSlotData || !orgData) return

      const formattedDate = entryDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
      const adminEmails = admins.map((a) => a.user.email).filter((e): e is string => !!e)
      const adminUserIds = admins.map((a) => a.user.id)

      if (client.email) {
        sendInterestListConfirmation({
          clientEmail: client.email,
          clientName: client.name,
          orgName: orgData.name,
          sessionName: sessionData.name,
          date: formattedDate,
          startTime: timeSlotData.startTime,
          endTime: timeSlotData.endTime,
          brandColor: orgData.brandPrimary ?? undefined,
        }).catch(console.error)
      }
      if (client.userId) {
        createNotification(client.userId, {
          title: "You're on the waitlist",
          body: `Added to interest list for ${sessionData.name} on ${formattedDate}`,
          url: '/book',
        }).catch(console.error)
      }
      notifyAdminInterestEntry({
        adminEmails,
        orgName: orgData.name,
        clientName: client.name,
        sessionName: sessionData.name,
        date: formattedDate,
        startTime: timeSlotData.startTime,
        endTime: timeSlotData.endTime,
        brandColor: orgData.brandPrimary ?? undefined,
      }).catch(console.error)
      createNotifications(adminUserIds, {
        title: 'New waitlist entry',
        body: `${client.name} joined the interest list for ${sessionData.name} on ${formattedDate}`,
        url: '/dashboard',
      }).catch(console.error)
    })().catch(console.error)

    return { data: entry }
  } catch (error: any) {
    console.error('Error adding interest:', error)
    return { error: error.message || 'Internal server error' }
  }
}
