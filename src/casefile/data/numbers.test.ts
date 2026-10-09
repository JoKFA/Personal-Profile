// V7: every number a reader can see is tied to a source. A new or changed number fails this
// test until it is added here with where it comes from.
import { describe, expect, it } from 'vitest'
import { CERTIFICATIONS, EDUCATION, ENTRIES } from './entries'
import { ROLES } from './roles'
import { CAPABILITIES } from './capabilities'
import { SOURCES } from './sources'
import { CHAPTERS, HEADLINE, KEY_NUMBERS, PRINCIPLES, SELECTED, THESIS } from './story'

const DB = 'experience_db.yaml'
const USER = 'user, spec §5.4 / §13'
const NUMBER_SOURCES: Record<string, string> = {
  '14': `${DB}: MCPSF 14 detectors`,
  '60+': `${DB}: MCPSF validated against 60+ real MCP servers`,
  '5': `${USER} Q-S1 (old site, 5 pipeline phases); GFS 5/5 availability (${DB})`,
  '30–90': `${USER} Q-S1 (old site runtime per target)`,
  '50+': `${DB}: Coast Capital 50+ internal assessments`,
  '20+': `${DB}: Coast Capital 20+ vendors; BCIT 20+ policies`,
  '1,000+': `${DB}: BCIT awareness audience`,
  '~15%': `${DB}: BCIT phishing simulations (fact 601)`,
  '~30%': `${DB}: VibesMeet monthly AWS cost`,
  '30%': `${DB}: VibesMeet monthly AWS cost`,
  '500+': `${DB}: VIVA sole IT contact`,
  '3+': `${DB}: VIVA public services`,
  '4': `${DB}: BCIT 4 IR playbooks; pentest surfaces listed in fact 1361; campus network 4 sites`,
  '12': `${DB}: VIVA 12 threats, all remediated`,
  '741.9': `${DB}: GFS avg read latency`, '1,168.7': `${DB}: GFS avg write latency`, '46.7': `${DB}: GFS replica recovery`,
  '6': `${DB}: GFS 6-second heartbeat timeout; campus network six-person team`,
  '1': `${DB}: GFS one master`, '3': `${DB}: GFS three chunk servers; PwnScan team of three (${USER}); Top 3 (${USER})`,
  '783': 'SFU course code CMPT 783', '756': 'SFU course code CMPT 756',
  '782': 'SFU course code CMPT 782 (transcript)', '789': 'SFU course code CMPT 789 (transcript)', '626': 'SFU course code CMPT 626 (transcript)',
  '7509': 'BCIT course code FSCT 7509 (program page)', '8611': 'BCIT course code FSCT 8611 (thesis title page)',
  '65%': 'thesis Table 3: redundancy before', '12%': 'thesis Table 3: redundancy after', '15': 'thesis Table 3: alerts/hour before', '150': 'thesis Table 3: alerts/hour after',
  '256': 'AES-256-GCM (CryptoLab README)', '8513': 'BCIT course code FSCT 8513', '7511': 'BCIT course code FSCT 7511',
  '8540': 'BCIT course code FSCT 8540', '8560': 'BCIT course code FSCT 8560', '7002': 'BCIT course code FSCT 7002',
  '1.3': 'TLS 1.3 (GFS)', '27001': 'ISO 27001', '2': 'SOC 2 Type II', '10': 'OWASP Top 10', 'L3': 'MPLS L3 VPN',
  '2024': `${DB}: EDR project year (${USER} G17)`, '2026': `${USER} G17/G23: PwnScan Top 3, 2026`, '2027': 'SFU transcript and calendar: Master of Cybersecurity, expected Apr 2027', '2025': 'main.tex education dates', '2023': 'main.tex education dates', '2021': 'main.tex education dates', '2022': `${USER} G17: campus network 2022`,
  '365': 'Microsoft 365 (product name)',
  '120': 'Palo Alto EDU-120 (certification name)', '000': 'X-000 file ID in copy',
}

const shown = (): string[] => {
  const t: string[] = []
  for (const e of ENTRIES) {
    t.push(e.title, e.kicker, e.summary, e.era ?? '', e.org ?? '', ...(e.seo ? [e.seo.title, e.seo.description] : []))
    for (const [k, v] of e.facts) t.push(k, v)
    for (const [n, l] of e.numbers ?? []) t.push(n, l)
    for (const s of e.sections ?? []) t.push(s.title, s.body, ...(s.points ?? []), s.note ?? '')
    for (const f of e.findings ?? []) t.push(f.title, f.detail)
  }
  for (const r of ROLES) t.push(r.fit, r.seats)
  for (const c of CAPABILITIES) for (const [s] of c.skills) t.push(s)
  for (const [d, o] of EDUCATION) t.push(d, o)
  for (const e of ENTRIES) for (const c of e.courses ?? []) t.push(c.code, c.title, c.out)
  // the subject file's story, key numbers and the film's six attacks
  t.push(HEADLINE, THESIS.lead, THESIS.rest, ...SELECTED.flatMap((s) => [s.tag, s.line]))
  for (const c of CHAPTERS) t.push(c.title, c.line, ...c.steps.map((s) => s.what))
  for (const p of PRINCIPLES) t.push(p.title, p.body)
  for (const [n, l, w] of KEY_NUMBERS) t.push(n, l, w)
  t.push(...CERTIFICATIONS)
  return t
}
const tokens = (s: string) => s.match(/~?\d[\d,.]*(?:–\d+)?(?:\+|%)?|L3/g) ?? []

describe('numbers shown to readers', () => {
  it('finds numbers to check', () => { expect(shown().flatMap(tokens).length).toBeGreaterThan(40) })
  it('every number has a source', () => {
    const unknown = [...new Set(shown().flatMap(tokens))].filter((n) => !(n.replace(/[.,]$/, '') in NUMBER_SOURCES))
    expect(unknown).toEqual([])
  })
  it('every entry names its fact source (test-only, not shipped)', () => {
    for (const e of ENTRIES) {
      if (e.kind === 'skill' || e.kind === 'credential') expect(e.evidence?.length, e.id).toBeGreaterThan(0)   // proven by other drives
      else expect(SOURCES[e.id]?.length, e.id).toBeGreaterThan(0)
    }
  })
})
