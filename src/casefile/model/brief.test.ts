import { describe, expect, it } from 'vitest'
import { ENTRIES, entryById } from '../data/entries'
import { SELECTED } from '../data/story'
import { LANES, wrap } from '../motion/grid'
import { briefCells } from './brief'

const entries = SELECTED.map((s) => entryById.get(s.id)!)
// home opens with the selection on the subject file
const home = entryById.get('YW-000')!.slot

// Home stands the four selected files up in their own slots, as an even 2 × 2: 01 over 02, 03 over 04
// (data/entries.ts RANK). If a file is added to a drawer that shifts one of them, this fails first.
describe('home: the four selected files', () => {
  const cells = briefCells(home, entries)
  const [a, b, c, d] = cells   // 01 X-001 · 02 SR-01 · 03 SR-02 · 04 X-009

  it('are four distinct drives', () => {
    expect(cells).toHaveLength(4)
    expect(new Set(cells.map((x) => `${x.lane}:${x.row}`)).size).toBe(4)
  })

  it('each stand in their own drawer: lanes 1, 2, 4 and 5 (mod 6), one apiece', () => {
    expect(cells.map((x) => wrap(x.lane, LANES)).sort()).toEqual([1, 2, 4, 5])
    // and each is on its own record, not a neighbour of it
    cells.forEach((x, i) => expect(wrap(x.lane, LANES), SELECTED[i].id).toBe(entries[i].slot.lane))
  })

  it('make two pairs, each three rows apart, so they sit at even distances', () => {
    expect(Math.abs(c.row - a.row)).toBe(3)   // the two drawers on the left (X-001, SR-02)
    expect(Math.abs(d.row - b.row)).toBe(3)   // the two on the right (SR-01, X-009)
    expect(Math.abs(c.lane - a.lane)).toBe(1)
    expect(Math.abs(d.lane - b.lane)).toBe(1)
  })

  it('are the drives that hold those files', () => {
    for (const [i, x] of cells.entries()) {
      const on = ENTRIES.filter((e) => wrap(e.slot.lane, LANES) === wrap(x.lane, LANES) && e.slot.row === ((x.row % 32) + 32) % 32)
      expect(on.map((e) => e.id), SELECTED[i].id).toContain(SELECTED[i].id)
    }
  })
})
