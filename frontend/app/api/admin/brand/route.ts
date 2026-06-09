import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { isValidHex } from '@/shared/lib/brandColors'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const org = await prisma.organization.findUnique({
    where: { id: tenant.organizationId },
    select: { brandPrimary: true, brandSecondary: true, brandAccent: true, brandSurface: true },
  })

  return NextResponse.json(org)
}

export async function PATCH(req: NextRequest) {
  const result = await verifyTenantAdmin()
  if ('error' in result) return result.error
  const { tenant } = result

  const body = await req.json()
  const { brandPrimary, brandSecondary, brandAccent, brandSurface } = body

  for (const [key, val] of Object.entries({ brandPrimary, brandSecondary, brandAccent, brandSurface })) {
    if (val !== null && val !== undefined && !isValidHex(val as string)) {
      return NextResponse.json({ error: `Invalid hex for ${key}` }, { status: 400 })
    }
  }

  const org = await prisma.organization.update({
    where: { id: tenant.organizationId },
    data: {
      ...(brandPrimary !== undefined && { brandPrimary }),
      ...(brandSecondary !== undefined && { brandSecondary }),
      ...(brandAccent !== undefined && { brandAccent }),
      ...(brandSurface !== undefined && { brandSurface }),
    },
    select: { brandPrimary: true, brandSecondary: true, brandAccent: true, brandSurface: true },
  })

  revalidatePath('/', 'layout')
  return NextResponse.json(org)
}
