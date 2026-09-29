import { describe, expect, it } from 'vitest'
import { ENTRIES, entryById } from '../data/entries'
import { isPlain, land, readable, rekey, sealAll, slotIndex, type ShownMap } from './archive'
import { Ueba, UEBA } from './ueba'

const from = entryById.get('X-001')!.slot
const plainCount = (s: ShownMap) => ENTRIES.filter((e) => isPlain(s, e)).length

describe('lens', () => {
  it('any role reads everything; a role reads its own plus the always-readable', () => {
    const mcp = entryById.get('X-001')!, subject = entryById.get('YW-000')!
    expect(readable(mcp, 'all')).toBe(true)
    expect(readable(mcp, 'ai')).toBe(true)
    expect(readable(mcp, 'grc')).toBe(false)
    expect(readable(subject, 'grc')).toBe(true)
  })
  it('the decrypt wave lands drives in order of distance', () => {
    const s: ShownMap = new Map(); sealAll(s, ENTRIES, 0)
    rekey(s, ENTRIES, 'all', from, 0)
    expect(plainCount(s)).toBe(0)
    const near = land(s, 0.4), all = land(s, 10)
    expect(near.length).toBeGreaterThan(0)
    expect(near).toContain('X-001')
    expect(near.length + all.length).toBe(ENTRIES.length)
    expect(plainCount(s)).toBe(ENTRIES.length)
  })
  it('a lens change before the previous wave landed wins (v13 bug)', () => {
    const s: ShownMap = new Map(); sealAll(s, ENTRIES, 0)
    rekey(s, ENTRIES, 'all', from, 0)          // entry wave still in flight
    rekey(s, ENTRIES, 'soc', from, 0.05)       // reader picks a role immediately
    land(s, 10)
    expect(isPlain(s, entryById.get('X-001'))).toBe(false)
    expect(isPlain(s, entryById.get('X-002'))).toBe(true)
    expect(plainCount(s)).toBe(ENTRIES.filter((e) => readable(e, 'soc')).length)
  })
  it('switching back cancels a pending flip without counting it', () => {
    const s: ShownMap = new Map(); rekey(s, ENTRIES, 'all', from, 0)
    const n = rekey(s, ENTRIES, 'grc', from, 1)
    expect(n).toBeGreaterThan(0)
    expect(rekey(s, ENTRIES, 'all', from, 1.01)).toBe(0)
    land(s, 10)
    expect(plainCount(s)).toBe(ENTRIES.length)
  })
  it('finds entries by wrapped cell', () => {
    const at = slotIndex(ENTRIES), s = entryById.get('X-001')!.slot
    expect(at(s)?.id).toBe('X-001')
    expect(at({ lane: s.lane + 6, row: s.row - 32 })?.id).toBe('X-001')
    expect(at({ lane: s.lane, row: s.row + 1 })).toBeNull()
  })
})

describe('ueba', () => {
  it('throttles a burst of selections', () => {
    const u = new Ueba()
    let a = null
    for (let i = 0; i < UEBA.burst.count; i++) a = u.select(i * 0.1)
    expect(a?.action).toMatch(/throttled/)
    expect(u.throttledUntil).toBeGreaterThan(0.6)
    expect(u.risk).toBeGreaterThan(UEBA.floor)
  })
  it('flags enumeration after three denials, then cools down', () => {
    const u = new Ueba()
    expect(u.deny(0)).toBeNull(); expect(u.deny(1)).toBeNull()
    expect(u.deny(2)?.what).toMatch(/T1083/)
    expect(u.deny(3)).toBeNull()
  })
  it('risk decays to the floor', () => {
    const u = new Ueba(); u.captured()
    expect(u.level).toBe('elevated')
    for (let i = 0; i < 100; i++) u.tick(1)
    expect(u.risk).toBe(UEBA.floor)
    expect(u.level).toBe('baseline')
  })
})
