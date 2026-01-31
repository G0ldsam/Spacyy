import { UserRole } from '@/shared/types/enums'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      mustChangePassword?: boolean
      organizations?: {
        id: string
        role: UserRole
        organization: {
          id: string
          name: string
          slug: string
        }
      }[]
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    organizations?: {
      id: string
      role: UserRole
      organization: {
        id: string
        name: string
        slug: string
      }
    }[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    mustChangePassword?: boolean
    organizations?: {
      id: string
      role: UserRole
      organization: {
        id: string
        name: string
        slug: string
      }
    }[]
  }
}
