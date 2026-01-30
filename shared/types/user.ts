import { UserRole } from './enums'

export interface User {
  id: string
  email: string
  emailVerified: Date | null
  name: string | null
  image: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserWithOrganizations extends User {
  organizations: {
    id: string
    organizationId: string
    role: UserRole
    organization: {
      id: string
      name: string
      slug: string
    }
  }[]
}

export interface Client {
  id: string
  organizationId: string
  userId: string | null
  email: string
  name: string
  phone: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ClientInput {
  email: string
  name: string
  phone?: string
  notes?: string
}

export interface InvitationInput {
  email: string
  role?: UserRole
}
