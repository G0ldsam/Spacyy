import { BookingStatus } from '../types/enums'

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: 'Pending',
  [BookingStatus.CONFIRMED]: 'Confirmed',
  [BookingStatus.CANCELLED]: 'Cancelled',
  [BookingStatus.COMPLETED]: 'Completed',
  [BookingStatus.NO_SHOW]: 'No Show',
}

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: 'yellow',
  [BookingStatus.CONFIRMED]: 'green',
  [BookingStatus.CANCELLED]: 'red',
  [BookingStatus.COMPLETED]: 'blue',
  [BookingStatus.NO_SHOW]: 'gray',
}
