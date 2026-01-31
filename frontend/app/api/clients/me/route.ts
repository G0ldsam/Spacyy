import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/clients/me - Get current user's client record
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get client for this user
    const userOrg = session.user.organizations?.[0]
    if (!userOrg) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    let client = await prisma.client.findFirst({
      where: {
        userId: session.user.id,
        organizationId: userOrg.organization.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        notes: true,
        sessionAllowance: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // If client doesn't exist, create it (for both CLIENT role and admins/owners who want to book)
    if (!client) {
      try {
        // Check if a client with this email already exists (might have been created by admin)
        const existingClientByEmail = await prisma.client.findUnique({
          where: {
            organizationId_email: {
              organizationId: userOrg.organization.id,
              email: session.user.email || '',
            },
          },
        })

        if (existingClientByEmail) {
          // If client exists by email but not linked to user, update it to link to this user
          client = await prisma.client.update({
            where: { id: existingClientByEmail.id },
            data: { userId: session.user.id },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              notes: true,
              sessionAllowance: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        } else {
          // Create new client record
          client = await prisma.client.create({
            data: {
              userId: session.user.id,
              organizationId: userOrg.organization.id,
              email: session.user.email || '',
              name: session.user.name || session.user.email || 'Client',
            },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              notes: true,
              sessionAllowance: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        }
      } catch (error: any) {
        // If creation fails (e.g., unique constraint), try to find by email again
        if (error.code === 'P2002') {
          client = await prisma.client.findUnique({
            where: {
              organizationId_email: {
                organizationId: userOrg.organization.id,
                email: session.user.email || '',
              },
            },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              notes: true,
              sessionAllowance: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        } else {
          throw error
        }
      }
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
