import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { createBooking, updateBookingStatus } from '@/actions/bookings'

// ========================================
// Types
// ========================================

interface TimeSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

interface Session {
  id: string
  name: string
  description: string | null
  themeColor: string
  slots: number
  timetable: TimeSlot[]
  _count?: {
    bookings: number
    timetable?: number
  }
}

interface Booking {
  id: string
  client: { id: string; name: string; email: string }
  startTime: string
  endTime: string
  status: string
  checkedIn: boolean
  checkedInAt: string | null
  userId: string | null
}

interface Client {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  userId: string | null
  sessionAllowance: number | null
  activeBookingsCount: number
  createdAt: string
}

interface SlotException {
  id: string
  reason: string | null
}

interface InterestEntry {
  id: string
  client: { name: string; email: string }
  notifiedAt: string | null
}

// ========================================
// Fetch Functions
// ========================================

const fetchSessions = async (): Promise<Session[]> => {
  const res = await fetch('/api/sessions')
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

const fetchClients = async (): Promise<Client[]> => {
  const res = await fetch('/api/clients')
  if (!res.ok) throw new Error('Failed to fetch clients')
  return res.json()
}

const fetchAvailability = async (sessionId: string, date: string): Promise<Booking[]> => {
  const res = await fetch(`/api/bookings/availability?sessionId=${sessionId}&date=${date}`)
  if (!res.ok) throw new Error('Failed to fetch availability')
  return res.json()
}

const fetchBookedDates = async (start: string, end: string): Promise<string[]> => {
  const res = await fetch(`/api/bookings/dates?start=${start}&end=${end}`)
  if (!res.ok) throw new Error('Failed to fetch booked dates')
  const data = await res.json()
  return data.dates || []
}

const fetchExceptions = async (sessionId: string, date: string): Promise<Record<string, SlotException>> => {
  const res = await fetch(`/api/sessions/${sessionId}/exceptions?date=${date}`)
  if (!res.ok) return {}
  return res.json()
}

const fetchInterestList = async (sessionId: string, timeSlotId: string, date: string): Promise<InterestEntry[]> => {
  const res = await fetch(`/api/interest?sessionId=${sessionId}&timeSlotId=${timeSlotId}&date=${date}`)
  if (!res.ok) return []
  return res.json()
}

// ========================================
// Query Hooks
// ========================================

interface DashboardStats {
  sessionsCount: number
  activeBookingsCount: number
  reservedBookingsCount: number
  totalBookingsCount: number
  clientsCount: number
}

export const useDashboardStats = () => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Failed to fetch dashboard stats')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export const useCurrentOrg = () => {
  return useQuery<{ id: string; slug: string }>({
    queryKey: ['current-org'],
    queryFn: async () => {
      const res = await fetch('/api/organization/current')
      if (!res.ok) throw new Error('Failed to fetch current org')
      return res.json()
    },
    staleTime: Infinity,
  })
}

export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    staleTime: 5 * 60_000,
  })
}

export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    staleTime: 60_000,
  })
}

export const useAvailability = (sessionId: string, date: string) => {
  return useQuery({
    queryKey: ['availability', sessionId, date],
    queryFn: () => fetchAvailability(sessionId, date),
    enabled: !!sessionId && !!date,
    staleTime: 30_000,
  })
}

/**
 * Fetch availability for multiple sessions in parallel — cached per session+date
 */
export const useMultipleAvailability = (sessions: Session[], date: string) => {
  return useQueries({
    queries: sessions.map((session) => ({
      queryKey: ['availability', session.id, date],
      queryFn: () => fetchAvailability(session.id, date),
      enabled: !!session.id && !!date,
    })),
  })
}

export const useBookedDates = (start: string, end: string) => {
  return useQuery({
    queryKey: ['booked-dates', start, end],
    queryFn: () => fetchBookedDates(start, end),
    enabled: !!start && !!end,
    staleTime: 5 * 60_000,
  })
}

export const useExceptions = (sessionId: string, date: string) => {
  return useQuery({
    queryKey: ['exceptions', sessionId, date],
    queryFn: () => fetchExceptions(sessionId, date),
    enabled: !!sessionId && !!date,
    staleTime: 5 * 60_000,
  })
}

export const useInterestList = (sessionId: string, timeSlotId: string, date: string) => {
  return useQuery({
    queryKey: ['interest', sessionId, timeSlotId, date],
    queryFn: () => fetchInterestList(sessionId, timeSlotId, date),
    enabled: !!sessionId && !!timeSlotId && !!date,
    staleTime: 60_000,
  })
}

/**
 * Fetch interest lists for multiple time slots in parallel
 */
export const useMultipleInterestLists = (sessionId: string, timeSlots: TimeSlot[], date: string) => {
  return useQueries({
    queries: timeSlots.map((slot) => ({
      queryKey: ['interest', sessionId, slot.id, date],
      queryFn: () => fetchInterestList(sessionId, slot.id, date),
      enabled: !!sessionId && !!slot.id && !!date,
    })),
  })
}

// ========================================
// Mutation Hooks
// ========================================

export const useCheckIn = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`/api/admin/check-in/booking/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to check in')
      }
      return res.json()
    },
    onSuccess: (_data, _bookingId) => {
      // Invalidate all availability queries to refresh booking status
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export const useCreateBooking = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      sessionId: string
      clientId?: string
      startTime: string
      endTime: string
    }) => {
      const result = await createBooking(params)
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['availability', variables.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['booked-dates'] })
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] })
    },
  })
}

export const useCancelBooking = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const result = await updateBookingStatus(bookingId, 'CANCELLED')
      if (result.error) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['booked-dates'] })
      queryClient.invalidateQueries({ queryKey: ['bookings-my'] })
    },
  })
}

export const useCloseOccurrence = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: {
      sessionId: string
      timeSlotId: string
      date: string
      reason: string | null
    }) => {
      const res = await fetch(`/api/sessions/${params.sessionId}/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeSlotId: params.timeSlotId,
          date: params.date,
          reason: params.reason,
        }),
      })
      if (!res.ok) throw new Error('Failed to close occurrence')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exceptions', variables.sessionId, variables.date] })
      queryClient.invalidateQueries({ queryKey: ['availability', variables.sessionId] })
    },
  })
}

export const useReopenOccurrence = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (params: { sessionId: string; exceptionId: string; date: string }) => {
      const res = await fetch(`/api/sessions/${params.sessionId}/exceptions/${params.exceptionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to reopen occurrence')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exceptions', variables.sessionId, variables.date] })
    },
  })
}

export const useNotifyInterestList = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { sessionId: string; timeSlotId: string; date: string }) => {
      const res = await fetch('/api/interest/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) throw new Error('Failed to send notifications')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['interest', variables.sessionId, variables.timeSlotId, variables.date],
      })
      queryClient.invalidateQueries({ queryKey: ['admin-interest'] })
    },
  })
}

export const useNotifyOne = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch('/api/admin/interest/notify-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      if (!res.ok) throw new Error('Failed to notify')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interest'] })
    },
  })
}

export const useDeleteInterestEntry = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/interest/${entryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-interest'] })
      queryClient.invalidateQueries({ queryKey: ['interest'] })
    },
  })
}

export interface AdminWaitlistGroup {
  sessionId: string
  sessionName: string
  themeColor: string
  timeSlotId: string
  startTime: string
  endTime: string
  date: string
  entries: { id: string; client: { name: string; email: string }; notifiedAt: string | null }[]
  unnotifiedCount: number
}

export const useAdminInterestList = () => {
  return useQuery<AdminWaitlistGroup[]>({
    queryKey: ['admin-interest'],
    queryFn: async () => {
      const res = await fetch('/api/admin/interest')
      if (!res.ok) throw new Error('Failed to fetch waitlist')
      return res.json()
    },
    staleTime: 30_000,
  })
}
