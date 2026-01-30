import { BookingInput, Booking } from '../types/booking'
import { hasConflict } from './availability'

/**
 * Validate booking input
 */
export function validateBookingInput(input: BookingInput): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!input.spaceId) {
    errors.push('Space ID is required')
  }

  if (!input.clientId) {
    errors.push('Client ID is required')
  }

  if (!input.startTime || !input.endTime) {
    errors.push('Start and end times are required')
  }

  if (input.startTime && input.endTime) {
    const start = new Date(input.startTime)
    const end = new Date(input.endTime)

    if (end <= start) {
      errors.push('End time must be after start time')
    }

    // Check if booking is in the past
    if (start < new Date()) {
      errors.push('Cannot book in the past')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if booking conflicts with existing bookings
 */
export function checkBookingConflict(
  newBooking: BookingInput,
  existingBookings: Array<{ startTime: Date; endTime: Date }>
): boolean {
  const newBookingInterval = {
    startTime: new Date(newBooking.startTime),
    endTime: new Date(newBooking.endTime),
  }

  return hasConflict(newBookingInterval, existingBookings)
}

/**
 * Calculate booking duration in minutes
 */
export function calculateBookingDuration(
  startTime: Date | string,
  endTime: Date | string
): number {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
}
