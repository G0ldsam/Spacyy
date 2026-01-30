import { z } from 'zod'
import { UserRole, BookingStatus } from '../types/enums'

// User schemas
export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Client schemas
export const clientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  notes: z.string().optional(),
})

// Booking schemas
export const bookingSchema = z.object({
  spaceId: z.string().min(1),
  clientId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  notes: z.string().optional(),
}).refine((data) => data.endTime > data.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
})

// Space schemas
export const spaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().positive().default(1),
  metadata: z.record(z.any()).optional(),
})

// Organization schemas
export const organizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
})

// Invitation schemas
export const invitationSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(UserRole).default(UserRole.CLIENT),
})

// Availability query schema
export const availabilityQuerySchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  spaceId: z.string().optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
})

// Type exports
export type UserInput = z.infer<typeof userSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ClientInput = z.infer<typeof clientSchema>
export type BookingInput = z.infer<typeof bookingSchema>
export type SpaceInput = z.infer<typeof spaceSchema>
export type OrganizationInput = z.infer<typeof organizationSchema>
export type InvitationInput = z.infer<typeof invitationSchema>
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>
