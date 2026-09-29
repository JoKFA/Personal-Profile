// The archive wraps infinitely in both directions. A cell's canonical slot is (lane mod LANES,
// row mod ROWS); the drawn copy nearest the camera is picked with `nearest`.

export const LANES = 6
export const ROWS = 32
export const COLUMN_SPACING = 5.2
export const ROW_SPACING = 0.62

export interface Cell { lane: number; row: number }

export const wrap = (v: number, n: number) => ((v % n) + n) % n
/** The copy of periodic value `v` (period `p`) closest to `c`. */
export const nearest = (v: number, c: number, p: number) => v + Math.floor((c - v + p / 2) / p) * p
export const cellKey = (c: Cell) => `${c.lane}:${c.row}`
export const slotKey = (c: Cell) => `${wrap(c.lane, LANES)}:${wrap(c.row, ROWS)}`
export const sameCell = (a: Cell, b: Cell) => a.lane === b.lane && a.row === b.row

/** Copy of a slot nearest to the current selection, so jumps travel the short way round. */
export const nearestCell = (slot: Cell, from: Cell): Cell => ({
  lane: nearest(slot.lane, from.lane, LANES),
  row: nearest(slot.row, from.row, ROWS),
})
