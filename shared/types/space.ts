export interface Space {
  id: string
  organizationId: string
  name: string
  description: string | null
  capacity: number
  isActive: boolean
  metadata: Record<string, any> | null
  createdAt: Date
  updatedAt: Date
}

export interface SpaceInput {
  name: string
  description?: string
  capacity?: number
  metadata?: Record<string, any>
}
