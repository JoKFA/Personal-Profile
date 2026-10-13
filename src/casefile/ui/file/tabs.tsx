// What the tabs of a file say, as a list of {id, label, body} built from the entry's own data. The desktop file
// page and the phone's file page both read this list (FileBody), so the words cannot drift apart.
import type { ReactNode } from 'react'
import { CAPABILITIES } from '../../data/capabilities'
import { CERTIFICATIONS, CONTACT, entryById, shortName } from '../../data/entries'
import { EDUCATION_ENTRIES } from '../../data/education'
import { CHAPTERS, KEY_NUMBERS, PRINCIPLES } from '../../data/story'
import { roleById } from '../../data/roles'
import type { Entry } from '../../data/types'
import { ChapterView, Log, Numbers, Sections, Session } from './parts'

export type Tab = { id: string; label: string; body: ReactNode }

export function tabsFor(e: Entry, visitor: string, audit: [string, string][], jump: (id: string) => void, risk: number): Tab[] {
  const log: Tab = { id: 'log', label: 'Access log', body: <Log id={e.id} visitor={visitor} audit={audit} /> }
  if (e.kind === 'subject') return [
    { id: 'story', label: 'Story', body: <div className="story-tab">
      <div className="keynums">{KEY_NUMBERS.map(([n, l, why]) => <div key={l}><b data-redact>{n}</b><span className="lbl">{l}</span><p data-redact>{why}</p></div>)}</div>
      {CHAPTERS.map((c) => <ChapterView key={c.title} c={c} jump={jump} />)}
    </div> },

    { id: 'how', label: 'How I work', body: <div className="principles">{PRINCIPLES.map((pr) => (
      <section key={pr.title}><h3 data-redact>{pr.title}</h3><p data-redact>{pr.body}</p>
        <div className="proof">{pr.proof.map((id) => { const r = entryById.get(id)!; return <button key={id} onClick={() => jump(id)}><span className="lbl">{id}</span>{r.kind === 'service' ? r.org : r.title}</button> })}</div></section>
    ))}</div> },
    { id: 'fit', label: 'Where I fit', body: <div className="caps">{CAPABILITIES.map((c) => (
      <div key={c.role} className="cap"><div className="cap-h"><b data-redact>{roleById(c.role).name}</b><span className="lbl">{roleById(c.role).seats}</span></div>
        <p data-redact>{roleById(c.role).fit}</p>
        {c.skills.map(([sk, ev]) => <div key={sk} className="cap-row"><span data-redact>{sk}</span><span>{ev.map((id) => <button key={id} onClick={() => jump(id)} title={id}>{shortName(id)}</button>)}</span></div>)}
      </div>))}
      <div className="cap"><div className="cap-h"><b>Education & credentials</b></div>
        {EDUCATION_ENTRIES.map((ed) => <div key={ed.id} className="cap-row"><span data-redact>{ed.title} · {ed.org}</span><span><button onClick={() => jump(ed.id)} title={ed.id}>{ed.dates}</button></span></div>)}
        <p className="certs" data-redact>{CERTIFICATIONS.join(' · ')}</p></div>
    </div> },
    { id: 'contact', label: 'Contact', body: <nav className="chan">
      <a href={`mailto:${CONTACT.email}`}><span className="lbl">Email</span><span>{CONTACT.email}</span><span aria-hidden="true">→</span></a>
      <a href={CONTACT.linkedin} target="_blank" rel="noopener"><span className="lbl">LinkedIn</span><span>in/yaoting-wang</span><span aria-hidden="true">↗</span></a>
      <a href={CONTACT.github} target="_blank" rel="noopener"><span className="lbl">GitHub</span><span>github.com/JoKFA</span><span aria-hidden="true">↗</span></a>
      <a href={CONTACT.resume} target="_blank" rel="noopener"><span className="lbl">Résumé</span><span>PDF</span><span aria-hidden="true">↗</span></a>
    </nav> },
  ]
  if (e.kind === 'service') return [
    { id: 'ov', label: 'What I did', body: <>{e.numbers && <Numbers list={e.numbers} />}<Sections e={e} /></> },
    { id: 'skills', label: 'Skills', body: <div className="stack">{e.stack?.map((s) => <span key={s}>{s}</span>)}</div> },
  ]
  if (e.kind === 'education') return [
    { id: 'trains', label: 'What it trains', body: <Sections e={e} /> },
    { id: 'courses', label: 'Courses', body: <div className="courses">{e.courses?.map((c) => (
      <div key={c.code + c.title} className="course"><span className="lbl">{c.code}</span><b data-redact>{c.title}</b>
        <span className="course-out"><span data-redact>{c.out}</span>{(c.ids?.length || c.href) && <span className="course-links">{c.ids?.map((id) => <button key={id} onClick={() => jump(id)}><em>{shortName(id)}</em></button>)}{c.href && <a href={c.href} target="_blank" rel="noopener noreferrer"><em>Source · GitHub ↗</em></a>}</span>}</span></div>
    ))}</div> },
  ]
  // the visitor's own file: how this site treats them, in full; the access log lives only here
  if (e.kind === 'visitor') return [{ id: 'session', label: 'This session', body: <Session visitor={visitor} risk={risk} /> }, log]
  const out: Tab[] = [{ id: 'ov', label: 'Overview', body: <>{e.numbers && <Numbers list={e.numbers} />}{e.stack && <div className="stack">{e.stack.map((s) => <span key={s}>{s}</span>)}</div>}</> }]
  if (e.sections?.length) out.push({ id: 'how', label: e.kind === 'restricted' ? 'Postmortem' : 'How it works', body: <Sections e={e} /> })
  if (e.findings?.length) out.push({ id: 'ev', label: 'Evidence', body: <div className="fnd">{e.findings.map((f) => <div key={f.title} className={`f f-${f.severity}`}><span className="lbl">{f.severity} · {f.label}</span><h4 data-redact>{f.title}</h4><p data-redact>{f.detail}</p></div>)}</div> })
  return out
}
