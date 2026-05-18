import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTenantAdmin } from '@/lib/api-helpers'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/invitations — admin generates a single-use client invite token
export async function POST(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: tenant.organizationId,
        token,
        expiresAt,
        role: 'CLIENT',
      },
    })

    return NextResponse.json(
      { token: invitation.token, expiresAt: invitation.expiresAt },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
