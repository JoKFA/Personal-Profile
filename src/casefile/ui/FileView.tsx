// An opened drive (spec D6). As in the reference, the drive itself is the exhibit: it turns to the
// reader and the project's demo is projected onto its face; the right column holds the file.
// Text arrives under ink bars that retract line by line (Rhine-style document decryption).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CAPABILITIES } from '../data/capabilities'
import { CERTIFICATIONS, CONTACT, entryById, shortName } from '../data/entries'
import { EDUCATION_ENTRIES } from '../data/education'
import { CHAPTERS, HEADLINE, KEY_NUMBERS, PRINCIPLES, type Chapter } from '../data/story'
import { DRAWERS, roleById } from '../data/roles'
import type { Entry } from '../data/types'
import { Demo } from './demos'
import { useCtx, useSnapshot } from './context'
import { redact, scramble, wipe, WIPE_PASSES } from './effects'
import '../styles/subject.css'
import { quadMatrix } from './project'

const STAGE = { w: 640, h: 452 }
type Tab = { id: string; label: string; body: ReactNode }

export function FileView({ entry: e }: { entry: Entry }) {
  const { archive, visitor, reduced, close, auditLog: audit, exitRef } = useCtx()
  const snap = useSnapshot()
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), title = useRef<HTMLHeadingElement>(null)
  const [tab, setTab] = useState(0)
  const [shredStep, setShredStep] = useState<null | number>(null)
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 900
  const heading = e.kind === 'service' ? e.org! : archive.isLocked(e) ? 'X-000 · Restricted' : e.title
  const goTo = (id: string) => { const r = entryById.get(id); void close({ to: r && r.kind !== 'subject' && r.kind !== 'visitor' ? `/projects/${r.slug}` : '/' }) }
  const tabs = tabsFor(e, visitor.id, audit, goTo)

  // project the demo onto the drive's face every frame (desktop)
  useEffect(() => {
    if (narrow) return
    let raf = 0
    const f = () => { raf = requestAnimationFrame(f); if (stage.current) stage.current.style.transform = quadMatrix(STAGE.w, STAGE.h, archive.faceQuad(0.34)) }
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf)
  }, [archive, narrow])

  // modal: Tab stays inside the file; focus returns where it was when the file closes
  useEffect(() => {
    const r = root.current!, before = document.activeElement as HTMLElement | null
    const trap = (ev: KeyboardEvent) => {
      if (ev.key !== 'Tab') return
      const f = [...r.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === r)) { ev.preventDefault(); last.focus() }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus() }
      else if (!r.contains(document.activeElement)) { ev.preventDefault(); first.focus() }
    }
    addEventListener('keydown', trap)
    return () => { removeEventListener('keydown', trap); before?.focus?.({ preventScroll: true }) }
  }, [])

  // decrypt the text on arrival
  useLayoutEffect(() => {
    const r = root.current!; const cover = redact(r)
    const stop = scramble(title.current, heading, reduced)
    requestAnimationFrame(() => { void cover.reveal(reduced).then(() => archive.fileShown()) })
    r.focus({ preventScroll: true })
    return () => { cover.dispose(); stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (tab && root.current) { const c = redact(root.current, '.file-tab [data-redact]'); void c.reveal(reduced, 0.4) } }, [tab, reduced])

  // close: every line is covered again, the demo withdraws into the drive
  useEffect(() => {
    exitRef.current = async () => {
      const r = root.current; if (!r) return
      const c = redact(r, '.file-meta [data-redact], .file-meta h1')
      await c.conceal(reduced, 0.16)
      r.classList.add('leaving')
      await new Promise((res) => setTimeout(res, reduced ? 0 : 230))
    }
    return () => { exitRef.current = null }
  }, [exitRef, reduced])

  // crypto-shred: three passes run down the file while the drive's light flashes red and dies;
  // the key is zeroized; the page collapses to a line; then the drive goes home
  const shred = async () => {
    if (shredStep !== null) return
    setShredStep(-1)
    const meta = root.current!.querySelector<HTMLElement>('.file-meta')!
    meta.scrollTop = 0
    await wipe(meta, reduced, setShredStep, (pass) => archive.shredPass(pass))
    root.current!.classList.add('collapse')
    await new Promise((res) => setTimeout(res, reduced ? 0 : 650))
    void close({ shred: true })
  }
  const drawer = DRAWERS[e.slot.lane]
  void snap

  return (
    <div ref={root} className={`file file--${e.kind} ${shredStep !== null ? 'wiping' : ''}`} role="dialog" aria-modal="true" aria-label={e.title} tabIndex={-1}>
      <header className="file-bar">
        <button className="file-back" onClick={() => void close()}><span aria-hidden="true">←</span> All files <kbd>ESC</kbd></button>
        <span className="lbl file-wm">File <b>{e.id}</b> · watermarked to <b>{visitor.id}</b></span>
        <button className="file-shred" onClick={() => void shred()}><span className="wide">Crypto-</span>shred ✕</button>
      </header>

      {e.demo && (
        <div className="file-stage-wrap">
          <div ref={stage} className="file-stage" style={{ width: STAGE.w, height: STAGE.h }}>
            <Demo kind={e.demo} entry={e} jump={goTo} />
          </div>
        </div>
      )}
      {e.demoNote && <div className="file-demonote lbl"><span>{e.demoNote[0]}</span><span>{e.demoNote[1]}</span></div>}

      <div className="file-no"><div className="n">{e.id}</div><div className="lbl">{({ service: 'Service record', education: 'Education', subject: 'Subject file', restricted: 'Restricted', visitor: 'Visitor file', case: 'Case file', skill: 'Skill', credential: 'Credential' } as const)[e.kind]}{e.year ? ` · ${e.year}` : ''}</div></div>

      <article className="file-meta">
        {shredStep !== null && (
          <div className={`shred-banner ${shredStep === 3 ? 'zero' : ''}`} role="status" data-keep>
            <div className="sb-h lbl"><span>Crypto-shred · {e.id}</span><span>DoD 5220.22-M · 3 passes</span></div>
            <div className="sb-bars" aria-hidden="true">{WIPE_PASSES.map((_, i) => <i key={i} className={shredStep > i ? 'done' : shredStep === i ? 'on' : ''} />)}</div>
            <div className="sb-t">{shredStep < 0 ? 'Preparing overwrite' : shredStep < 3 ? `Pass ${shredStep + 1} of 3 — ${WIPE_PASSES[shredStep]}` : 'Key zeroized — file unrecoverable'}</div>
            {shredStep === 3 && <code className="sb-key">key 0x{'00'.repeat(16)}</code>}
          </div>
        )}
        <div className="file-eyebrow lbl"><span>File {e.id} · Drawer {String(e.slot.lane + 1).padStart(2, '0')} · {drawer.name}</span><span className="ok">✓ integrity verified</span></div>
        <h1 ref={title}>{heading}</h1>
        <div className="file-kicker" data-redact>{e.kind === 'service' ? `${e.title} · ${e.dates} · ${e.place}` : e.kind === 'education' ? `${e.org} · ${e.dates} · ${e.place}` : e.kicker}</div>
        {e.era && <div className="file-era lbl" data-redact>{e.era}</div>}
        <p className="file-sum" data-redact>{e.kind === 'subject' ? HEADLINE : e.summary}</p>
        {e.facts.length > 0 && (
          <dl className="file-facts">{e.facts.map(([k, v]) => <div key={k}><dt className="lbl">{k}</dt><dd data-redact>{v}</dd></div>)}</dl>
        )}
        <div className="file-tabs" role="tablist">
          {tabs.map((t, i) => <button key={t.id} role="tab" aria-selected={tab === i} onClick={(ev) => { setTab(i); if (narrow) ev.currentTarget.parentElement?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }) }}><small>{String(i + 1).padStart(2, '0')}</small>{t.label}</button>)}
        </div>
        <div className="file-tab" role="tabpanel" key={tab}>{tabs[tab].body}</div>
        <div className="file-act">
          {e.link && <a className="file-cta" href={e.link.href} target={e.link.href.startsWith('http') ? '_blank' : undefined} rel="noopener"><span>{e.link.label}</span><span aria-hidden="true">↗</span></a>}
          {e.related?.map((id) => { const r = entryById.get(id)!; return <button key={id} className="file-rel" onClick={() => goTo(id)}><span className="lbl">{r.id}</span>{r.kind === 'service' ? r.org : r.title}</button> })}
        </div>
      </article>

    </div>
  )
}

function Numbers({ list }: { list: [string, string][] }) {
  return <div className="nums">{list.map(([n, l]) => <div key={l}><b data-redact>{n}</b><span className="lbl">{l}</span></div>)}</div>
}
function Sections({ e }: { e: Entry }) {
  return <>{e.sections?.map((s) => (
    <section key={s.title} className="chap">
      <div className="lbl chap-e">{s.eyebrow}</div>
      <h3 data-redact>{s.title}</h3>
      <p data-redact>{s.body}</p>
      {s.points && <ul>{s.points.map((p) => <li key={p} data-redact>{p}</li>)}</ul>}
      {s.note && <p className="chap-note" data-redact>{s.note}</p>}
    </section>
  ))}</>
}
function Log({ id, visitor, audit }: { id: string; visitor: string; audit: [string, string][] }) {
  // chain of custody: each entry commits to the previous one (FNV-1a, display only)
  const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
  const rows: [string, string][] = [...audit.slice(-6), [new Date().toLocaleTimeString('en-GB'), `${visitor} reading ${id}`]]
  let prev = '00000000'
  return <div className="log"><div className="lbl">Chain of custody · each entry commits to the last</div>{rows.map(([t, s], i) => { const h = fnv(prev + t + s), line = <div key={i} className="log-row"><span>{t}</span><span data-redact>{s}</span><span className="h">{h} ← {prev}</span></div>; prev = h; return line })}</div>
}

function tabsFor(e: Entry, visitor: string, audit: [string, string][], jump: (id: string) => void): Tab[] {
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
    </nav> },
  ]
  if (e.kind === 'service') return [
    { id: 'ov', label: 'What I did', body: <>{e.numbers && <Numbers list={e.numbers} />}<Sections e={e} /></> },
    { id: 'skills', label: 'Skills', body: <div className="stack">{e.stack?.map((s) => <span key={s}>{s}</span>)}</div> },
    log,
  ]
  if (e.kind === 'education') return [
    { id: 'trains', label: 'What it trains', body: <Sections e={e} /> },
    { id: 'courses', label: 'Courses', body: <div className="courses">{e.courses?.map((c) => (
      <div key={c.code + c.title} className="course"><span className="lbl">{c.code}</span><b data-redact>{c.title}</b>
        <span className="course-out"><span data-redact>{c.out}</span>{(c.ids?.length || c.href) && <span className="course-links">{c.ids?.map((id) => <button key={id} onClick={() => jump(id)}><em>{shortName(id)}</em></button>)}{c.href && <a href={c.href} target="_blank" rel="noopener noreferrer"><em>Source · GitHub ↗</em></a>}</span>}</span></div>
    ))}</div> },
    log,
  ]
  if (e.kind === 'visitor') return [log]
  const out: Tab[] = [{ id: 'ov', label: 'Overview', body: <>{e.numbers && <Numbers list={e.numbers} />}{e.stack && <div className="stack">{e.stack.map((s) => <span key={s}>{s}</span>)}</div>}</> }]
  if (e.sections?.length) out.push({ id: 'how', label: e.kind === 'restricted' ? 'Postmortem' : 'How it works', body: <Sections e={e} /> })
  if (e.findings?.length) out.push({ id: 'ev', label: 'Evidence', body: <div className="fnd">{e.findings.map((f) => <div key={f.title} className={`f f-${f.severity}`}><span className="lbl">{f.severity} · {f.label}</span><h4 data-redact>{f.title}</h4><p data-redact>{f.detail}</p></div>)}</div> })
  out.push(log)
  return out
}

/** A chapter: the key steps, the rest one click away. Each step names its file in words. */
function ChapterView({ c, jump }: { c: Chapter; jump: (id: string) => void }) {
  const [all, setAll] = useState(false)
  const key = c.steps.filter((st) => st.key), rest = c.steps.filter((st) => !st.key)
  const shown = all ? [...key, ...rest] : key
  return (
    <section className="chapter">
      <div className="chapter-h"><span className="lbl">{c.years}</span><h3 data-redact>{c.title}</h3></div>
      <p data-redact>{c.line}</p>
      <ol>{shown.map((st) => { const r = entryById.get(st.id); return (
        <li key={st.id}><button onClick={() => jump(st.id)} disabled={!r || r.kind === 'credential'}>
          <span className="st-meta lbl">{st.year}<em>{shortName(st.id)}</em></span><span data-redact>{st.what}</span>
        </button></li>
      ) })}</ol>
      {rest.length > 0 && <button className="chapter-more lbl" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? 'Show less' : `+ ${rest.length} more`}</button>}
    </section>
  )
}
