import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import { compare } from 'bcryptjs'
import { UserRole } from '@/shared/types/enums'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          console.log('🔐 Starting authentication for:', credentials?.email)
          
          if (!credentials?.email || !credentials?.password) {
            console.log('❌ Missing credentials')
            return null
          }

          // Check environment variables
          if (!process.env.DATABASE_URL) {
            console.error('❌ DATABASE_URL not found in environment')
            throw new Error('Database configuration missing')
          }

          console.log('🔍 Looking up user in database...')
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
            include: {
              organizations: {
                include: {
                  organization: true,
                },
              },
            },
          })

          if (!user || !user.password) {
            console.log('❌ User not found or no password set')
            return null
          }

          console.log('🔑 Verifying password...')
          const isValid = await compare(credentials.password, user.password)

          if (!isValid) {
            console.log('❌ Invalid password')
            return null
          }

          console.log('✅ Authentication successful for:', user.email)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            mustChangePassword: user.mustChangePassword,
            organizations: user.organizations.map((uo) => ({
              id: uo.organizationId,
              role: uo.role as UserRole,
              organization: {
                id: uo.organization.id,
                name: uo.organization.name,
                slug: uo.organization.slug,
              },
            })),
          }
        } catch (error) {
          console.error('🚨 Authentication error:', error)
          console.error('Stack trace:', error instanceof Error ? error.stack : 'Unknown error')
          throw error // Re-throw to cause 500 error with details
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      try {
        if (user) {
          token.id = user.id
          token.mustChangePassword = (user as any).mustChangePassword || false
          token.organizations = (user as any).organizations || []
        }
        
        // If session is being updated, refresh the mustChangePassword flag from database
        if (trigger === 'update') {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { mustChangePassword: true },
          })
          if (dbUser) {
            token.mustChangePassword = dbUser.mustChangePassword
          }
        }
        
        return token
      } catch (error) {
        console.error('🚨 JWT callback error:', error)
        return token
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.mustChangePassword = (token.mustChangePassword as boolean) || false
        session.user.organizations = (token.organizations as any) || []
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
}
