// Archive data model. Every drive in the archive is one Entry: a case file (a project) or a
// service record (a job). Skills are not drives; they live inside entries and the subject file.
// Facts come from E:\简历系统\resume-system\experience_db.yaml (the resume fact database);
// data/sources.ts (test-only) names the database entry each record was written from.

export type RoleId = 'ai' | 'cloud' | 'soc' | 'grc' | 'it'
export type Lens = RoleId | 'all'

export interface Role {
  id: RoleId
  name: string
  /** job titles this lens is for, shown when the lens is picked */
  seats: string
  /** one line: what Yaoting does in this area, with proof */
  fit: string
}

export interface Drawer { lane: number; name: string; code: string }

export interface Slot { lane: number; row: number }

/** case = project · service = job · skill / credential = small records that point at evidence */
export type EntryKind = 'subject' | 'case' | 'service' | 'education' | 'visitor' | 'restricted' | 'skill' | 'credential'
/** What each kind is called on screen: the words a recruiter uses, not the archive's own */
export const KIND_NAME: Record<EntryKind, string> = {
  subject: 'Profile', case: 'Project', service: 'Experience', education: 'Education',
  skill: 'Skill', credential: 'Certifications', visitor: 'Visitor file', restricted: 'Restricted',
}

export type DemoKey =
  | 'mcpsf' | 'edr' | 'pentest' | 'telus' | 'viva' | 'network' | 'pwnscan'
  | 'visitor' | 'sentinel' | 'timeline' | 'coast' | 'vibes' | 'bcit' | 'vivaops' | 'custody' | 'stack' | 'quorum'

export interface Section { eyebrow: string; title: string; body: string; points?: string[]; note?: string }
export interface Finding { severity: 'critical' | 'high' | 'medium' | 'low' | 'ok'; label: string; title: string; detail: string }

export interface Entry {
  id: string
  slug: string
  kind: EntryKind
  title: string
  /** second line in the panel and the file header */
  kicker: string
  /** one sentence: what this proves */
  summary: string
  /** which "Hiring for" lenses read this entry; 'all' = always readable */
  roles: RoleId[] | 'all'
  slot: Slot
  year?: string
  /** a line of context for older work, e.g. what was new at the time */
  era?: string
  facts: [string, string][]
  numbers?: [string, string][]
  sections?: Section[]
  findings?: Finding[]
  stack?: string[]
  /** related entries by id */
  related?: string[]
  demo?: DemoKey
  /** shown under the demo: what is real and what is a sample */
  demoNote?: [string, string]
  link?: { label: string; href: string }
  seo?: { title: string; description: string }
  /** skills and credentials: the drives that prove them */
  evidence?: string[]
  /** education: the courses, and what each one produced (a drive when there is one) */
  courses?: { code: string; title: string; out: string; ids?: string[]; href?: string }[]
  // service records and education
  org?: string
  dates?: string
  place?: string
}
