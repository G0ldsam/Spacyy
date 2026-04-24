import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push'

export const dynamic = 'force-dynamic'

// POST /api/push/test — send a test push to a user (admin only, or self)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = session.user.organizations?.some(
    (o) => o.role === 'OWNER' || o.role === 'ADMIN'
  )

  let targetUserId = session.user.id

  if (isAdmin) {
    const body = await req.json().catch(() => ({}))
    if (body.email) {
      const user = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase() },
        select: { id: true },
      })
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      targetUserId = user.id
    }
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: targetUserId },
    select: { id: true },
  })

  if (subs.length === 0) {
    return NextResponse.json({ error: 'No push subscriptions found for this user' }, { status: 404 })
  }

  await sendPushToUser(targetUserId, {
    title: 'Spacyy Test',
    body: 'Push notifications are working!',
    url: '/home',
  })

  return NextResponse.json({ ok: true, subscriptions: subs.length })
}
