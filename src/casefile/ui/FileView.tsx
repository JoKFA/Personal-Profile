// An opened drive (spec D6). As in the reference, the drive itself is the exhibit: it turns to the
// reader and the project's demo is projected onto its face; the right column holds the file.
// The page arrives as its own ciphertext and is decrypted block by block (ui/cipher.ts); closing encrypts it again.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CAPABILITIES } from '../data/capabilities'
import { CERTIFICATIONS, CONTACT, ENTRIES, entryById, shortName } from '../data/entries'
import { EDUCATION_ENTRIES } from '../data/education'
import { CHAPTERS, HEADLINE, KEY_NUMBERS, PRINCIPLES, SELECTED, type Chapter } from '../data/story'
import { DRAWERS, roleById } from '../data/roles'
import { KIND_NAME, type Entry } from '../data/types'
import { Demo } from './demos'
import { useCtx, useSnapshot } from './context'
import { wipe, WIPE_PASSES } from './effects'
import '../styles/subject.css'
import { quadMatrix } from './project'
import { SpaceExhibit } from './SpaceExhibit'
import { PrivacyStat } from './PrivacyStat'
import gsap from 'gsap'
import { checkText, cipherFace, cipherText, type FaceRun, type TextRun } from './cipher'

const STAGE = { w: 640, h: 452 }
const HAS_FILE = new Set(['case', 'service', 'education'])
/** The file to read next: the next selected file; from any other file, the next one in its drawer. */
function nextFile(e: Entry): Entry | null {
  const sel = SELECTED.findIndex((x) => x.id === e.id)
  if (sel >= 0) return entryById.get(SELECTED[(sel + 1) % SELECTED.length].id) ?? null
  const list = ENTRIES.filter((x) => x.slot.lane === e.slot.lane && HAS_FILE.has(x.kind)).sort((a, b) => a.slot.row - b.slot.row)
  const i = list.findIndex((x) => x.id === e.id)
  return list.length > 1 && i >= 0 ? list[(i + 1) % list.length] : null
}
/** Facts carry what the numbers do not: a fact that repeats one of the file's numbers is left out. */
const factsOf = (e: Entry) => e.facts.filter(([, v]) => !e.numbers?.some(([n]) => v.includes(n)))
type Tab = { id: string; label: string; body: ReactNode }

/** what the cipher covers: the column's text, and the drive's face (not on a phone, where the face stays still) */
function sealParts(r: HTMLElement) {
  const phone = innerWidth < 900 || matchMedia('(pointer: coarse)').matches
  return { stage: phone ? null : r.querySelector<HTMLElement>('.file-stage'), targets: [...r.querySelectorAll<HTMLElement>('.file-meta [data-redact], .file-meta h1, .file-no .n')].filter((t) => !t.closest('.file-stage')) }
}

export function FileView({ entry: e }: { entry: Entry }) {
  const { archive, visitor, reduced, close, auditLog: audit, exitRef, cut } = useCtx()
  const snap = useSnapshot()
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState(0)
  const [shredStep, setShredStep] = useState<null | number>(null)
  const narrow = typeof innerWidth !== 'undefined' && innerWidth < 900
  const heading = e.kind === 'service' ? e.org! : archive.isLocked(e) ? 'X-000 · Restricted' : e.title
  const goTo = (id: string) => { const r = entryById.get(id); void close({ to: r && r.kind !== 'subject' && r.kind !== 'visitor' ? `/projects/${r.slug}` : '/' }) }
  const tabs = tabsFor(e, visitor.id, audit, goTo, snap.risk)
  const next = e.kind === 'visitor' || e.kind === 'subject' ? null : nextFile(e)

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
      const f = [...r.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]')].filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null && !x.closest('[inert]') && getComputedStyle(x).visibility !== 'hidden')
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === r)) { ev.preventDefault(); last.focus() }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus() }
      else if (!r.contains(document.activeElement)) { ev.preventDefault(); first.focus() }
    }
    addEventListener('keydown', trap)
    return () => { removeEventListener('keydown', trap); before?.focus?.({ preventScroll: true }) }
  }, [])

  // The page is its own ciphertext on arrival, and again on the way out. Everything here is stopped
  // by `restore()`, synchronously, before React unmounts or re-renders what the cipher covers.
  type Parts = [TextRun, FaceRun | null]
  /** the closing seal, prepared while the file is read (a fresh IV, its bits drawn) so Esc starts it at once */
  const seal = useRef<Promise<Parts> | null>(null)
  /** the arrival (decrypting now) and a tab's own decryption: the exit stops whichever is still running */
  const arrival = useRef<{ stop(): void } | null>(null), tabRun = useRef<{ stop(): void } | null>(null)
  /** the exit has begun: nothing more is prepared, and the run it used is put back when the page goes */
  const closing = useRef<Parts | null | false>(null), idle = useRef(() => {})
  const prepareSeal = useCallback(() => {
    const r = root.current!, { stage, targets } = sealParts(r)
    return (seal.current = Promise.all([cipherText(targets, 'plain'), stage ? cipherFace(stage, `${e.id} ${e.title} ${e.summary}`, 8, 5, 'plain') : Promise.resolve(null)]))
  }, [e])
  const dropSeal = useCallback(() => { const p = seal.current; seal.current = null; void p?.then(([c, f]) => { c.restore(); f?.remove() }) }, [])
  /** when nothing is moving, prepare the closing seal in an idle moment */
  const prepareWhenIdle = useCallback(() => {
    idle.current()
    const h = requestIdleCallback(() => { if (root.current && closing.current === null && !arrival.current && !tabRun.current && !seal.current) void prepareSeal() }, { timeout: 1500 })
    idle.current = () => cancelIdleCallback(h)
  }, [prepareSeal])
  useEffect(() => {
    // a new window size changes every line break, so the prepared seal no longer fits: drop it and prepare another
    let again = 0
    const resized = () => { dropSeal(); clearTimeout(again); again = window.setTimeout(prepareWhenIdle, 250) }
    addEventListener('resize', resized)
    return () => {
      removeEventListener('resize', resized); clearTimeout(again); idle.current(); dropSeal()
      const spent = closing.current; if (spent) { spent[0].restore(); spent[1]?.remove() }
    }
  }, [dropSeal, prepareWhenIdle])

  useLayoutEffect(() => {
    const r = root.current!
    r.focus({ preventScroll: true })
    // the line under the title says what was checked; the result is the real one
    const tag = (ok: boolean, blocks: number) => {
      r.dataset.tag = ok ? 'ok' : 'bad'
      const v = r.querySelector('.file-verify span'); if (v) v.textContent = ok ? `AES-256-GCM · ${blocks} blocks · tag verified` : 'AES-256-GCM · tag check failed'
    }
    let dead = false
    if (reduced) {
      // no motion: the text is plain at once, and the check still runs
      void checkText(sealParts(r).targets).then(({ blocks, ok }) => { if (!dead) tag(ok, blocks) })
      const raf = requestAnimationFrame(() => { archive.setSweep(1); archive.fileShown() })
      return () => { dead = true; cancelAnimationFrame(raf) }
    }
    // The key leaves the drive's secure element, the face decrypts block by block in counter order, then
    // the column, 16 characters to a block; the GCM tag is checked at the end.
    let text: TextRun | null = null, face: FaceRun | null = null, sweep: gsap.core.Tween | null = null
    const stopped = () => { sweep?.kill(); text?.restore(); face?.remove(); text = face = null }
    arrival.current = { stop() { dead = true; stopped() } }
    r.classList.add('sealed')
    void (async () => {
      const { stage, targets } = sealParts(r)
      const [t, f] = await Promise.all([cipherText(targets), stage ? cipherFace(stage, `${e.id} ${e.title} ${e.summary}`) : Promise.resolve(null)])
      if (dead) { t.restore(); f?.remove(); return }
      text = t; face = f
      r.classList.remove('sealed')
      const st = { k: 0 }
      sweep = gsap.to(st, { k: 1, duration: 0.95, ease: 'power1.inOut', onUpdate: () => archive.setSweep(st.k) })
      const faceDone = f ? f.decrypt(420) : Promise.resolve()
      await new Promise((res) => setTimeout(res, 110))
      if (dead) return
      const ok = await t.decrypt(560)
      await faceDone
      if (dead || ok === null) return
      t.restore(); text = null
      tag(ok, t.blocks)
      archive.setSweep(1); archive.fileShown()
      arrival.current = null
      prepareWhenIdle()
    })()
    return () => { dead = true; arrival.current = null; stopped() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // a tab opens the same way (the first one arrived with the page); what was prepared belonged to the tab before it
  useLayoutEffect(() => {
    dropSeal()
    const r = root.current
    if (!r || !tab || reduced) return
    const targets = [...r.querySelectorAll<HTMLElement>('.file-tab [data-redact]')]
    let dead = false, run: TextRun | null = null
    r.classList.add('sealed-tab')
    tabRun.current = { stop() { dead = true; run?.restore(); r.classList.remove('sealed-tab') } }
    void cipherText(targets).then(async (c) => {
      run = c
      if (dead) { c.restore(); return }
      r.classList.remove('sealed-tab')
      await c.decrypt(360)
      c.restore(); run = null; tabRun.current = null
      prepareWhenIdle()
    })
    return () => { dead = true; run?.restore(); tabRun.current = null; r.classList.remove('sealed-tab') }
  }, [tab, reduced, dropSeal, prepareWhenIdle])

  // close: the page is encrypted again, last block first, and the drive holds still, facing the reader, until it is
  useEffect(() => {
    exitRef.current = async (onSealed?: () => void) => {
      const r = root.current; if (!r) return
      closing.current = false; idle.current()
      if (reduced) { onSealed?.(); r.classList.add('leaving'); return }
      // an arrival or a tab still decrypting is stopped where it stands (its text put back); the seal is made fresh
      if (arrival.current || tabRun.current) { arrival.current?.stop(); tabRun.current?.stop(); arrival.current = tabRun.current = null; dropSeal() }
      const made = await (seal.current ?? prepareSeal())
      seal.current = null; closing.current = made
      const [c, face] = made
      r.dataset.tag = ''
      // the drive starts to turn back when the seal is 70% done (the next beat overlaps the last third)
      const turn = setTimeout(() => onSealed?.(), 180)
      await Promise.all([c.encrypt(260), face ? face.encrypt(230) : Promise.resolve()])
      clearTimeout(turn); onSealed?.()
      r.classList.add('leaving')
      // the page is taken away only once its fade (220 ms) has finished
      await new Promise((res) => setTimeout(res, 250))
    }
    return () => { exitRef.current = null }
  }, [exitRef, reduced, prepareSeal, dropSeal])

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
        {/* the way on is the next file; shredding is the visitor's own file's business (V-FILE) */}
        {e.kind === 'visitor' ? <button className="file-shred" onClick={() => void shred()}><span className="wide">Crypto-</span>shred your file ✕</button>
          : next && <button className="file-next" onClick={() => goTo(next.id)}><span className="lbl">Next file</span><span className="t">{next.kind === 'service' ? next.org : next.title}</span><span aria-hidden="true">→</span></button>}
      </header>

      {e.demo && (
        <div className="file-stage-wrap">
          <div ref={stage} className="file-stage" style={{ width: STAGE.w, height: STAGE.h }}>
            <Demo kind={e.demo} entry={e} jump={goTo} />
          </div>
        </div>
      )}
      {/* everything shown on the drive is public, and marked the way the field marks shareable material */}
      {e.demoNote && <div className="file-demonote lbl"><span className="tlp" title="Traffic Light Protocol: may be shared publicly">TLP:CLEAR</span><span>{e.demoNote[0]}</span><span>{e.demoNote[1]}</span></div>}

      {e.kind !== 'subject' && <div className="file-no"><div className="n">{e.id}</div><div className="lbl">{KIND_NAME[e.kind]}{e.year ? ` · ${e.year}` : ''}</div></div>}

      <article className="file-meta">
        {shredStep !== null && (
          <div className={`shred-banner ${shredStep === 3 ? 'zero' : ''}`} role="status" data-keep>
            <div className="sb-h lbl"><span>Crypto-shred · {e.id}</span><span>DoD 5220.22-M · 3 passes</span></div>
            <div className="sb-bars" aria-hidden="true">{WIPE_PASSES.map((_, i) => <i key={i} className={shredStep > i ? 'done' : shredStep === i ? 'on' : ''} />)}</div>
            <div className="sb-t">{shredStep < 0 ? 'Preparing overwrite' : shredStep < 3 ? `Pass ${shredStep + 1} of 3 — ${WIPE_PASSES[shredStep]}` : 'Key zeroized — file unrecoverable'}</div>
            {shredStep === 3 && <code className="sb-key">key 0x{'00'.repeat(16)}</code>}
          </div>
        )}
        <div className="file-eyebrow lbl"><span>File {e.id} · Drawer {String(e.slot.lane + 1).padStart(2, '0')} · {drawer.name}</span></div>
        <h1>{heading}</h1>
        <div className="file-verify lbl" aria-live="polite"><i /><span /></div>
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
        {e.kind === 'subject' && cut && <SpaceExhibit jump={goTo} />}
        <p className="file-sum" data-redact>{e.kind === 'subject' ? HEADLINE : e.summary}</p>
        {factsOf(e).length > 0 && (
          <dl className="file-facts">{factsOf(e).map(([k, v]) => <div key={k}><dt className="lbl">{k}</dt><dd data-redact>{v}</dd></div>)}</dl>
        )}
        <div className="file-tabs" role="tablist">
          {tabs.map((t, i) => <button key={t.id} role="tab" aria-selected={tab === i} onClick={(ev) => { setTab(i); if (narrow) ev.currentTarget.parentElement?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }) }}><small>{String(i + 1).padStart(2, '0')}</small>{t.label}</button>)}
        </div>
        <div className="file-tab" role="tabpanel" key={tab}>{tabs[tab].body}</div>
        <div className="file-act">
          {e.link && <a className="file-cta" href={e.link.href} target={e.link.href.startsWith('http') ? '_blank' : undefined} rel="noopener"><span>{e.link.label}</span><span aria-hidden="true">↗</span></a>}
          {e.related?.map((id) => { const r = entryById.get(id)!; return <button key={id} className="file-rel" onClick={() => goTo(id)}><span className="lbl">{r.id}</span>{r.kind === 'service' ? r.org : r.title}</button> })}
        </div>
        {e.kind === 'subject' && cut && <SpaceExhibit jump={goTo} part="index" />}
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
/** What this site does with the visitor, each line checkable. */
function Session({ visitor, risk }: { visitor: string; risk: number }) {
  return (
    <dl className="session">
      <div><dt className="lbl">Your number</dt><dd><b data-redact>{visitor}</b><span data-redact>A hash of what your browser told this page. Every file you open is watermarked with it; it never leaves your browser.</span></dd></div>
      <div><dt className="lbl">Behaviour analytics</dt><dd><b data-redact>Risk {String(risk).padStart(2, '0')}</b><span data-redact>How suspicious this session looks (UEBA). Denied drives and rapid scanning raise it; it cools down on its own.</span></dd></div>
      <div><dt className="lbl">Third parties</dt><dd><PrivacyStat /><span data-redact>Counted live in this page.</span></dd></div>
      <div><dt className="lbl">Your file</dt><dd><span data-redact>Crypto-shred it (top right): three overwrite passes, then the key is zeroized. You can restore it from the archive.</span></dd></div>
    </dl>
  )
}
function Log({ id, visitor, audit }: { id: string; visitor: string; audit: [string, string][] }) {
  // chain of custody: each entry commits to the previous one (FNV-1a, display only)
  const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
  const rows: [string, string][] = [...audit.slice(-6), [new Date().toLocaleTimeString('en-GB'), `${visitor} reading ${id}`]]
  let prev = '00000000'
  return <div className="log"><div className="lbl">Chain of custody · each entry commits to the last</div>{rows.map(([t, s], i) => { const h = fnv(prev + t + s), line = <div key={i} className="log-row"><span>{t}</span><span data-redact>{s}</span><span className="h">{h} ← {prev}</span></div>; prev = h; return line })}</div>
}

function tabsFor(e: Entry, visitor: string, audit: [string, string][], jump: (id: string) => void, risk: number): Tab[] {
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
