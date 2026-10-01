import { describe, expect, it } from 'vitest'
import { ENTRIES, entryById } from './entries'
import { CAPABILITIES } from './capabilities'
import { DRAWERS, ROLE_IDS } from './roles'
import { LANES, ROWS, slotKey } from '../motion/grid'

const openable = ENTRIES.filter((e) => e.kind === 'case' || e.kind === 'service' || e.kind === 'education')
const reads = (e: (typeof ENTRIES)[number], role: string) => e.roles === 'all' || e.roles.includes(role as never)

describe('archive data', () => {
  it('has real content', () => {
    expect(ENTRIES.filter((e) => e.kind === 'case').length).toBeGreaterThanOrEqual(9)
    expect(ENTRIES.filter((e) => e.kind === 'service').length).toBe(4)
  })
  it('every slot is unique and inside the grid', () => {
    const seen = new Set<string>()
    for (const e of ENTRIES) {
      expect(e.slot.lane).toBeGreaterThanOrEqual(0); expect(e.slot.lane).toBeLessThan(LANES)
      expect(e.slot.row).toBeGreaterThanOrEqual(0); expect(e.slot.row).toBeLessThan(ROWS)
      const k = slotKey(e.slot); expect(seen.has(k), `${e.id} collides at ${k}`).toBe(false); seen.add(k)
    }
  })
  it('ids and slugs are unique', () => {
    expect(new Set(ENTRIES.map((e) => e.id)).size).toBe(ENTRIES.length)
    expect(new Set(ENTRIES.map((e) => e.slug)).size).toBe(ENTRIES.length)
  })
  it('every role has at least one case file and three readable drives', () => {
    for (const role of ROLE_IDS) {
      const readable = openable.filter((e) => reads(e, role))
      expect(readable.filter((e) => e.kind === 'case').length, role).toBeGreaterThanOrEqual(1)
      expect(readable.length, role).toBeGreaterThanOrEqual(3)
    }
  })
  it('related links and capability evidence point at real drives', () => {
    for (const e of ENTRIES) for (const r of e.related ?? []) expect(entryById.has(r), `${e.id} → ${r}`).toBe(true)
    for (const c of CAPABILITIES) for (const [, ev] of c.skills) for (const id of ev) expect(entryById.has(id), id).toBe(true)
  })
  it('printed IDs fit on the drive label', () => {
    for (const e of ENTRIES) expect(e.id.length).toBeLessThanOrEqual(8)
  })
  it('public pages have SEO copy', () => {
    for (const e of openable) {
      expect(e.seo?.title, e.id).toBeTruthy()
      expect(e.seo!.description.length, e.id).toBeGreaterThan(40)
    }
  })
  it('lanes are named drawers', () => {
    for (const e of ENTRIES) expect(DRAWERS[e.slot.lane]).toBeTruthy()
  })
  it('claims respect the fact database limits', () => {
    const text = JSON.stringify(ENTRIES)
    expect(text.match(/reported incidents/i)?.[0]).toBeUndefined()          // BCIT: phishing simulations, not incidents
    expect(text.match(/ViMi/i)?.[0]).toBeUndefined()                          // pentest client stays unnamed
    expect(text.match(/live SOC investigations/i)?.[0]).toBeUndefined()
    expect(text.match(/20\+ (real |open-source )?(MCP )?servers/i)?.[0]).toBeUndefined() // MCPSF is 60+
    expect(text.match(/\b604[-. ]?\d{3}/)?.[0]).toBeUndefined()               // no phone number
  })
})
