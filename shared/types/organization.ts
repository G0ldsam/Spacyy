export interface Organization {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationInput {
  name: string
  slug: string
  email?: string
  phone?: string
}
