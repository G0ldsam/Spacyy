import { describe, it, expect } from 'vitest'
import {
  checkBookingAllowance,
  computeCancelEffect,
  computeRenewalAllowance,
} from '../slot-accounting'

// ─── checkBookingAllowance ───────────────────────────────────────────────────

describe('checkBookingAllowance', () => {
  describe('unlimited clients (sessionAllowance = null)', () => {
    it('always returns ok regardless of booking count', () => {
      expect(checkBookingAllowance(0, null, false)).toBe('ok')
      expect(checkBookingAllowance(100, null, false)).toBe('ok')
      expect(checkBookingAllowance(100, null, true)).toBe('ok')
    })
  })

  describe('under allowance', () => {
    it('returns ok when below the cap', () => {
      expect(checkBookingAllowance(0, 5, false)).toBe('ok')
      expect(checkBookingAllowance(4, 5, false)).toBe('ok')
      expect(checkBookingAllowance(4, 5, true)).toBe('ok')
    })
  })

  describe('at allowance limit', () => {
    it('returns blocked when org does not allow pending slots', () => {
      expect(checkBookingAllowance(5, 5, false)).toBe('blocked')
    })

    it('returns use_pending when org allows one extra pending slot', () => {
      expect(checkBookingAllowance(5, 5, true)).toBe('use_pending')
    })
  })

  describe('over allowance + 1 (debt already used)', () => {
    it('returns blocked even if org allows pending slots', () => {
      // activeCount=6 >= allowance(5) + 1 → the pending slot is already consumed
      expect(checkBookingAllowance(6, 5, true)).toBe('blocked')
      expect(checkBookingAllowance(10, 5, true)).toBe('blocked')
    })
  })

  describe('edge: allowance = 0', () => {
    it('returns blocked with no pending slot', () => {
      expect(checkBookingAllowance(0, 0, false)).toBe('blocked')
    })

    it('returns use_pending when pending allowed and no active bookings', () => {
      expect(checkBookingAllowance(0, 0, true)).toBe('use_pending')
    })

    it('returns blocked after the one pending slot is already used', () => {
      expect(checkBookingAllowance(1, 0, true)).toBe('blocked')
    })
  })
})

// ─── computeCancelEffect ─────────────────────────────────────────────────────

describe('computeCancelEffect', () => {
  describe('unlimited clients (sessionAllowance = null)', () => {
    it('always returns none — no accounting needed', () => {
      expect(computeCancelEffect(true, false, null, 0)).toEqual({ action: 'none' })
      expect(computeCancelEffect(false, true, null, 3)).toEqual({ action: 'none' })
    })
  })

  describe('pre-session cancellation', () => {
    it('decrements pendingSlotsUsed when booking used a pending slot', () => {
      expect(computeCancelEffect(true, true, 5, 1)).toEqual({ action: 'decrement_pending' })
    })

    it('returns none for a regular booking (count drops naturally)', () => {
      expect(computeCancelEffect(true, false, 5, 0)).toEqual({ action: 'none' })
    })

    it('returns none if pendingSlotsUsed is already 0 (guard against underflow)', () => {
      expect(computeCancelEffect(true, true, 5, 0)).toEqual({ action: 'none' })
    })
  })

  describe('post-session cancellation', () => {
    it('decrements sessionAllowance for a regular booking (slot permanently consumed)', () => {
      expect(computeCancelEffect(false, false, 5, 0)).toEqual({ action: 'decrement_allowance' })
    })

    it('returns none for a pending-slot booking (debt stays, no allowance change)', () => {
      expect(computeCancelEffect(false, true, 5, 1)).toEqual({ action: 'none' })
    })

    it('returns none when allowance is already 0 (guard against underflow)', () => {
      expect(computeCancelEffect(false, false, 0, 0)).toEqual({ action: 'none' })
    })
  })

  describe('full 4-case matrix', () => {
    // Case 1: pre + pending → clear debt
    it('pre-session + pending slot → decrement_pending', () => {
      expect(computeCancelEffect(true, true, 3, 2)).toEqual({ action: 'decrement_pending' })
    })

    // Case 2: pre + regular → no action (count drops naturally)
    it('pre-session + regular slot → none', () => {
      expect(computeCancelEffect(true, false, 3, 0)).toEqual({ action: 'none' })
    })

    // Case 3: post + regular → allowance consumed
    it('post-session + regular slot → decrement_allowance', () => {
      expect(computeCancelEffect(false, false, 3, 0)).toEqual({ action: 'decrement_allowance' })
    })

    // Case 4: post + pending → no change
    it('post-session + pending slot → none', () => {
      expect(computeCancelEffect(false, true, 3, 1)).toEqual({ action: 'none' })
    })
  })
})

// ─── computeRenewalAllowance ─────────────────────────────────────────────────

describe('computeRenewalAllowance', () => {
  it('returns null for unlimited clients', () => {
    expect(computeRenewalAllowance(null, 0, 10)).toBeNull()
    expect(computeRenewalAllowance(null, 5, 5)).toBeNull()
  })

  it('adds sessions to active booking count (base case)', () => {
    expect(computeRenewalAllowance(5, 0, 5)).toBe(5)   // fresh renewal, no active bookings
    expect(computeRenewalAllowance(5, 2, 5)).toBe(7)   // 2 bookings already hold slots
    expect(computeRenewalAllowance(3, 3, 10)).toBe(13) // large renewal
  })

  it('allows booking existing sessions immediately after renewal', () => {
    // Client has allowance=4, 4 active bookings, renews 4 → new allowance should be 8
    // so they can book 4 more without waiting for current bookings to complete
    expect(computeRenewalAllowance(4, 4, 4)).toBe(8)
  })

  it('handles partial renewal (1 session)', () => {
    expect(computeRenewalAllowance(2, 1, 1)).toBe(2)
  })

  it('handles 0 active bookings (new client renewing)', () => {
    expect(computeRenewalAllowance(0, 0, 8)).toBe(8)
  })
})
