import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

export interface NotifyPayload {
  title: string
  body: string
  url?: string
}

export async function createNotification(userId: string, payload: NotifyPayload) {
  await prisma.notification.create({
    data: {
      userId,
      title: payload.title,
      body: payload.body,
      url: payload.url,
    },
  })
  sendPushToUser(userId, payload).catch(console.error)
}

export async function createNotifications(userIds: string[], payload: NotifyPayload) {
  await Promise.allSettled(userIds.map((id) => createNotification(id, payload)))
}
