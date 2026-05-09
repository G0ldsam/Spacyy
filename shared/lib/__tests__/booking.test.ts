import { describe, it, expect, vi, afterEach } from 'vitest'
import { validateBookingInput, calculateBookingDuration } from '../booking'

// ─── validateBookingInput ────────────────────────────────────────────────────

describe('validateBookingInput', () => {
  const future = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
  const past = new Date(Date.now() - 1000 * 60 * 60)   // 1 hour ago

  const valid = {
    spaceId: 'space-1',
    clientId: 'client-1',
    startTime: future.toISOString(),
    endTime: new Date(future.getTime() + 30 * 60 * 1000).toISOString(),
  }

  it('accepts a valid booking', () => {
    const result = validateBookingInput(valid)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('requires spaceId', () => {
    const result = validateBookingInput({ ...valid, spaceId: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Space ID is required')
  })

  it('requires clientId', () => {
    const result = validateBookingInput({ ...valid, clientId: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Client ID is required')
  })

  it('requires startTime and endTime', () => {
    const result = validateBookingInput({ ...valid, startTime: '', endTime: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Start and end times are required')
  })

  it('rejects end time before start time', () => {
    const result = validateBookingInput({
      ...valid,
      startTime: future.toISOString(),
      endTime: new Date(future.getTime() - 60_000).toISOString(),
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('End time must be after start time')
  })

  it('rejects equal start and end time', () => {
    const result = validateBookingInput({
      ...valid,
      startTime: future.toISOString(),
      endTime: future.toISOString(),
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('End time must be after start time')
  })

  it('rejects bookings in the past', () => {
    const result = validateBookingInput({
      ...valid,
      startTime: past.toISOString(),
      endTime: new Date(past.getTime() + 30 * 60 * 1000).toISOString(),
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Cannot book in the past')
  })

  it('can return multiple errors at once', () => {
    const result = validateBookingInput({
      spaceId: '',
      clientId: '',
      startTime: '',
      endTime: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

// ─── calculateBookingDuration ────────────────────────────────────────────────

describe('calculateBookingDuration', () => {
  it('calculates 30-minute session', () => {
    const start = new Date('2024-06-01T09:00:00Z')
    const end = new Date('2024-06-01T09:30:00Z')
    expect(calculateBookingDuration(start, end)).toBe(30)
  })

  it('calculates 1-hour session', () => {
    const start = new Date('2024-06-01T09:00:00Z')
    const end = new Date('2024-06-01T10:00:00Z')
    expect(calculateBookingDuration(start, end)).toBe(60)
  })

  it('calculates 90-minute session', () => {
    const start = new Date('2024-06-01T08:00:00Z')
    const end = new Date('2024-06-01T09:30:00Z')
    expect(calculateBookingDuration(start, end)).toBe(90)
  })

  it('accepts ISO string inputs', () => {
    expect(calculateBookingDuration('2024-06-01T09:00:00Z', '2024-06-01T10:00:00Z')).toBe(60)
  })

  it('returns 0 for same start and end', () => {
    const t = new Date('2024-06-01T09:00:00Z')
    expect(calculateBookingDuration(t, t)).toBe(0)
  })
})
