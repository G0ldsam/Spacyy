import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { sendPasswordResetEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST /api/auth/forgot-password
// Body: { email }
// Always returns 200 to avoid leaking user existence
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    })

    if (user) {
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      })

      const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'spacyy.com'}`
      const resetUrl = `${baseUrl}/reset-password?token=${token}`

      sendPasswordResetEmail({
        email: user.email,
        name: user.name || '',
        resetUrl,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in forgot-password:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
