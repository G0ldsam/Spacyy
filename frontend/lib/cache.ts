import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'

const SESSION_TTL = 5 * 60 // 5 minutes

export function getCachedSessions(organizationId: string) {
  return unstable_cache(
    () =>
      prisma.serviceSession.findMany({
        where: { organizationId, isActive: true },
        include: {
          timetable: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } },
        },
      }),
    ['sessions', organizationId],
    { revalidate: SESSION_TTL, tags: [`sessions-${organizationId}`] }
  )()
}
