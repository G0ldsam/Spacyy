import { startOfDay, endOfDay, addMinutes, isWithinInterval, areIntervalsOverlapping } from 'date-fns'

export interface TimeSlot {
  start: Date
  end: Date
}

export interface BookingInterval {
  startTime: Date
  endTime: Date
}

/**
 * Check if two time intervals overlap
 */
export function intervalsOverlap(
  interval1: BookingInterval,
  interval2: BookingInterval
): boolean {
  return areIntervalsOverlapping(
    { start: interval1.startTime, end: interval1.endTime },
    { start: interval2.startTime, end: interval2.endTime },
    { inclusive: false }
  )
}

/**
 * Generate time slots for a given date range
 */
export function generateTimeSlots(
  startDate: Date,
  endDate: Date,
  slotDurationMinutes: number = 30,
  startHour: number = 9,
  endHour: number = 17
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const current = startOfDay(startDate)
  const end = endOfDay(endDate)

  while (current <= end) {
    const slotStart = new Date(current)
    slotStart.setHours(startHour, 0, 0, 0)

    const slotEnd = new Date(current)
    slotEnd.setHours(endHour, 0, 0, 0)

    while (slotStart < slotEnd) {
      const slotEndTime = addMinutes(slotStart, slotDurationMinutes)
      
      if (slotEndTime <= slotEnd) {
        slots.push({
          start: new Date(slotStart),
          end: new Date(slotEndTime),
        })
      }

      slotStart.setTime(slotEndTime.getTime())
    }

    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
  }

  return slots
}

/**
 * Check if a booking interval conflicts with existing bookings
 */
export function hasConflict(
  newBooking: BookingInterval,
  existingBookings: BookingInterval[]
): boolean {
  return existingBookings.some((existing) =>
    intervalsOverlap(newBooking, existing)
  )
}

/**
 * Filter available slots by removing booked ones
 */
export function filterAvailableSlots(
  slots: TimeSlot[],
  bookings: BookingInterval[]
): TimeSlot[] {
  return slots.filter((slot) => {
    const slotInterval: BookingInterval = {
      startTime: slot.start,
      endTime: slot.end,
    }
    return !hasConflict(slotInterval, bookings)
  })
}
