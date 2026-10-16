import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTACT, ENTRIES, entryById } from '../../data/entries'
import { SELECTED } from '../../data/story'
import { buildIndex, contactFacts, fillIndex, contactLinks, indexGroups, rowOf } from './indexpage'

describe('the phone Index: the desktop IndexPanel\'s groups, order and words', () => {
  const groups = indexGroups()
  it('six groups in the desktop\'s order', () => {
    expect(groups.map((g) => g.name)).toEqual(['Start here', 'Profile', 'Experience', 'Projects', 'Education', 'You'])
  })
  it('Start here is the selected files in their order; Profile is the subject; the others are by kind', () => {
    expect(groups[0].rows.map((r) => r.id)).toEqual(SELECTED.map((s) => s.id))
    expect(groups[1].rows.map((r) => r.id)).toEqual(['YW-000'])
    expect(groups[2].rows.map((r) => r.id)).toEqual(ENTRIES.filter((e) => e.kind === 'service').map((e) => e.id))
    expect(groups[3].rows.map((r) => r.id)).toEqual(ENTRIES.filter((e) => e.kind === 'case' || e.kind === 'restricted').map((e) => e.id))
    expect(groups[4].rows.map((r) => r.id)).toEqual(ENTRIES.filter((e) => e.kind === 'education').map((e) => e.id))
    expect(groups[5].rows.map((r) => r.id)).toEqual(['V-FILE'])
  })
  it('the title is the employer for a service; the small line follows the desktop\'s rule', () => {
    const sr = rowOf(entryById.get('SR-01')!), x1 = rowOf(entryById.get('X-001')!), ed = rowOf(entryById.get('ED-01')!)
    expect(sr.title).toBe(entryById.get('SR-01')!.org); expect(sr.small).toBe(entryById.get('SR-01')!.title)
    expect(x1.small).toBe('AI security · 2025')
    expect(ed.small).toBe(`${entryById.get('ED-01')!.org} · ${entryById.get('ED-01')!.dates}`)
    expect(rowOf(entryById.get('V-FILE')!).small).toBe(entryById.get('V-FILE')!.kicker)
  })
  it('the restricted file is shown under its own title (the phone has no captured state)', () => {
    expect(rowOf(entryById.get('X-000')!).title).toBe('SENTINEL-1')
  })
  it('every row has an entry, a title and a small line, and no entry is listed twice in Projects, Experience or Education', () => {
    for (const g of groups) for (const r of g.rows) { expect(entryById.has(r.id)).toBe(true); expect(r.title.length).toBeGreaterThan(0); expect(r.small.length).toBeGreaterThan(0) }
    const ids = groups.slice(1).flatMap((g) => g.rows.map((r) => r.id)); expect(new Set(ids).size).toBe(ids.length)
  })
  it('every row opens: a stop with an open clip, or the profile\'s door (read from the bake\'s manifest)', () => {
    const m = JSON.parse(readFileSync(join(__dirname, '../../../../public/phone/manifest.json'), 'utf8')) as { stops: Record<string, unknown>; open: Record<string, unknown>; door?: Record<string, unknown> }
    for (const g of groups) for (const r of g.rows) {
      expect(m.stops[r.id], `${r.id} has a stop`).toBeTruthy()
      expect(r.id === 'YW-000' ? m.door?.['YW-000'] : m.open[r.id], `${r.id} opens`).toBeTruthy()
    }
  })
})

describe('the phone Index: the built sheet', () => {
  const host = document.createElement('main'); document.body.appendChild(host)
  const ix = buildIndex(host, 5)
  expect(ix.filled, 'the sheet is empty until it is filled').toBe(false)
  fillIndex(ix, 5)
  it('is the last section, with a button for each row, each the whole row', () => {
    expect(ix.sec.id).toBe('ph-s5')
    expect(ix.rows.length).toBe(indexGroups().reduce((n, g) => n + g.rows.length, 0))
    for (const b of ix.rows) { expect(b.tagName).toBe('BUTTON'); expect(b.dataset.id).toBeTruthy(); expect(b.textContent!.startsWith(b.dataset.id!)).toBe(true) }
  })
  it('the headings run in order: h2 Index, an h3 per group, h2 Contact', () => {
    const hs = [...ix.sec.querySelectorAll('h2, h3')].map((h) => `${h.tagName}:${h.textContent}`)
    expect(hs).toEqual(['H2:Index', 'H3:Start here', 'H3:Profile', 'H3:Experience', 'H3:Projects', 'H3:Education', 'H3:You', 'H2:Contact'])
  })
  it('Contact: the profile\'s three facts, then the four links; the address is plain text', () => {
    expect(contactFacts().map(([k]) => k)).toEqual(['Available', 'Looking for', 'Based'])
    const sub = entryById.get('YW-000')!.facts
    for (const [k, v] of contactFacts()) expect(sub).toContainEqual([k, v])
    const as = [...ix.contact.querySelectorAll<HTMLAnchorElement>('a')]
    expect(as.map((a) => a.querySelector('.n')!.textContent)).toEqual(['Email', 'LinkedIn', 'GitHub', 'Résumé'])
    expect(as.map((a) => a.getAttribute('href'))).toEqual([`mailto:${CONTACT.email}`, CONTACT.linkedin, CONTACT.github, CONTACT.resume])
    expect(ix.contact.querySelector('.ph-mail')!.textContent).toBe(CONTACT.email)
    expect(ix.contact.querySelector('.ph-mail')!.closest('a')).toBeNull()
    expect(contactLinks().filter((l) => l.external).every((l) => as.find((a) => a.href.endsWith(l.href.replace(/^https?:\/\/[^/]+/, '')))?.rel.includes('noopener'))).toBe(true)
  })
  it('Contact has its own anchor and name', () => {
    expect(ix.contact.id).toBe('ph-contact'); expect(ix.contact.getAttribute('aria-labelledby')).toBe('ph-contact-h')
  })
})
