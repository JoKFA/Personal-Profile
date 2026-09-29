// Pure archive state: which drives read as plaintext under the current "Hiring for" lens,
// and when each one flips as the decrypt wave passes it.
import type { Entry, Lens } from '../data/types'
import { LANES, ROWS, nearest, slotKey, wrap, type Cell } from '../motion/grid'
import { pulseDistance } from '../motion/waves'

/** A stable printed ID for an empty drive. */
export const sealedId = (c: Cell) => `0x${((wrap(c.lane, LANES) * 7919 + wrap(c.row, ROWS) * 104729) >>> 0).toString(16).slice(-4).padStart(4, '0')}`

export const readable = (e: Entry, lens: Lens) =>
  e.roles === 'all' || lens === 'all' || e.roles.includes(lens)

export interface Shown { plain: boolean; to: boolean | null; at: number }
export type ShownMap = Map<string, Shown>

/** Flip delay: the wave leaves the selected drive and reaches others 60 ms per row. */
export const FLIP_START = 0.15
export const FLIP_PER_ROW = 0.06

/**
 * Re-key the archive for `lens`. Each drive whose target state changes is scheduled to flip when
 * the wave reaches it. Compared against where a drive is heading (not where it is), so a pending
 * flip from an earlier lens change is cancelled or overridden instead of landing afterwards.
 * Returns how many drives will change.
 */
export function rekey(shown: ShownMap, entries: readonly Entry[], lens: Lens, from: Cell, now: number) {
  let flips = 0
  for (const e of entries) {
    const want = readable(e, lens)
    const s = shown.get(e.id)
    if (!s) { shown.set(e.id, { plain: want, to: null, at: now }); continue }
    if (s.plain === want) { s.to = null; continue }
    if (s.to === want) continue
    const dLane = nearest(e.slot.lane, from.lane, LANES) - from.lane
    const dRow = nearest(e.slot.row, from.row, ROWS) - from.row
    s.to = want; s.at = now + FLIP_START + pulseDistance(dRow, dLane) * FLIP_PER_ROW
    flips++
  }
  return flips
}

/** Everything encrypted: the state before the entry wave. */
export function sealAll(shown: ShownMap, entries: readonly Entry[], now: number) {
  for (const e of entries) shown.set(e.id, { plain: false, to: null, at: now })
}

/** Land the flips that are due. Returns the ids that changed this frame. */
export function land(shown: ShownMap, now: number) {
  const changed: string[] = []
  for (const [id, s] of shown) if (s.to !== null && now >= s.at) { s.plain = s.to; s.to = null; changed.push(id) }
  return changed
}

export const isPlain = (shown: ShownMap, e: Entry | null | undefined) => !!e && (shown.get(e.id)?.plain ?? false)

export function slotIndex(entries: readonly Entry[]) {
  const m = new Map<string, Entry>()
  for (const e of entries) m.set(slotKey(e.slot), e)
  return (c: Cell) => m.get(slotKey(c)) ?? null
}
