import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// DELETE /api/sessions/[id]/exceptions/[exceptionId]
// Re-opens a cancelled occurrence (does not recreate any bookings)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; exceptionId: string } }
) {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const exception = await prisma.timeSlotException.findUnique({
    where: { id: params.exceptionId },
    include: {
      timeSlot: {
        include: { serviceSession: { select: { id: true, organizationId: true } } },
      },
    },
  })

  if (
    !exception ||
    exception.timeSlot.serviceSession.id !== params.id ||
    exception.timeSlot.serviceSession.organizationId !== tenant.organizationId
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.timeSlotException.delete({ where: { id: params.exceptionId } })

  return NextResponse.json({ success: true })
}
