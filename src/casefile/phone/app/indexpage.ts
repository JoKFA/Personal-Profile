// The phone's Index and Contact (plan M1 P5): one paper sheet at the end of the reel. The groups, their order and each row's words are the desktop's
// (Hud.tsx IndexPanel, ContactPanel); nothing here is new copy. Plain DOM, no animation of its own: the sheet slides on the page layer's springs (page.ts).
import { CONTACT, ENTRIES, entryById } from '../../data/entries'
import type { Entry } from '../../data/types'
import { SELECTED } from '../../data/story'

/** one row of the Index */
export interface IndexRow { id: string; title: string; small: string }
export interface IndexGroup { name: string; rows: IndexRow[] }

/**
 * A row's words, by the desktop's rule: the title is the employer for a service; the small line is the role for a service, the school and dates for an education,
 * the kicker (without "Project · ") and the year for an entry with a year, else the kicker. The desktop shows `[REDACTED]` for the restricted file until it has been
 * captured; the phone has no such state (its file page shows the file's own title), so it shows that title.
 */
export function rowOf(e: Entry): IndexRow {
  const small = e.kind === 'service' ? e.title : e.kind === 'education' ? `${e.org} · ${e.dates}` : e.year ? `${e.kicker.replace(/^Project · /, '')} · ${e.year}` : e.kicker
  return { id: e.id, title: e.kind === 'service' ? e.org ?? e.title : e.title, small }
}

/** Start here (the selected files in their order), Profile, Experience, Projects, Education, You: the desktop's groups */
export function indexGroups(): IndexGroup[] {
  const groups: [string, Entry[]][] = [
    ['Start here', SELECTED.map((x) => entryById.get(x.id)!)],
    ['Profile', ENTRIES.filter((e) => e.kind === 'subject')],
    ['Experience', ENTRIES.filter((e) => e.kind === 'service')],
    ['Projects', ENTRIES.filter((e) => e.kind === 'case' || e.kind === 'restricted')],
    ['Education', ENTRIES.filter((e) => e.kind === 'education')],
    ['You', ENTRIES.filter((e) => e.kind === 'visitor')],
  ]
  return groups.map(([name, list]) => ({ name, rows: list.map(rowOf) }))
}

/** the profile's facts the Contact block opens with, in this order (the entry's own strings) */
export const CONTACT_FACTS = ['Available', 'Looking for', 'Based'] as const
export const contactFacts = (): [string, string][] => CONTACT_FACTS.map((k) => (entryById.get('YW-000')!.facts.find(([l]) => l === k) ?? [k, ''])).filter(([, v]) => v) as [string, string][]

/** the four links, the desktop's: label, the text beside it, the address, whether it leaves the site */
export const contactLinks = () => [
  { label: 'Email', text: CONTACT.email, href: `mailto:${CONTACT.email}`, external: false, arrow: '→' },
  { label: 'LinkedIn', text: 'in/yaoting-wang', href: CONTACT.linkedin, external: true, arrow: '↗' },
  { label: 'GitHub', text: 'github.com/JoKFA', href: CONTACT.github, external: true, arrow: '↗' },
  { label: 'Résumé', text: 'PDF', href: CONTACT.resume, external: true, arrow: '↗' },
]

const el = <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e
}

export interface IndexDom {
  /** the sheet: the last section of the reel */
  sec: HTMLElement
  /** the Contact block (the top bar's Contact scrolls to it) */
  contact: HTMLElement
  /** every row, in order (a button each, the whole row) */
  rows: HTMLButtonElement[]
}

/**
 * Build the sheet into `main` as its section number `n`. Headings run in order: the page's h1 is the bar's name, each stop is an h2, then this sheet's h2 (Index)
 * with an h3 per group, and an h2 for Contact.
 */
export function buildIndex(main: HTMLElement, n: number): IndexDom {
  const sec = el(main, 'section', 'ph-sec ph-index'); sec.id = `ph-s${n}`
  const h = el(sec, 'h2', 'ph-h', 'Index'); h.id = `ph-t${n}`; sec.setAttribute('aria-labelledby', h.id)
  const rows: HTMLButtonElement[] = []
  for (const g of indexGroups()) {
    const gs = el(sec, 'div', 'ph-ixg')
    const gh = el(gs, 'h3', 'ph-lbl ph-ixh', g.name)
    const ul = el(gs, 'ul', 'ph-ixl'); ul.setAttribute('aria-label', g.name); void gh
    for (const r of g.rows) {
      const b = el(el(ul, 'li', ''), 'button', 'ph-ix'); b.type = 'button'; b.dataset.id = r.id
      el(b, 'span', 'n', r.id); const t = el(b, 'span', 't', r.title); el(t, 'span', 's', r.small)
      rows.push(b)
    }
  }
  // Contact: the profile's facts, then the four links (the address is plain text, so that a long press selects it)
  const contact = el(sec, 'section', 'ph-contact'); contact.id = 'ph-contact'
  const ch = el(contact, 'h2', 'ph-h', 'Contact'); ch.id = 'ph-contact-h'; contact.setAttribute('aria-labelledby', ch.id)
  const dl = el(contact, 'dl', 'ph-dl')
  for (const [k, v] of contactFacts()) { el(dl, 'dt', 'ph-lbl', k); el(dl, 'dd', '', v) }
  const ul = el(contact, 'ul', 'ph-ctl')
  for (const l of contactLinks()) {
    const li = el(ul, 'li', 'ph-ct')
    const a = el(li, 'a', 'ph-cta'); a.href = l.href
    if (l.external) { a.target = '_blank'; a.rel = l.label === 'Résumé' ? 'noopener' : 'noopener noreferrer' }
    el(a, 'span', 'n', l.label)
    if (l.label === 'Email') el(li, 'span', 'ph-mail', l.text)   // (plain text, under the link: long-press selects it)
    else el(a, 'span', 't', l.text)
    el(a, 'span', 'ar', l.arrow).setAttribute('aria-hidden', 'true')
  }
  return { sec, contact, rows }
}
