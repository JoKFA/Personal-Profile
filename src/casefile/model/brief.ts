// Home (the brief): which copy of each selected file it stands up. The archive wraps in both directions,
// so every file has a copy near any cell; home takes the lane offset at which the four copies sit closest
// together (the nearer to the selection, the better), so they read as one group in the camera's frame.
import { nearestCell, type Cell } from '../motion/grid'
import type { Entry } from '../data/types'

/** The cells home draws, in the order of `entries` (the selected files, 01 → 04), for a selection at `sel`. */
export function briefCells(sel: Cell, entries: readonly Pick<Entry, 'slot'>[]): Cell[] {
  let best: Cell[] = [], spread = Infinity
  for (let k = -3; k <= 3; k++) {
    const cells = entries.map((e) => nearestCell(e.slot, { lane: sel.lane + k, row: sel.row }))
    const lanes = cells.map((c) => c.lane), w = Math.max(...lanes) - Math.min(...lanes)
    if (w < spread || (w === spread && Math.abs(k) < 1)) { best = cells; spread = w }
  }
  return best
}
