import { describe, expect, it } from 'vitest'
import { entryById } from '../../data/entries'
import { REEL } from '../manifest'
import { COPY, stopCopy } from './copy'

describe('the phone shell copy', () => {
  const stops = REEL.map((id, i) => stopCopy(id, i))
  it('every stop of the reel has an entry, a title, an eyebrow and a tag (the table of plan 8)', () => {
    expect(stops.map((s) => s.tag)).toEqual(['FILE YW-000 · PROFILE', '01 / 04 · FILE X-001', '02 / 04 · RECORD SR-01', '03 / 04 · RECORD SR-02', '04 / 04 · FILE X-009'])
    expect(stops.map((s) => s.eyebrow)).toEqual(['PROFILE & EDUCATION', 'PROJECT · AI SECURITY · 2025', 'CO-OP · FINANCIAL SERVICES · 2026', 'INTERNSHIP · STARTUP CLOUD · 2025', 'PROJECT · IOT EXPOSURE · 2026'])
    for (const s of stops) {
      expect(s.title.length).toBeGreaterThan(0)
      if (s.id !== 'YW-000') { expect(s.sum).toBeTruthy(); expect(s.small).toBeTruthy() }
    }
  })
  it('the words come from the site: summaries are the entries', () => {
    for (const s of stops.slice(1)) expect(s.sum).toBe(entryById.get(s.id)!.summary)
    expect(stops[2].title).toBe('Coast Capital Savings')
    expect(stops[3].title).toBe('VibesMeet LLC')
  })
  it('the file eyebrow, the key tag and the verify line', () => {
    expect(COPY.fileEyebrow('X-001')).toBe('FILE X-001 · DRAWER 02 · AI SECURITY')
    expect(COPY.keyIssued('X-001')).toBe('KEY ISSUED · X-001')
    expect(COPY.verify(17, true)).toBe('AES-256-GCM · 17 BLOCKS · TAG VERIFIED')
  })
})
