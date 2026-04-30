import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'

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

export const useSessions = () => {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  })
}

export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  })
}

export const useAvailability = (sessionId: string, date: string) => {
  return useQuery({
    queryKey: ['availability', sessionId, date],
    queryFn: () => fetchAvailability(sessionId, date),
    enabled: !!sessionId && !!date,
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
  })
}

export const useExceptions = (sessionId: string, date: string) => {
  return useQuery({
    queryKey: ['exceptions', sessionId, date],
    queryFn: () => fetchExceptions(sessionId, date),
    enabled: !!sessionId && !!date,
  })
}

export const useInterestList = (sessionId: string, timeSlotId: string, date: string) => {
  return useQuery({
    queryKey: ['interest', sessionId, timeSlotId, date],
    queryFn: () => fetchInterestList(sessionId, timeSlotId, date),
    enabled: !!sessionId && !!timeSlotId && !!date,
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
      clientId: string
      startTime: string
      endTime: string
    }) => {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create booking')
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      // Invalidate availability for this session
      queryClient.invalidateQueries({ queryKey: ['availability', variables.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['booked-dates'] })
    },
  })
}

export const useCancelBooking = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!res.ok) throw new Error('Failed to cancel booking')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['booked-dates'] })
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
    },
  })
}
