import { describe, it, expect } from 'vitest'
import { intervalsOverlap, hasConflict, filterAvailableSlots } from '../availability'

const t = (h: number, m = 0) => new Date(2024, 0, 15, h, m)

// ─── intervalsOverlap ────────────────────────────────────────────────────────

describe('intervalsOverlap', () => {
  it('detects overlapping intervals', () => {
    expect(intervalsOverlap(
      { startTime: t(9), endTime: t(10) },
      { startTime: t(9, 30), endTime: t(10, 30) }
    )).toBe(true)
  })

  it('detects fully contained interval', () => {
    expect(intervalsOverlap(
      { startTime: t(9), endTime: t(11) },
      { startTime: t(9, 30), endTime: t(10, 30) }
    )).toBe(true)
  })

  it('returns false for non-overlapping intervals', () => {
    expect(intervalsOverlap(
      { startTime: t(9), endTime: t(10) },
      { startTime: t(11), endTime: t(12) }
    )).toBe(false)
  })

  it('returns false for touching (adjacent) intervals — exclusive boundary', () => {
    // 09:00–10:00 and 10:00–11:00 share only the boundary point, should NOT overlap
    expect(intervalsOverlap(
      { startTime: t(9), endTime: t(10) },
      { startTime: t(10), endTime: t(11) }
    )).toBe(false)
  })

  it('returns true for identical intervals', () => {
    expect(intervalsOverlap(
      { startTime: t(9), endTime: t(10) },
      { startTime: t(9), endTime: t(10) }
    )).toBe(true)
  })
})

// ─── hasConflict ─────────────────────────────────────────────────────────────

describe('hasConflict', () => {
  const booked = [
    { startTime: t(9), endTime: t(10) },
    { startTime: t(14), endTime: t(15) },
  ]

  it('returns true when new booking conflicts with an existing one', () => {
    expect(hasConflict({ startTime: t(9, 30), endTime: t(10, 30) }, booked)).toBe(true)
    expect(hasConflict({ startTime: t(13, 30), endTime: t(14, 30) }, booked)).toBe(true)
  })

  it('returns false when no conflicts exist', () => {
    expect(hasConflict({ startTime: t(10), endTime: t(11) }, booked)).toBe(false)
    expect(hasConflict({ startTime: t(11), endTime: t(13) }, booked)).toBe(false)
  })

  it('returns false against empty bookings list', () => {
    expect(hasConflict({ startTime: t(9), endTime: t(10) }, [])).toBe(false)
  })
})

// ─── filterAvailableSlots ────────────────────────────────────────────────────

describe('filterAvailableSlots', () => {
  const slots = [
    { start: t(9), end: t(10) },
    { start: t(10), end: t(11) },
    { start: t(11), end: t(12) },
    { start: t(14), end: t(15) },
  ]

  it('removes slots that conflict with existing bookings', () => {
    const bookings = [{ startTime: t(9, 30), endTime: t(10, 30) }]
    const available = filterAvailableSlots(slots, bookings)
    // 09:00–10:00 conflicts; 10:00–11:00 conflicts; 11:00–12:00 and 14:00–15:00 are free
    expect(available.map((s) => s.start.getHours())).toEqual([11, 14])
  })

  it('returns all slots when no bookings exist', () => {
    expect(filterAvailableSlots(slots, [])).toHaveLength(4)
  })

  it('returns empty when all slots are booked', () => {
    const bookings = [
      { startTime: t(8), endTime: t(16) }, // covers everything
    ]
    expect(filterAvailableSlots(slots, bookings)).toHaveLength(0)
  })

  it('preserves slots adjacent to (but not overlapping) bookings', () => {
    const bookings = [{ startTime: t(10), endTime: t(11) }]
    const available = filterAvailableSlots(slots, bookings)
    // 09:00–10:00 is adjacent (ends at 10:00), 11:00–12:00 and 14:00–15:00 are free
    expect(available.map((s) => s.start.getHours())).toEqual([9, 11, 14])
  })
})
