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
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            organizations: {
              include: {
                organization: true,
              },
            },
          },
        })

        if (!user || !user.password) {
          return null
        }

        // In production, use bcrypt to compare passwords
        // For now, we'll implement basic password checking
        // You'll need to install bcryptjs: npm install bcryptjs @types/bcryptjs
        const isValid = await compare(credentials.password, user.password)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          mustChangePassword: user.mustChangePassword,
          organizations: user.organizations.map((uo) => ({
            id: uo.organizationId,
            role: uo.role,
            organization: uo.organization,
          })),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
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
