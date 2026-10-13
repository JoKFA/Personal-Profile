// The phone shell's controller: wires the stage, the page layer, the native scroll reel, the open/close shell and the URL.
// Plain DOM + one animation loop; React only hosts it (PhoneApp.tsx). No three.js, no scene code, no CSS transitions for anything synced.
import { smooth } from '../../motion/waves'
import type { OpenShot, Pt as MPt, Rect, Shot } from '../manifest'
import { closeKey, loadManifest, openKey, panKey, readFlags, stillKey, windowKey } from './assets'
import { stopCopy } from './copy'
import { BAR, COMPACT_BELOW, lerpFit, panelSpec, rectOn, stopFit, toScreen, visibleRect, windowFit, type Fit } from './fit'
import { OPEN_END, CLOSE_SPEED, PageLayer, buildPage, prepareFile, type PageFrame, type Phase, type Pt } from './page'
import { sectionWant } from './reel'
import { idFromPath, pathOfId, pushFile, pushedByUs, toBrowse } from './route'
import { Stage } from './stage/stage'

/** the crossfade that stands in for a pan (no clip, or not buffered in time), seconds */
export const FADE_PAN = 0.9
/** the crossfade that stands in for an open or a close: [start, length] inside the clip's own duration */
const FADE_SHOT: [number, number] = [0.45, 1.0]
const RISE_S = 0.4
/** a cold link to a file waits this long for its open clip before cross-fading instead */
const COLD_WAIT_MS = 1500

export interface PhoneHandle { dispose(): void }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const corners = (r: Rect): Pt[] => [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }]
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x0: a.x0 + (b.x0 - a.x0) * k, y0: a.y0 + (b.y0 - a.y0) * k, x1: a.x1 + (b.x1 - a.x1) * k, y1: a.y1 + (b.y1 - a.y1) * k })

/** `cancelled`: asked once the manifest is in; a start that was cancelled meanwhile (React StrictMode's first effect in dev) builds nothing */
export async function startPhone(host: HTMLElement, cancelled: () => boolean = () => false): Promise<PhoneHandle> {
  const flags = readFlags()
  const { m, url } = await loadManifest(flags.dev)
  if (cancelled()) return { dispose() {} }
  const reel = m.reel, N = reel.length
  const copies = reel.map((id, i) => stopCopy(id, i))
  const dom = buildPage(host, copies, (id) => !!m.open[id])
  const { root } = dom
  const stage = new Stage(root, m.master); root.prepend(stage.box)
  stage.record = flags.expose
  if (flags.reject) stage.pool.play = () => Promise.reject(new DOMException('play() refused (forced by ?phone-reject)', 'NotAllowedError'))
  const page = new PageLayer(dom, copies)
  const csp: string[] = []
  const onCsp = (e: SecurityPolicyViolationEvent) => csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`)
  document.addEventListener('securitypolicyviolation', onCsp)

  // ── what the manifest has, registered by key ──
  for (const id of Object.keys(m.stops)) stage.register(stillKey(id), url(m.stops[id].still.file))
  for (const [k, c] of Object.entries(m.pans)) { const [a, b] = k.split('>'); stage.register(panKey(a, b), url(c.file)) }
  for (const [id, o] of Object.entries(m.open)) { stage.register(openKey(id), url(o.file)); stage.register(windowKey(id), url(o.window.file)) }
  for (const [id, c] of Object.entries(m.close)) stage.register(closeKey(id), url(c.file))

  // ── state ──
  let phase: Phase = 'settled'
  let at = 0, to = 0, want = 0
  let busy = false, disposed = false
  /** progress of a pan (0..1), the open/close timeline (s) and the clip frame the page layer is on */
  let panK = 0, tau = 0, shotIndex = 0
  let shot: Shot | OpenShot | null = null
  let rise = 1, riseOn = false
  let scrollP = 0
  let view = { w: innerWidth, h: innerHeight }
  let fits: Fit[] = [], winFit: Fit = { s: 1, tx: 0, ty: 0 }
  /** per stop: where its band starts and how tall its panel is (the marks frame the visible part of the reticle inside them) */
  let tops: number[] = [], panels: number[] = []
  const L = { barH: BAR, coverTop: BAR, panelC: 80, panelS: 252, natC: 0, natS: 0, specC: 80, specS: 252 }
  let progTo: number | null = null
  let buttonClose = false
  let flow = 0

  const stopOf = (i: number) => m.stops[reel[i]]
  const rest = (i: number) => visibleRect(rectOn(fits[i], stopOf(i).reticle), view, tops[i], panels[i])

  // ── layout: the fit for every stop on this screen (plan §2.1) ──
  function layout() {
    view = { w: innerWidth, h: innerHeight }
    root.style.setProperty('--ph-h', `${view.h}px`)
    // a short viewport: the panels keep the eyebrow, the title and the Open row (150 px); the summary and the small line are hidden
    if (view.h < COMPACT_BELOW) root.setAttribute('data-compact', ''); else root.removeAttribute('data-compact')
    L.barH = Math.max(BAR, dom.bar.offsetHeight)
    L.coverTop = Math.max(L.barH, dom.sheet.offsetHeight)
    L.specC = panelSpec(view.h, true); L.specS = panelSpec(view.h, false)
    // each panel's natural height with no minimum: the fit's panel height is the spec or the tallest content, whichever is more
    let natC = 0, natS = 0
    for (const [id, p] of dom.panels) {
      p.el.style.minHeight = '0px'
      const h = p.el.offsetHeight
      p.el.style.minHeight = ''
      if (id === reel[0]) natC = h; else natS = Math.max(natS, h)
    }
    L.natC = natC; L.natS = natS
    L.panelC = Math.max(L.specC, natC); L.panelS = Math.max(L.specS, natS)
    root.style.setProperty('--ph-pc', `${L.panelC}px`); root.style.setProperty('--ph-ps', `${L.panelS}px`)
    tops = reel.map((_, i) => (i === 0 ? L.coverTop : L.barH)); panels = reel.map((_, i) => (i === 0 ? L.panelC : L.panelS))
    fits = reel.map((id, i) => stopFit(view, m.master, m.stops[id].reticle, tops[i], panels[i]))
    winFit = windowFit(view, m.master)
    syncDom()
  }

  // ── the picture and the reticle follow the current state (called from the clip's frame callback and from the loop) ──
  function currentFit(): Fit {
    if (phase === 'panning') return lerpFit(fits[at], fits[to], smooth(panK))
    if (phase === 'file') return winFit
    if ((phase === 'opening' || phase === 'closing') && shot) return lerpFit(fits[at], winFit, shot.cam[clamp(shotIndex, 0, shot.cam.length - 1)])
    return fits[at]
  }
  function marksTarget(): { pts: Pt[]; anchor: Rect } {
    if (phase === 'panning') { const r = lerpRect(rest(at), rest(to), smooth(panK)); return { pts: corners(r), anchor: r } }
    const r = rest(at)
    if ((phase === 'opening' || phase === 'file' || phase === 'closing') && shot) {
      // the reticle's corners lock onto the face's corners (0.16 s), each taking the nearest free one, then ride them (overlay.ts)
      const i = phase === 'file' ? shot.quads.length - 1 : clamp(shotIndex, 0, shot.quads.length - 1)
      const f = currentFit(), lock = phase === 'file' ? 1 : smooth(Math.min(1, tau / 0.16))
      const q = shot.quads[i].map((p: MPt) => toScreen(f, p)), used = new Set<number>()
      const pts = corners(r).map((c) => {
        let best = 0, bd = Infinity
        q.forEach((p, j) => { if (used.has(j)) return; const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = j } })
        used.add(best)
        return { x: c.x + (q[best].x - c.x) * lock, y: c.y + (q[best].y - c.y) * lock }
      })
      return { pts, anchor: r }
    }
    return { pts: corners(r), anchor: r }
  }
  function syncDom() {
    if (!fits.length) return
    stage.setFit(currentFit())
    const { pts, anchor } = marksTarget()
    // the reticle belongs to the stops: it leaves with the last one when the Index comes up
    const away = clamp((scrollP - (N - 1)) / 0.5, 0, 1)
    page.placeMarks(pts, anchor, phase === 'settled' || phase === 'panning' ? 1 - smooth(away) : 1)
  }

  // ── the loop: runs only while something moves ──
  let raf = 0, last = 0, scrolling = false
  function frame(now: number) {
    raf = 0
    if (disposed) return
    const dt = clamp(last ? (now - last) / 1000 : 0, 0, 0.05); last = now
    if (riseOn && rise < 1) rise = Math.min(1, rise + dt / RISE_S)
    const f: PageFrame = { phase, stop: reel[at], settled: phase === 'settled' || phase === 'file', tau, dt, rise }
    // while panning the stop being left seals; once a pan has landed `at` is the new stop and it decrypts
    const moving = page.update(f)
    syncDom()
    if (moving || busy || scrolling || rise < 1) kick()
    else last = 0
  }
  function kick() { if (!raf && !disposed) raf = requestAnimationFrame(frame) }

  // ── preloading around the current stop ──
  function preload() {
    const near = [at - 1, at, at + 1].filter((i) => i >= 0 && i < N)
    const keep: string[] = near.map((i) => stillKey(reel[i]))
    const id = reel[at]
    if (m.open[id] && at > 0) keep.push(windowKey(id))
    stage.pin(keep)
    for (const k of keep) void stage.loadStill(k)
    if (stage.mode !== 'clips') return
    for (const i of near) if (i !== at && m.pans[`${reel[at]}>${reel[i]}`]) stage.loadClip(panKey(reel[at], reel[i]))
    if (m.open[id] && at > 0) { stage.loadClip(openKey(id)); void prepareFile(dom, id) }   // the cover's door is P3's   // the file's own lines are sealed and checked before the tap
  }

  // ── the reel: the next stop, one hop at a time ──
  function pump() {
    if (disposed || busy || phase !== 'settled') return
    const target = clamp(want, 0, N - 1)
    if (target === at) return
    if (Math.abs(target - at) === 1) void pan(at, target, false)
    else void pan(at, target, true)
  }
  async function pan(a: number, b: number, jump: boolean) {
    busy = true; phase = 'panning'; to = b; panK = 0
    const key = `${reel[a]}>${reel[b]}`, clip = jump ? undefined : m.pans[key]
    kick()
    await stage.run({
      clipKey: clip ? panKey(reel[a], reel[b]) : null, clip: clip ?? null,
      from: stillKey(reel[a]), to: stillKey(reel[b]), duration: FADE_PAN, fade: [0, FADE_PAN],
      onTick: (_t, _i, k) => { panK = k; syncDom() },
    })
    if (disposed) return
    at = b; phase = 'settled'; panK = 0; busy = false
    syncDom(); preload(); kick(); pump()
  }

  // ── scrolling ──
  let scrollTimer: ReturnType<typeof setTimeout> | undefined
  let prevY = 0, dir = 0
  function onScroll() {
    const y = scrollY
    if (Math.abs(y - prevY) > 0.5) dir = y > prevY ? 1 : -1
    prevY = y
    scrollP = y / view.h
    if (phase === 'settled' || phase === 'panning') {
      if (progTo === null) want = clamp(sectionWant(scrollP, dir, dom.sections.length), 0, N - 1)
      pump()
    }
    scrolling = true; kick()
    clearTimeout(scrollTimer); scrollTimer = setTimeout(onScrollEnd, 140)
  }
  function onScrollEnd() {
    scrolling = false; dir = 0
    scrollP = scrollY / view.h
    if (phase === 'settled' || phase === 'panning') {
      // the scroll has stopped (no event for 140 ms): a programmatic one has arrived, or was cut short by the finger
      const near = Math.round(scrollP)
      progTo = null
      want = clamp(near, 0, N - 1)
      pump()
    }
    kick()
  }
  /** a tick, or Index/Contact: scroll to a section. Further than one section away, the stage cross-fades once to the end (not a pan per section). */
  function goTo(section: number) {
    section = clamp(section, 0, dom.sections.length - 1)
    if (phase !== 'settled' && phase !== 'panning') return
    const from = Math.round(scrollP)
    progTo = Math.abs(section - from) > 1 ? section : null
    if (progTo !== null) want = clamp(at, 0, N - 1)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollTo({ top: section * view.h, behavior: reduce ? 'auto' : 'smooth' })
  }

  // ── open / close ──
  const lockScroll = (on: boolean) => {
    document.documentElement.classList.toggle('ph-locked', on)
    if (on) document.addEventListener('touchmove', stopMove, { passive: false }); else document.removeEventListener('touchmove', stopMove)
  }
  const stopMove = (e: TouchEvent) => { if (e.cancelable) e.preventDefault() }
  const goPanelFocus = (el: HTMLElement | null) => el?.focus({ preventScroll: true })

  async function openFile(ix: number, o: { push: boolean; inputAt?: number }) {
    const id = reel[ix], sh = m.open[id]
    if (!sh || phase !== 'settled' || busy) return
    busy = true; phase = 'opening'; tau = 0; shotIndex = 0; shot = sh
    const my = ++flow
    lockScroll(true)
    if (o.push) pushFile(id)
    stage.pin([stillKey(id), windowKey(id)]); void stage.loadStill(windowKey(id)); stage.loadClip(closeKey(id))
    kick()
    await prepareFile(dom, id)
    if (my !== flow || disposed) return
    await stage.run({
      clipKey: openKey(id), clip: sh,
      from: stillKey(id), to: windowKey(id), duration: sh.frames / sh.fps, fade: FADE_SHOT, inputAt: o.inputAt,
      onTick: (t, i) => { tau = t; shotIndex = i; syncDom() },
    })
    if (my !== flow || disposed) return
    phase = 'file'; tau = Math.max(tau, OPEN_END); shotIndex = sh.quads.length - 1; busy = false
    syncDom(); kick()
    goPanelFocus(dom.back)
  }

  async function closeFile(play: boolean) {
    if (phase !== 'file' && phase !== 'opening') return
    const id = reel[at], sh = m.close[id]
    const my = ++flow
    if (!play || !sh) {
      // a back gesture (iOS already animated it) or no close clip: land on the end state at once
      stage.finish()
      stage.show(stillKey(id))
      finishClose(id)
      return
    }
    busy = true; phase = 'closing'; tau = OPEN_END; shot = sh; shotIndex = 0
    kick()
    await stage.run({
      clipKey: closeKey(id), clip: sh,
      from: windowKey(id), to: stillKey(id), duration: sh.frames / sh.fps, fade: FADE_SHOT,
      onTick: (t, i) => { tau = Math.max(0, OPEN_END - t * CLOSE_SPEED); shotIndex = i; syncDom() },
    })
    if (my !== flow || disposed) return
    finishClose(id)
  }
  function finishClose(id: string) {
    phase = 'settled'; busy = false; tau = 0; shotIndex = 0; shot = null; panK = 0
    lockScroll(false)
    syncDom(); preload(); kick()
    goPanelFocus(dom.panels.get(id)?.open ?? null)
    pump()
  }
  /** the in-page "← All files": through history when this shell pushed the entry (so Back and the button agree), plain otherwise */
  function backButton() {
    if (phase !== 'file') return
    if (pushedByUs()) {
      buttonClose = true
      history.back()
      setTimeout(() => { if (buttonClose && phase === 'file') { buttonClose = false; toBrowse(); void closeFile(true) } }, 500)
    } else { toBrowse(); void closeFile(true) }
  }
  function onPop() {
    const id = idFromPath(location.pathname)
    if (!id) {
      if (phase === 'file' || phase === 'opening') { const play = buttonClose; buttonClose = false; void closeFile(play) }
      return
    }
    const ix = reel.indexOf(id)
    if (ix < 0 || phase === 'file' || phase === 'opening' || busy) return
    if (ix !== at) { stage.show(stillKey(id)); at = ix; to = ix; want = ix; scrollTo({ top: ix * view.h, behavior: 'auto' }); syncDom(); preload() }
    void openFile(ix, { push: false })
  }

  // ── listeners ──
  const prime = () => stage.prime()
  const onResize = () => { if (visualViewport && visualViewport.scale > 1.01) return; layout(); kick() }
  const onVis = () => { if (document.hidden) stage.suspend(); else { stage.resume(); kick() } }
  const onShow = (e: PageTransitionEvent) => { if (e.persisted) { stage.resync(); layout(); preload(); kick() } }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase === 'file') backButton() }
  const mq = matchMedia('(orientation: landscape)')
  const onOrient = () => { if (mq.matches) root.setAttribute('data-land', ''); else root.removeAttribute('data-land'); layout() }
  const onClick = (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest('button'); if (!t) return
    if (t.classList.contains('ph-go')) { const ix = reel.indexOf(t.dataset.id!); void openFile(ix, { push: true, inputAt: e.timeStamp }) }
    else if (t.classList.contains('ph-tick')) goTo(Number(t.dataset.stop))
    else if (t.dataset.go === 'index' || t.dataset.go === 'contact') goTo(dom.sections.length - 1)
    else if (t.classList.contains('ph-back')) backButton()
  }
  root.addEventListener('click', onClick)
  for (const t of ['touchend', 'pointerup', 'click']) document.addEventListener(t, prime, { passive: true })
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onResize); visualViewport?.addEventListener('resize', onResize)
  addEventListener('popstate', onPop); addEventListener('pageshow', onShow); addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVis)
  mq.addEventListener('change', onOrient)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

  // ── start ──
  const route = idFromPath(location.pathname)
  const coldIx = route ? reel.indexOf(route) : -1
  if (route && coldIx < 0) toBrowse()   // a file the reel has no stop for yet (P3 gives every Index entry one): back to the cover
  at = to = want = Math.max(0, coldIx)
  onOrient()
  layout()
  void document.fonts?.ready.then(() => { if (!disposed) { layout(); kick() } })
  const first = reel[at]
  stage.pin([stillKey(first)])
  await stage.loadStill(stillKey(first))
  await Promise.all(dom.lines.map((l) => l.ready))
  if (disposed) return { dispose() {} }
  if (at > 0) scrollTo({ top: at * view.h, behavior: 'auto' })
  scrollP = scrollY / view.h; prevY = scrollY
  stage.show(stillKey(first))
  // a return visit: the paper rises over 0.4 s; a cold link to a file: its panel is already there
  if (coldIx >= 0) { page.setPlain(first, 1); rise = 1 } else { rise = 0; riseOn = true }
  syncDom()
  root.setAttribute('data-ready', '')
  preload(); kick()

  if (coldIx >= 0 && m.open[first]) {
    // the stop's picture, then its open clip (buffered if it can be, else a crossfade), then the file
    void stage.loadStill(windowKey(first))
    await Promise.all([stage.buffered(openKey(first), COLD_WAIT_MS), stage.stills.ready(windowKey(first))])
    if (!disposed) void openFile(coldIx, { push: false })
  } else if (coldIx >= 0) toBrowse()

  const api = {
    get phase() { return phase }, get at() { return at }, get want() { return want }, get busy() { return busy },
    get mode() { return stage.mode }, get ready() { return root.hasAttribute('data-ready') },
    stage, page, dom, manifest: m, csp, layout: L, get fits() { return fits }, get winFit() { return winFit }, get view() { return view },
    get tau() { return tau }, get panK() { return panK }, get shotIndex() { return shotIndex },
    marks: () => dom.marks.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }),
    openFile: (i: number) => openFile(i, { push: true }), closeFile: (play = true) => backOrClose(play), goTo,
    pathOf: pathOfId,
  }
  function backOrClose(play: boolean) { if (play) backButton(); else { toBrowse(); void closeFile(false) } }
  if (flags.expose) (window as unknown as { __phone?: typeof api }).__phone = api

  return {
    dispose() {
      disposed = true
      cancelAnimationFrame(raf); clearTimeout(scrollTimer)
      lockScroll(false)
      root.removeEventListener('click', onClick)
      for (const t of ['touchend', 'pointerup', 'click']) document.removeEventListener(t, prime)
      removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); visualViewport?.removeEventListener('resize', onResize)
      removeEventListener('popstate', onPop); removeEventListener('pageshow', onShow); removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('securitypolicyviolation', onCsp)
      mq.removeEventListener('change', onOrient)
      stage.dispose(); root.remove()
      if (flags.expose && (window as unknown as { __phone?: unknown }).__phone === api) delete (window as unknown as { __phone?: unknown }).__phone
    },
  }
}
