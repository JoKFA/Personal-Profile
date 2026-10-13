// The content of a file page, as the desktop and the phone both read it: the heading block, then the
// kicker, era, credentials, summary, facts, the tabs (or the same bodies stacked into one long page),
// the link and the related files. Props only: it knows nothing of the archive, the scene or the clock.
// What belongs to one shell (the interior's words on the subject file, the shred banner, the cipher)
// is passed in or wrapped around it. Class names and `data-redact` marks are the desktop cipher's and
// the stylesheet's hooks: they stay exactly as they are.
import { useState, type MouseEvent, type ReactNode } from 'react'
import { entryById } from '../../data/entries'
import { DRAWERS } from '../../data/roles'
import { HEADLINE } from '../../data/story'
import type { Entry } from '../../data/types'
import { tabsFor } from './tabs'

/** Facts carry what the numbers do not: a fact that repeats one of the file's numbers is left out. */
const factsOf = (e: Entry) => e.facts.filter(([, v]) => !e.numbers?.some(([n]) => v.includes(n)))

/** The line above the title, the title, and (where the shell checks the page's seal) the line that says what was checked. */
export function FileHead({ entry: e, heading, verify = false }: { entry: Entry; heading: string; verify?: boolean }) {
  const drawer = DRAWERS[e.slot.lane]
  return (
    <>
      <div className="file-eyebrow lbl"><span>File {e.id} · Drawer {String(e.slot.lane + 1).padStart(2, '0')} · {drawer.name}</span></div>
      <h1>{heading}</h1>
      {verify && <div className="file-verify lbl" aria-live="polite"><i /><span /></div>}
    </>
  )
}

export interface FileBodyProps {
  entry: Entry
  /** a related file, a chapter step, a piece of evidence: go to that entry */
  onJump: (id: string) => void
  /** `tabs`: one body at a time under a tab strip. `stacked`: every body in turn, one long page. */
  layout: 'tabs' | 'stacked'
  /** the visitor's own file (V-FILE) reads the session: their number, the risk, the access log */
  session: { visitor: string; risk: number; audit: [string, string][] }
  /** tabs layout, controlled: the open tab (default: the first, kept here) and what a click on a tab does */
  tab?: number
  onTab?: (index: number, ev: MouseEvent<HTMLButtonElement>) => void
  /** the subject file's interior words: between the credentials and the summary / after the last link */
  exhibit?: ReactNode
  exhibitIndex?: ReactNode
}

export function FileBody({ entry: e, onJump, layout, session, tab: tabIn, onTab, exhibit, exhibitIndex }: FileBodyProps) {
  const [own, setOwn] = useState(0)
  const tab = tabIn ?? own
  const tabs = tabsFor(e, session.visitor, session.audit, onJump, session.risk)
  const facts = factsOf(e)
  return (
    <>
      <div className="file-kicker" data-redact>{e.kind === 'service' ? `${e.title} · ${e.dates} · ${e.place}` : e.kind === 'education' ? `${e.org} · ${e.dates} · ${e.place}` : e.kicker}</div>
      {e.era && <div className="file-era lbl" data-redact>{e.era}</div>}
      {e.kind === 'subject' && (
        <ul className="file-creds" aria-label="Certifications">
          {([['Cisco', 'CCNA'], ['CompTIA', 'Security+']] as const).map(([org, name]) => (
            <li key={name}>
              <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" /><path d="M10.5 18.5l5 5 10-11" /><circle className="dot" cx="31" cy="7" r="2.2" /></svg>
              <span><b data-redact>{name}</b><span className="lbl" data-redact>{org} · certified</span></span>
            </li>
          ))}
        </ul>
      )}
      {exhibit}
      <p className="file-sum" data-redact>{e.kind === 'subject' ? HEADLINE : e.summary}</p>
      {facts.length > 0 && (
        <dl className="file-facts">{facts.map(([k, v]) => <div key={k}><dt className="lbl">{k}</dt><dd data-redact>{v}</dd></div>)}</dl>
      )}
      {layout === 'tabs' ? (
        <>
          <div className="file-tabs" role="tablist">
            {tabs.map((t, i) => <button key={t.id} role="tab" aria-selected={tab === i} onClick={(ev) => { if (onTab) onTab(i, ev); else setOwn(i) }}><small>{String(i + 1).padStart(2, '0')}</small>{t.label}</button>)}
          </div>
          <div className="file-tab" role="tabpanel" key={tab}>{tabs[tab].body}</div>
        </>
      ) : (
        <div className="file-stack">
          {tabs.map((t, i) => (
            <section key={t.id} className="file-tab file-tab--stacked" data-tab={t.id}>
              <h2 className="file-tab-h lbl"><small>{String(i + 1).padStart(2, '0')}</small>{t.label}</h2>
              {t.body}
            </section>
          ))}
        </div>
      )}
      <div className="file-act">
        {e.link && <a className="file-cta" href={e.link.href} target={e.link.href.startsWith('http') ? '_blank' : undefined} rel="noopener"><span>{e.link.label}</span><span aria-hidden="true">↗</span></a>}
        {e.related?.map((id) => { const r = entryById.get(id)!; return <button key={id} className="file-rel" onClick={() => onJump(id)}><span className="lbl">{r.id}</span>{r.kind === 'service' ? r.org : r.title}</button> })}
      </div>
      {exhibitIndex}
    </>
  )
}
