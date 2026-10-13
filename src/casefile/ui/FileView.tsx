// An opened drive (spec D6). As in the reference, the drive itself is the exhibit: it turns to the
// reader and the project's demo is projected onto its face; the right column holds the file.
// The page arrives as its own ciphertext and is decrypted block by block (ui/cipher.ts); closing encrypts it again.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ENTRIES, entryById } from '../data/entries'
import { SELECTED } from '../data/story'
import { KIND_NAME, type Entry } from '../data/types'
import { Demo } from './demos'
import { DesktopDemoCtx } from './demos/DesktopDemoCtx'
import { useCtx, useSnapshot } from './context'
import { wipe, WIPE_PASSES } from './effects'
import '../styles/subject.css'
import { quadMatrix } from './project'
import { SpaceExhibit } from './SpaceExhibit'
import { FileBody, FileHead } from './file/FileBody'
import gsap from 'gsap'
import { checkText, cipherFace, cipherText, type FaceRun, type TextRun } from './cipher'

const STAGE = { w: 640, h: 452 }
/** run `f` in an idle moment (a short timer where the browser has no requestIdleCallback, as Safari has not); returns the cancel */
const whenIdle = (f: () => void, timeout: number) => {
  if (typeof requestIdleCallback === 'function') { const h = requestIdleCallback(f, { timeout }); return () => cancelIdleCallback(h) }
  const h = setTimeout(f, 200); return () => clearTimeout(h)
}
const HAS_FILE = new Set(['case', 'service', 'education'])
/** The file to read next: the next selected file; from any other file, the next one in its drawer. */
function nextFile(e: Entry): Entry | null {
  const sel = SELECTED.findIndex((x) => x.id === e.id)
  if (sel >= 0) return entryById.get(SELECTED[(sel + 1) % SELECTED.length].id) ?? null
  const list = ENTRIES.filter((x) => x.slot.lane === e.slot.lane && HAS_FILE.has(x.kind)).sort((a, b) => a.slot.row - b.slot.row)
  const i = list.findIndex((x) => x.id === e.id)
  return list.length > 1 && i >= 0 ? list[(i + 1) % list.length] : null
}

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
  const dropSeal = useCallback(() => { const p = seal.current; seal.current = null; void p?.then(([c, f]) => { c.restore(); f?.remove() }, () => undefined) }, [])
  /** when nothing is moving, prepare the closing seal in an idle moment */
  const prepareWhenIdle = useCallback(() => {
    idle.current()
    idle.current = whenIdle(() => { if (root.current && closing.current === null && !arrival.current && !tabRun.current && !seal.current) void prepareSeal().catch(() => undefined) }, 1500)
  }, [prepareSeal])
  // The prepared seal stands the page's text in blocks while it is read. If React then changes some of that text
  // (the visitor file's risk, its log), it changes a node the blocks have taken: the seal is put back, and made again.
  useLayoutEffect(() => {
    if (seal.current && closing.current === null) { dropSeal(); prepareWhenIdle() }
  }, [snap.version, dropSeal, prepareWhenIdle])
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
    const tag = (ok: boolean, blocks: number, said?: string) => {
      r.dataset.tag = ok ? 'ok' : 'bad'
      const v = r.querySelector('.file-verify span'); if (v) v.textContent = said ?? (ok ? `AES-256-GCM · ${blocks} blocks · tag verified` : 'AES-256-GCM · tag check failed')
    }
    let dead = false
    if (reduced) {
      // no motion: the text is plain at once, and the check still runs
      void checkText(sealParts(r).targets).then(({ blocks, ok }) => { if (!dead) tag(ok, blocks) }, () => { if (!dead) tag(false, 0, 'AES-256-GCM · not available in this browser') })
      const raf = requestAnimationFrame(() => { archive.setSweep(1); archive.fileShown() })
      return () => { dead = true; cancelAnimationFrame(raf) }
    }
    // The key leaves the drive's secure element, the face decrypts block by block in counter order, then
    // the column, 16 characters to a block; the GCM tag is checked at the end.
    let text: TextRun | null = null, face: FaceRun | null = null, sweep: gsap.core.Tween | null = null
    const stopped = () => { sweep?.kill(); text?.restore(); face?.remove(); text = face = null }
    arrival.current = { stop() { dead = true; stopped() } }
    r.classList.add('sealed')
    // where the cipher cannot be made (no WebCrypto off a secure origin, no canvas): the page reads plain, and says so
    const failed = (err: unknown) => {
      if (dead) return
      console.warn('the page could not be encrypted; it is shown as it is', err)
      stopped(); r.classList.remove('sealed'); tag(false, 0, 'AES-256-GCM · not available in this browser')
      archive.setSweep(1); archive.fileShown(); arrival.current = null
    }
    // (a microtask later: a development double-run of this effect must not find the text already split)
    void Promise.resolve().then(async () => {
      if (dead) return
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
    }).catch(failed)
    return () => { dead = true; arrival.current = null; stopped() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // a tab opens the same way (the first one arrived with the page); what was prepared belonged to the tab before it
  useLayoutEffect(() => {
    dropSeal()
    const r = root.current
    if (!r || !tab || reduced) return
    let dead = false, run: TextRun | null = null
    r.classList.add('sealed-tab')
    tabRun.current = { stop() { dead = true; run?.restore(); r.classList.remove('sealed-tab') } }
    void Promise.resolve().then(async () => {
      if (dead) return
      const c = await cipherText([...r.querySelectorAll<HTMLElement>('.file-tab [data-redact]')])
      run = c
      if (dead) { c.restore(); return }
      r.classList.remove('sealed-tab')
      await c.decrypt(360)
      c.restore(); run = null; tabRun.current = null
      prepareWhenIdle()
    }).catch((err) => { if (dead) return; console.warn('the tab could not be encrypted; it is shown as it is', err); run?.restore(); run = null; tabRun.current = null; r.classList.remove('sealed-tab') })
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
            <DesktopDemoCtx><Demo kind={e.demo} entry={e} jump={goTo} /></DesktopDemoCtx>
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
        <FileHead entry={e} heading={heading} verify />
        <FileBody entry={e} layout="tabs" onJump={goTo} session={{ visitor: visitor.id, risk: snap.risk, audit }}
          tab={tab} onTab={(i, ev) => { setTab(i); if (narrow) ev.currentTarget.parentElement?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }) }}
          exhibit={e.kind === 'subject' && cut ? <SpaceExhibit jump={goTo} /> : null}
          exhibitIndex={e.kind === 'subject' && cut ? <SpaceExhibit jump={goTo} part="index" /> : null} />
      </article>

    </div>
  )
}
