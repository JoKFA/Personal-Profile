// Every string the phone shell shows that is not already on the site (plan §8). One table, so a copy change is one edit.
// 'pending' = shown but awaiting the owner's approval; 'existing' = the site's own words (entries.ts, story.ts).
import { entryById } from '../../data/entries'
import { DRAWERS } from '../../data/roles'
import { SELECTED, THESIS } from '../../data/story'

const pad = (n: number) => String(n).padStart(2, '0')

export const COPY = {
  // existing
  brand: 'Yaoting Wang', role: 'Security Analyst',
  thesisLead: THESIS.lead, thesisRest: THESIS.rest,
  availability: 'Master of Cybersecurity, SFU · CCNA · Security+ · Full-time from Apr 2027',
  coverTitle: 'Inside my drive: six areas →',
  open: 'Open →', back: '← All files', index: 'Index', contact: 'Contact',
  // pending (plan §8)
  landscape: 'Turn your phone upright to open the archive.',
  keyIssued: (id: string) => `KEY ISSUED · ${id}`,
  /** `FILE <ID> · DRAWER nn · NAME` is the prototype's wording for the open file's eyebrow */
  fileEyebrow: (id: string) => { const lane = entryById.get(id)?.slot.lane ?? 0; return `FILE ${id} · DRAWER ${pad(lane + 1)} · ${DRAWERS[lane].name.toUpperCase()}` },
  verify: (blocks: number, ok: boolean) => `AES-256-GCM · ${blocks} BLOCKS · TAG ${ok ? 'VERIFIED' : 'MISMATCH'}`,
} as const

/** the reticle's tag and the panel's eyebrow, per stop (pending approval) */
const TAGS: Record<string, string> = {
  'YW-000': 'FILE YW-000 · PROFILE', 'X-001': '01 / 04 · FILE X-001', 'SR-01': '02 / 04 · RECORD SR-01', 'SR-02': '03 / 04 · RECORD SR-02', 'X-009': '04 / 04 · FILE X-009',
}
const EYEBROWS: Record<string, string> = {
  'YW-000': 'PROFILE & EDUCATION', 'X-001': 'PROJECT · AI SECURITY · 2025', 'SR-01': 'CO-OP · FINANCIAL SERVICES · 2026', 'SR-02': 'INTERNSHIP · STARTUP CLOUD · 2025', 'X-009': 'PROJECT · IOT EXPOSURE · 2026',
}

export interface StopCopy { id: string; n: number; tag: string; eyebrow: string; title: string; sum?: string; small?: string }

/** What each stop of the reel says: the entry's own strings (title is the employer for a job, as the prototype), plus the table above. */
export function stopCopy(id: string, n: number): StopCopy {
  const e = entryById.get(id)
  if (id === 'YW-000') return { id, n, tag: TAGS[id], eyebrow: EYEBROWS[id], title: COPY.coverTitle }
  if (!e) throw new Error(`no entry ${id}`)
  return { id, n, tag: TAGS[id] ?? id, eyebrow: EYEBROWS[id] ?? e.kicker.toUpperCase(), title: e.org ?? e.title, sum: e.summary, small: SELECTED.find((s) => s.id === id)?.line }
}
