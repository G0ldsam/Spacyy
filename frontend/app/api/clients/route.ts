import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { clientSchema } from '@/lib/validation'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'
import { verifyTenantAccess, verifyTenantAdmin } from '@/lib/api-helpers'

// GET /api/clients - List clients
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const clients = await prisma.client.findMany({
      where: {
        organizationId: tenant.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        notes: true,
        userId: true,
        sessionAllowance: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/clients - Create client
export async function POST(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const body = await req.json()
    const validated = clientSchema.parse(body)

    const organizationId = tenant.organizationId

    // Check if client already exists
    const existing = await prisma.client.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: validated.email,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Client with this email already exists' },
        { status: 409 }
      )
    }

    let tempPassword: string | null = null
    let userId: string | null = null

    // If createAccount is true, create a User account
    if (validated.createAccount) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validated.email },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }

      // Generate temporary password (8 random characters)
      tempPassword = randomBytes(4).toString('hex')
      const hashedPassword = await hash(tempPassword, 10)

      // Create user account
      const user = await prisma.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          password: hashedPassword,
          mustChangePassword: true, // Force password change on first login
          organizations: {
            create: {
              organizationId,
              role: 'CLIENT',
            },
          },
        },
      })

      userId = user.id
    }

    // Create client record
    const client = await prisma.client.create({
      data: {
        organizationId,
        userId,
        email: validated.email,
        name: validated.name,
        phone: validated.phone,
        notes: validated.notes,
      },
    })

    // Return client with temp password if account was created
    return NextResponse.json(
      { ...client, tempPassword },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
