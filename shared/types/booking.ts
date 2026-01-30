import { BookingStatus, UserRole } from './enums'

export interface Booking {
  id: string
  organizationId: string
  spaceId: string
  clientId: string
  userId: string | null
  startTime: Date
  endTime: Date
  status: BookingStatus
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BookingInput {
  spaceId: string
  clientId: string
  startTime: Date | string
  endTime: Date | string
  notes?: string
}

export interface BookingWithRelations extends Booking {
  space: {
    id: string
    name: string
    capacity: number
  }
  client: {
    id: string
    name: string
    email: string
  }
}

export interface AvailabilitySlot {
  startTime: Date
  endTime: Date
  available: boolean
  spaceId: string
  spaceName: string
  capacity: number
  currentBookings: number
}

export interface AvailabilityQuery {
  organizationId: string
  startDate: Date | string
  endDate: Date | string
  spaceId?: string
}
