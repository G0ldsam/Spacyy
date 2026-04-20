import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { spaceSchema } from '@/lib/validation'
import { verifyTenantAccess, verifyTenantAdmin } from '@/lib/api-helpers'

// GET /api/spaces - List spaces
export async function GET(req: NextRequest) {
  try {
    const result = await verifyTenantAccess()
    if ('error' in result) return result.error
    const { tenant } = result

    const spaces = await prisma.space.findMany({
      where: {
        organizationId: tenant.organizationId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(spaces)
  } catch (error) {
    console.error('Error fetching spaces:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/spaces - Create space
export async function POST(req: NextRequest) {
  try {
    const result = await verifyTenantAdmin()
    if ('error' in result) return result.error
    const { tenant } = result

    const body = await req.json()
    const validated = spaceSchema.parse(body)

    const space = await prisma.space.create({
      data: {
        organizationId: tenant.organizationId,
        name: validated.name,
        description: validated.description,
        capacity: validated.capacity || 1,
        metadata: validated.metadata,
      },
    })

    return NextResponse.json(space, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating space:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
