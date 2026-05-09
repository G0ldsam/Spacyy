/**
 * Pure slot-accounting functions extracted from API route handlers.
 * No I/O — safe to unit test in isolation.
 */

export type AllowanceCheckResult = 'ok' | 'use_pending' | 'blocked'

/**
 * Determines whether a new booking can proceed given the client's allowance state.
 *
 * @param activeBookingsCount  Current count of non-cancelled future bookings
 * @param sessionAllowance     Client's max concurrent future bookings (null = unlimited)
 * @param allowPendingSlot     Whether the org permits one extra "pending" booking
 */
export function checkBookingAllowance(
  activeBookingsCount: number,
  sessionAllowance: number | null,
  allowPendingSlot: boolean
): AllowanceCheckResult {
  if (sessionAllowance === null) return 'ok'
  if (activeBookingsCount < sessionAllowance) return 'ok'
  if (allowPendingSlot && activeBookingsCount < sessionAllowance + 1) return 'use_pending'
  return 'blocked'
}

export type CancelEffect =
  | { action: 'decrement_pending' }
  | { action: 'decrement_allowance' }
  | { action: 'none' }

/**
 * Determines the slot accounting side-effect when a booking is cancelled.
 *
 * 4-case matrix:
 *   pre-session + used pending  → decrement pendingSlotsUsed (debt cleared)
 *   pre-session + regular       → none (count drops naturally, no action)
 *   post-session + regular      → decrement sessionAllowance (slot permanently consumed)
 *   post-session + used pending → none (debt stays, no allowance change)
 *
 * @param isPreSession      True when booking hasn't started yet
 * @param usedPendingSlot   Whether this booking consumed a pending slot on creation
 * @param sessionAllowance  Client's current allowance (null = unlimited, skip accounting)
 * @param pendingSlotsUsed  Client's current pending debt count
 */
export function computeCancelEffect(
  isPreSession: boolean,
  usedPendingSlot: boolean,
  sessionAllowance: number | null,
  pendingSlotsUsed: number
): CancelEffect {
  if (sessionAllowance === null) return { action: 'none' }

  if (isPreSession && usedPendingSlot && pendingSlotsUsed > 0) {
    return { action: 'decrement_pending' }
  }

  if (!isPreSession && !usedPendingSlot && sessionAllowance > 0) {
    return { action: 'decrement_allowance' }
  }

  return { action: 'none' }
}

/**
 * Calculates the new sessionAllowance after a membership renewal.
 *
 * New allowance = active future bookings + sessions being added.
 * This ensures clients can immediately book their renewed sessions
 * while not losing count of slots already used.
 *
 * @param currentAllowance    Existing allowance (null = unlimited)
 * @param activeBookingsCount Active non-cancelled future bookings
 * @param sessionsToAdd       Sessions granted by the renewal
 */
export function computeRenewalAllowance(
  currentAllowance: number | null,
  activeBookingsCount: number,
  sessionsToAdd: number
): number | null {
  if (currentAllowance === null) return null
  return activeBookingsCount + sessionsToAdd
}
