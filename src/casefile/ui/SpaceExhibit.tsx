// The words over the subject file's interior (spec R8–R12, R14). The scene draws on the archive's
// canvas; this layer is HTML in the site's own grammar (hairlines, paper fog behind small text, no
// boxes): a reference line, one title, the four steps as hairlines, a few chips that hang from the
// model by a leader and say what is happening now, one result with a link to the real file, a
// six-way navigator with the controls, and the evidence index. Every frame it moves the chips to
// where the scene's anchors are, from the same clock as the scene, so a word is never early or late.
//
// Desktop: fixed over the left of the screen (a portal into the file, before the file column in the
// tab order). Phone: in the flow of the sheet, in a window the sheet leaves transparent, which the
// scene follows as the page scrolls.
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { entryById } from '../data/entries'
import { AREA_CONTENT, type Area } from '../space/content'
import type { Clock, ClockState } from '../space/clock'
import { defaultLayout, type Runtime } from '../space/runtime'
import type { Space } from '../space/scene'
import { INTRO } from '../space/shots'
import { RESULT_AT, STEP_AT, stepOf } from '../space/station'
import { useCtx } from './context'
import '../styles/space.css'

const smooth = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10) }
const win = (p: number, a: number, b: number) => smooth((p - a) / Math.max(1e-6, b - a))
const pad = (n: number) => String(n).padStart(2, '0')

/** the parts of the clock the React tree needs; everything per-frame is written straight to the DOM instead */
const sliceOf = (s: ClockState) => `${s.area}|${stepOf(s.p)}|${s.playing ? 1 : 0}|${s.reason}|${s.tour ? 1 : 0}|${s.order.length}|${s.intro >= INTRO.dur ? 1 : 0}|${s.travel ? 1 : 0}|${s.p >= RESULT_AT ? 1 : 0}`
function useSlice(clock: Clock) {
  const raw = useSyncExternalStore(clock.subscribe, () => sliceOf(clock.state), () => sliceOf(clock.state))
  return useMemo(() => {
    const [area, step, playing, reason, tour, count, intro, travel, result] = raw.split('|')
    return { area: +area, step: +step, playing: playing === '1', reason, tour: tour === '1', count: +count, introDone: intro === '1', travelling: travel === '1', result: result === '1' }
  }, [raw])
}
function useNarrow() {
  const q = useMemo(() => matchMedia('(max-width: 899px)'), [])
  return useSyncExternalStore((f) => { q.addEventListener('change', f); return () => q.removeEventListener('change', f) }, () => q.matches, () => false)
}

export function SpaceExhibit({ jump, part = 'stage' }: { jump: (id: string) => void; part?: 'stage' | 'index' }) {
  const { runtime, space: svc, reduced } = useCtx()
  const rt = runtime.current
  if (!rt || !svc) return null
  return <Show rt={rt} clock={rt.clock} space={svc.space} jump={jump} reduced={reduced} part={part} />
}

/** the index's open state is shared by the stage's button and (on a phone) the list at the end of the page */
const indexStore = { open: false, subs: new Set<() => void>(), set(v: boolean) { this.open = v; this.subs.forEach((f) => f()) } }
const useIndexOpen = () => useSyncExternalStore((f) => { indexStore.subs.add(f); return () => { indexStore.subs.delete(f) } }, () => indexStore.open, () => false)

function Show({ rt, clock, space, jump, reduced, part }: { rt: Runtime; clock: Clock; space: Space; jump: (id: string) => void; reduced: boolean; part: 'stage' | 'index' }) {
  const narrow = useNarrow()
  const k = useSlice(clock)
  const A = AREA_CONTENT[k.area]
  const open = useIndexOpen()
  const rootRef = useRef<HTMLDivElement>(null), holeRef = useRef<HTMLDivElement>(null), headRef = useRef<HTMLElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const restTop = useRef(0)

  // desktop: a host inside the file, before the file column, so the show's controls come first in the tab order
  const anchor = useCallback((el: HTMLElement | null) => {
    if (part !== 'stage') return
    const file = el?.closest('.file'), meta = file?.querySelector('.file-meta')
    if (!el || !file || !meta) return
    const h = document.createElement('div'); h.className = 'space-host'; file.insertBefore(h, meta); setHost(h)
    return () => { h.remove(); setHost(null) }
  }, [part])

  // layout: the canvas is the whole screen; the subject is composed into the left of it (desktop) or into the window in the sheet (phone)
  useEffect(() => {
    if (part !== 'stage') return
    if (!narrow) {
      const on = () => rt.setLayout(defaultLayout())
      on(); addEventListener('resize', on); return () => removeEventListener('resize', on)
    }
  }, [rt, narrow, part])

  // the thumbnails exist a frame after their result: this reads them on every render, and the count's change renders again
  const thumbs = rt.thumbs()

  // reading the file pauses the show; hovering does not (spec R12)
  useEffect(() => {
    if (part !== 'stage') return
    const meta = document.querySelector<HTMLElement>('.file--subject .file-meta'), sheet = document.querySelector<HTMLElement>('.file--subject'), root = rootRef.current
    if (!meta || !sheet) return
    // reading is what happens in the profile: the show's own controls (they sit inside it on a phone) are not
    const mine = (t: EventTarget | null) => t instanceof Element && !!t.closest('.space, .space-list')
    const reading = (e?: Event) => { if (!mine(e?.target ?? null)) clock.pause('reading') }
    const events = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const
    for (const e of events) meta.addEventListener(e, reading, { passive: true })
    meta.addEventListener('focusin', reading)
    const selection = () => { const s = getSelection(); if (s && !s.isCollapsed && s.anchorNode && meta.contains(s.anchorNode) && !mine(s.anchorNode.parentElement)) clock.pause('reading') }
    document.addEventListener('selectionchange', selection)
    // a phone scrolls the page itself: scrolling is reading. A command given to the show (and the little shift of the
    // page that follows when its text changes height) is not, so only a scroll well away from where the last one was counts
    const scroll = () => { if (narrow && Math.abs(sheet.scrollTop - restTop.current) > 40) clock.pause('reading') }
    const rest = () => { restTop.current = sheet.scrollTop }
    sheet.addEventListener('scroll', scroll, { passive: true })
    root?.addEventListener('pointerdown', rest, true); root?.addEventListener('keydown', rest, true)
    return () => { for (const e of events) meta.removeEventListener(e, reading); meta.removeEventListener('focusin', reading); document.removeEventListener('selectionchange', selection); sheet.removeEventListener('scroll', scroll); root?.removeEventListener('pointerdown', rest, true); root?.removeEventListener('keydown', rest, true) }
  }, [clock, narrow, part, host])

  // phone: the sheet leaves a window open for the scene (a gradient background with a gap where the window is)
  useEffect(() => {
    if (!narrow || part !== 'stage') return
    const meta = document.querySelector<HTMLElement>('.file--subject .file-meta'), hole = holeRef.current
    if (!meta || !hole) return
    const set = () => { const m = meta.getBoundingClientRect(), h = hole.getBoundingClientRect(); meta.style.setProperty('--hole-top', `${(h.top - m.top).toFixed(1)}px`); meta.style.setProperty('--hole-h', `${h.height.toFixed(1)}px`) }
    const ro = new ResizeObserver(set); ro.observe(meta); ro.observe(hole); set()
    return () => { ro.disconnect(); meta.style.removeProperty('--hole-top'); meta.style.removeProperty('--hole-h') }
  }, [narrow, part])

  // every frame: the layout of a phone's window, the chips on their anchors
  useEffect(() => {
    if (part !== 'stage') return
    const root = rootRef.current
    if (!root) return
    const chipEls = [...root.querySelectorAll<HTMLElement>('.space-chip')], textEls = chipEls.map((c) => c.querySelector('b')!)
    let lastLayout = ''
    const widths: number[] = [], heights: number[] = []
    // the head's box is read before this frame's writes (a read after them forces a layout of the whole page each frame);
    // on a desktop it only changes with the window or the area, so it is kept
    let headBox: { el: Element; r: DOMRect } | null = null
    const forget = () => { headBox = null }
    addEventListener('resize', forget)
    const off = rt.onFrame((f) => {
      const hole = narrow ? holeRef.current : null, r = hole ? hole.getBoundingClientRect() : null
      const head = headRef.current
      if (head && (narrow || !headBox || headBox.el !== head)) headBox = { el: head, r: head.getBoundingClientRect() }
      const hr = head && headBox ? headBox.r : null
      if (r) {
        // the subject goes in the part of the window below the words
        const hb = headRef.current?.getBoundingClientRect().bottom ?? r.top, top = Math.min(r.bottom - 140, Math.max(r.top, hb + 2)), h = Math.max(1, r.bottom - top)
        const l = { width: innerWidth, height: innerHeight, cx: 0.5, cy: (top + h / 2) / innerHeight, rw: 1, rh: h / innerHeight }
        const key = `${l.cy.toFixed(3)}|${l.rh.toFixed(3)}|${l.width}`
        if (key !== lastLayout) { lastLayout = key; rt.setLayout(l) }
      }
      const live = f.intro >= INTRO.dur && !f.travel
      const anchors = live ? space.anchors(f.area) : null
      const ox = r ? r.left : 0, oy = r ? r.top : 0, maxX = (r ? r.width : innerWidth * 0.58) - 8
      root.style.setProperty('--p', f.p.toFixed(4))
      const area = AREA_CONTENT[f.area]
      // chips are laid out in order: each keeps clear of the head (reference, title, steps) and of the chips already placed
      const headB = hr ? hr.bottom - oy + 8 : 0, headR = hr ? hr.right - ox + 24 : 0
      const placed: { l: number; r: number; t: number; b: number }[] = []
      area.chips.forEach((c, n) => {
        const el = chipEls[n]
        if (!el) return
        const a = anchors?.[c.at]
        const vis = live && a?.on ? win(f.p, c.from, c.from + 0.04) * (c.to ? 1 - win(f.p, c.to, c.to + 0.04) : 1) : 0
        const op = vis.toFixed(3)
        if (el.style.opacity !== op) { el.style.opacity = op; el.style.visibility = vis < 0.01 ? 'hidden' : 'visible' }
        const t = c.text(f.p)
        if (textEls[n].textContent !== t) { textEls[n].textContent = t; widths[n] = el.offsetWidth; heights[n] = el.offsetHeight }
        if (!a || vis < 0.01) return
        const w = widths[n] ?? (widths[n] = el.offsetWidth), h = heights[n] ?? (heights[n] = el.offsetHeight)
        let side = c.side ?? 'up', gap = 22
        const box = (sd: string, x: number, y: number, g: number) => sd === 'up' ? { l: x - w / 2, r: x + w / 2, t: y - g - h, b: y - g } : sd === 'down' ? { l: x - w / 2, r: x + w / 2, t: y + g, b: y + g + h } : sd === 'left' ? { l: x - g - w, r: x - g, t: y - h / 2, b: y + h / 2 } : { l: x + g, r: x + g + w, t: y - h / 2, b: y + h / 2 }
        const place = (sd: string) => {
          const lo = sd === 'left' ? w + 32 : sd === 'right' ? 8 : w / 2 + 8, hi = sd === 'right' ? maxX - w - 32 : sd === 'left' ? maxX : maxX - w / 2
          return Math.max(lo, Math.min(hi, a.x - ox))
        }
        const y = a.y - oy
        let x = place(side), r = box(side, x, y, gap)
        // under the head: hang the text below its point instead
        if (r.t < headB && r.l < headR && side === 'up') { side = 'down'; x = place(side); r = box(side, x, y, gap) }
        // (and if even that still overlaps the words, the leader is lengthened until the text is clear of them)
        if (side === 'down' && r.t < headB && r.l < headR) { gap += headB - r.t; r = box(side, x, y, gap) }
        // away from the chips already there: lengthen the leader
        for (let k = 0; k < 4; k++) {
          const q = placed.find((o) => r.l < o.r + 6 && r.r > o.l - 6 && r.t < o.b + 4 && r.b > o.t - 4)
          if (!q) break
          if (side === 'up' || side === 'left' || side === 'right') gap += q.b - r.t + 6; else gap += r.b - q.t + 6
          r = box(side, x, y, gap)
        }
        placed.push(r)
        el.dataset.side = side; el.style.setProperty('--gap', `${gap}px`)
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      })
    })
    return () => { off(); removeEventListener('resize', forget) }
  }, [rt, space, narrow, part, A, host])

  // evidence lands: a trace of light from the plate to the index, and the count answers
  const evBtn = useRef<HTMLButtonElement>(null), trail = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (part !== 'stage') return
    return clock.onRetain((area) => {
      const root = rootRef.current, btn = evBtn.current, svg = trail.current
      if (!root || !btn || !svg || reduced) return
      const from = space.plateScreen(area), b = btn.getBoundingClientRect(), r = root.getBoundingClientRect()
      const x0 = from.x - r.left, y0 = from.y - r.top, x1 = b.left + b.width / 2 - r.left, y1 = b.top - r.top
      const path = svg.querySelector('path')!, cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 80
      path.setAttribute('d', `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`)
      path.getAnimations().forEach((a) => a.cancel())
      path.animate([{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }], { duration: 1500, easing: 'cubic-bezier(.22,1,.36,1)' })
      btn.getAnimations().forEach((a) => a.cancel())
      btn.animate([{ color: 'var(--label)' }, { color: 'var(--acc-text)', offset: 0.55 }, { color: 'var(--label)' }], { duration: 1500, delay: 600 })
    })
  }, [clock, space, reduced, part])

  const pick = useCallback((i: number) => { indexStore.set(false); clock.select(i) }, [clock])
  const closeIndex = useCallback(() => { indexStore.set(false); requestAnimationFrame(() => evBtn.current?.focus({ preventScroll: true })) }, [])
  // leaving the file closes the index: the next visit starts with it shut, and Esc leaves the file
  useEffect(() => { if (part === 'stage') return () => indexStore.set(false) }, [part])
  const go = (id: string) => { clock.pause('user'); jump(id) }
  const onNavKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const btns = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.space-area')], i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault(); btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length].focus()
  }

  const stepNames = A.steps
  const live = k.introDone && !k.travelling
  const overlay = (
    <div ref={rootRef} className={`space ${narrow ? 'space--phone' : ''} ${live ? 'live' : ''} ${k.result ? 'has-result' : ''} ${open ? 'index-open' : ''}`} data-area={A.key} data-playing={k.playing}>
      <div ref={holeRef} className="space-hole">
        <header className="space-head" key={A.key} ref={headRef}>
          <div className="lbl space-ref">{A.ref}</div>
          <h2 className="space-title">{A.title}</h2>
          <ol className="space-steps" aria-label="Steps">
            {stepNames.map((s, i) => (
              <li key={i}><button type="button" style={{ '--a': STEP_AT[i], '--b': STEP_AT[i + 1] ?? 1 } as React.CSSProperties} aria-current={k.step === i ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s}`} data-state={i < k.step ? 'done' : i === k.step ? 'on' : ''} onClick={() => clock.step(i)}><i /><span className="lbl">{pad(i + 1)}</span></button></li>
            ))}
          </ol>
          <p className="space-cap" aria-live={k.tour ? 'off' : 'polite'}><span className="lbl">{pad(k.step + 1)}</span>{stepNames[k.step]}</p>
        </header>
        <div className="space-chips" aria-hidden="true" key={`c${A.key}`}>
          {A.chips.map((c, i) => <div key={i} className="space-chip" data-tone={c.tone ?? ''} data-side={c.side ?? 'up'} data-phone={c.phone ? '1' : '0'}><span className="lbl">{c.label}</span><b /></div>)}
        </div>
      </div>

      <div className="space-bar">
        <section className="space-result" aria-live="polite" key={`r${A.key}`}>
          <p>{A.result}</p>
          <div className="space-result-row">
            <button type="button" className="space-go" onClick={() => go(A.entry)}><b>{A.link}</b><span aria-hidden="true">→</span></button>
            <span className="lbl space-kept">✓ Evidence · {A.evidence}</span>
          </div>
        </section>
        <nav className="space-nav" aria-label="Work areas" onKeyDown={onNavKey}>
          {AREA_CONTENT.map((a, i) => (
            <button key={a.key} type="button" className="space-area" aria-pressed={k.area === i && !k.travelling || undefined} data-kept={clock.state.retained[i] ? '1' : '0'} onClick={() => pick(i)}>
              <span className="lbl">{pad(i + 1)}</span>{a.short}<i aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="space-ctl">
          <button type="button" className="lbl" onClick={() => (k.playing ? clock.pause('user') : clock.resume())} aria-label={k.playing ? 'Pause' : k.reason === 'reading' ? 'Resume (paused while you read)' : 'Play'}>
            <span aria-hidden="true">{k.playing ? '❚❚' : '▶'}</span>{k.playing ? 'Pause' : k.reason === 'reading' ? 'Paused · Resume' : k.reason === 'done' ? 'Replay' : 'Play'}
          </button>
          <button type="button" className="lbl" onClick={() => clock.replay()}>↻ Replay</button>
          <button type="button" className="lbl" onClick={() => clock.playAll()}>Play all</button>
          <button ref={evBtn} type="button" className="lbl space-ev" aria-expanded={open} onClick={() => { clock.pause('user'); indexStore.set(!open) }}>
            Evidence <b>{k.count}</b> / 6
          </button>
        </div>
      </div>
      {!narrow && open && <EvidenceIndex thumbs={thumbs} clock={clock} onPick={pick} onGo={go} onClose={closeIndex} />}
      <svg ref={trail} className="space-trail" aria-hidden="true"><path pathLength={1} /></svg>
    </div>
  )
  if (part === 'index') return narrow ? <EvidenceList thumbs={thumbs} clock={clock} onPick={pick} onGo={go} /> : null
  if (narrow) return overlay
  return <><span ref={anchor} hidden />{host && createPortal(overlay, host)}</>
}

/** the six results as two columns of three: each a crop of the very object and result it stands for */
function EvidenceIndex({ thumbs, clock, onPick, onGo, onClose }: { thumbs: Record<number, string>; clock: Clock; onPick: (i: number) => void; onGo: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }) }, [])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose() } }; addEventListener('keydown', k, true); return () => removeEventListener('keydown', k, true) }, [onClose])
  return (
    <section ref={ref} className="space-index" aria-label="Evidence index">
      <div className="space-index-h"><span className="lbl">Evidence · {clock.state.order.length} of 6 produced</span><button type="button" className="lbl" onClick={onClose}>Close ×</button></div>
      <div className="space-index-grid">
        {AREA_CONTENT.map((a, i) => <Cell key={a.key} a={a} i={i} src={thumbs[i]} kept={clock.state.retained[i]} onPick={onPick} onGo={onGo} />)}
      </div>
    </section>
  )
}
function Cell({ a, i, src, kept, onPick, onGo }: { a: Area; i: number; src?: string; kept: boolean; onPick: (i: number) => void; onGo: (id: string) => void }) {
  return (
    <article className="space-cell" data-kept={kept ? '1' : '0'}>
      <button type="button" className="space-thumb" onClick={() => onPick(i)} aria-label={`${kept ? 'Show again' : 'Watch'}: ${a.name}`}>
        {kept && src ? <img src={src} alt={`${a.evidence}, as it stands in the space`} /> : <span className="lbl">{pad(i + 1)}</span>}
      </button>
      <div>
        <div className="lbl">{kept ? `${a.entry} · retained` : 'Not yet viewed'}</div>
        <h3>{a.evidence}</h3>
        <button type="button" className="space-go" onClick={() => onGo(a.entry)}><b>Open {a.entry}</b><span aria-hidden="true">→</span></button>
      </div>
    </article>
  )
}
/** phone: the same index as an expandable list at the end of the page */
function EvidenceList({ thumbs, clock, onPick, onGo }: { thumbs: Record<number, string>; clock: Clock; onPick: (i: number) => void; onGo: (id: string) => void }) {
  const open = useIndexOpen()
  // Esc closes the list before it leaves the file (as on a desktop)
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); indexStore.set(false) } }
    addEventListener('keydown', k, true); return () => removeEventListener('keydown', k, true)
  }, [open])
  return (
    <section className="space-list" aria-label="Evidence index">
      <button type="button" className="space-list-h" aria-expanded={open} onClick={() => indexStore.set(!open)}><span className="lbl">Collected evidence · {clock.state.order.length} of 6</span><span className="lbl">{open ? 'Close ×' : 'Explore +'}</span></button>
      {open && <div className="space-index-grid">{AREA_CONTENT.map((a, i) => <Cell key={a.key} a={a} i={i} src={thumbs[i]} kept={clock.state.retained[i]} onPick={onPick} onGo={onGo} />)}</div>}
    </section>
  )
}
void entryById
