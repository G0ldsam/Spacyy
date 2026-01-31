export interface ServiceSession {
  id: string
  organizationId: string
  name: string
  description: string | null
  themeColor: string
  slots: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ServiceSessionInput {
  name: string
  description?: string
  themeColor?: string
  slots?: number
}

export interface ServiceSessionWithTimetable extends ServiceSession {
  timetable: TimeSlot[]
}

export interface TimeSlot {
  id: string
  serviceSessionId: string
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string // Format: "HH:mm" (e.g., "16:00")
  endTime: string // Format: "HH:mm" (e.g., "16:50")
  createdAt: Date
  updatedAt: Date
}

export interface TimeSlotInput {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
