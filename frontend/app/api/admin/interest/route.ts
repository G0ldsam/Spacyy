import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// GET /api/admin/interest — all upcoming waitlist entries for the org, grouped by slot
export async function GET() {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const entries = await prisma.interestEntry.findMany({
    where: {
      organizationId: tenant.organizationId,
      date: { gte: now },
    },
    include: {
      session: { select: { id: true, name: true, themeColor: true } },
      timeSlot: { select: { id: true, startTime: true, endTime: true } },
      client: { select: { name: true, email: true } },
    },
    orderBy: [{ date: 'asc' }, { timeSlot: { startTime: 'asc' } }, { createdAt: 'asc' }],
  })

  // Group by sessionId + timeSlotId + date
  const groupMap = new Map<
    string,
    {
      sessionId: string
      sessionName: string
      themeColor: string
      timeSlotId: string
      startTime: string
      endTime: string
      date: string
      entries: { id: string; client: { name: string; email: string }; notifiedAt: string | null }[]
      unnotifiedCount: number
    }
  >()

  for (const entry of entries) {
    const dateStr = entry.date.toISOString().split('T')[0]
    const key = `${entry.sessionId}|${entry.timeSlotId}|${dateStr}`

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        sessionId: entry.session.id,
        sessionName: entry.session.name,
        themeColor: entry.session.themeColor,
        timeSlotId: entry.timeSlot.id,
        startTime: entry.timeSlot.startTime,
        endTime: entry.timeSlot.endTime,
        date: dateStr,
        entries: [],
        unnotifiedCount: 0,
      })
    }

    const group = groupMap.get(key)!
    group.entries.push({
      id: entry.id,
      client: entry.client,
      notifiedAt: entry.notifiedAt?.toISOString() ?? null,
    })
    if (!entry.notifiedAt) group.unnotifiedCount++
  }

  return NextResponse.json(Array.from(groupMap.values()))
}
