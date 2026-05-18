import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { hash } from 'bcryptjs'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  phone: z.string().optional(),
  password: z.string().min(8),
})

// POST /api/register — public client self-registration via invite token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = registerSchema.parse(body)

    const invitation = await prisma.invitation.findUnique({
      where: { token: validated.token },
      include: { organization: { select: { id: true, slug: true, name: true } } },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 })
    }

    if (invitation.acceptedAt) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 409 })
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }

    const organizationId = invitation.organizationId

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const existingClient = await prisma.client.findUnique({
      where: { organizationId_email: { organizationId, email: validated.email } },
    })

    if (existingClient) {
      return NextResponse.json(
        { error: 'A client with this email already exists in this organization' },
        { status: 409 }
      )
    }

    const hashedPassword = await hash(validated.password, 10)

    // Batch form — compatible with Supabase PgBouncer transaction mode
    // Client is nested inside user.create so no user ID needed upfront
    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          password: hashedPassword,
          mustChangePassword: false,
          organizations: {
            create: { organizationId, role: 'CLIENT' },
          },
          clients: {
            create: {
              organizationId,
              email: validated.email,
              name: validated.name,
              phone: validated.phone,
            },
          },
        },
      }),
      prisma.invitation.update({
        where: { token: validated.token },
        data: { acceptedAt: new Date() },
      }),
    ])

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error during client registration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
