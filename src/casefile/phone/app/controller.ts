// The phone shell's controller: wires the stage, the page layer, the native scroll reel, the open/close shell and the URL.
// Plain DOM + one animation loop; React only hosts it (PhoneApp.tsx). No three.js, no scene code, no CSS transitions for anything synced.
import { entryById } from '../../data/entries'
import { smooth } from '../../motion/waves'
import { reconVisitor, type Visitor } from '../../visitor'
import { Line } from '../cipherLine'
import type { OpenShot, Pt as MPt, Rect, Shot } from '../manifest'
import { closeKey, entranceKey, loadManifest, openKey, panKey, readFlags, stillKey, windowKey } from './assets'
import type { EnterOptions, EntryBridge } from './gate/entry'
import { sampleAt } from './clock'
import { Slicer, idleSlot, nextTask } from './idle'   // P6b
import { fillIndex } from './indexpage'   // P6c
import { stopCopy } from './copy'
import type { FileView } from './file/fileview'
import { HOOKS } from '../../scene/lab'
import type { PhoneSpace, SpaceHost } from './space/PhoneSpace'
import type { Bridge } from './file/FileParts'
import { BAR, COMPACT_BELOW, lerpFit, panelSpec, rectOn, stopFit, toScreen, visibleRect, windowFit, type Fit } from './fit'
import { OPEN_END, CLOSE_SPEED, PageLayer, buildPage, makePanel, prepareFile, type PageFrame, type Panel, type Phase, type Pt } from './page'
import { sectionWant } from './reel'
import { PUSHED, idFromPath, pathOfId, pushFile, pushedByUs, toBrowse } from './route'
import { Stage } from './stage/stage'

/** the crossfade that stands in for a pan (no clip, or not buffered in time), seconds */
export const FADE_PAN = 0.9
/** the crossfade that stands in for an open or a close: [start, length] inside the clip's own duration */
const FADE_SHOT: [number, number] = [0.45, 1.0]
/** an entry's stop picture replacing another (a related-file jump, an entry opened from elsewhere): the 120 ms rule */
const FADE_STOP = 0.12
/** the close that hands over to another file runs this much faster (plan 2.6) */
const JUMP_RATE = 1.5
/** how long an entry opened from elsewhere waits for its open clip to buffer before it cross-fades instead */
const BUFFER_WAIT_MS = 1200
const RISE_S = 0.4
/** a cold link to a file waits this long for its open clip before cross-fading instead */
const COLD_WAIT_MS = 1500

export interface PhoneHandle { dispose(): void }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const corners = (r: Rect): Pt[] => [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }]
const lerpPt = (a: MPt, b: MPt, k: number): MPt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
/** the face's four corners at a fractional clip frame: linear between the two frames around it (the page layer leads the picture by half a frame) */
const quadAt = (quads: MPt[][], pos: number): MPt[] => { const i = clamp(Math.floor(pos), 0, quads.length - 1), j = Math.min(quads.length - 1, i + 1), f = clamp(pos - i, 0, 1); return quads[i].map((p, n) => lerpPt(p, quads[j][n], f)) }
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x0: a.x0 + (b.x0 - a.x0) * k, y0: a.y0 + (b.y0 - a.y0) * k, x1: a.x1 + (b.x1 - a.x1) * k, y1: a.y1 + (b.y1 - a.y1) * k })

/** `cancelled`: asked once the manifest is in; a start that was cancelled meanwhile (React StrictMode's first effect in dev) builds nothing */
/** `entry`: a first visit (P4): the entry page is over the shell; once it is sealed the entrance plays under it and the shell takes over */
export async function startPhone(host: HTMLElement, cancelled: () => boolean = () => false, entry?: EntryBridge): Promise<PhoneHandle> {
  const flags = readFlags()
  const { m, url } = await loadManifest()
  if (cancelled()) return { dispose() {} }
  const reel = m.reel, N = reel.length
  const copies = reel.map((id, i) => stopCopy(id, i))
  const dom = buildPage(host, copies, (id) => !!m.open[id])
  const { root } = dom
  await nextTask()   // P6c: the page is built; the entry page may paint and take input before the shell goes on (a start that was cancelled meanwhile is taken down by its caller)
  // P6a: the layout's height is the small viewport's (svh): it does not change when the browser's toolbar slides, so nothing is laid out again and nothing jumps mid-read; a browser without svh has innerHeight
  const svhProbe = document.createElement('div'); svhProbe.className = 'ph-svh'; svhProbe.setAttribute('aria-hidden', 'true'); root.appendChild(svhProbe)   // P6a
  const svh = () => { const h = svhProbe.offsetHeight; return h > 100 ? h : innerHeight }   // P6a
  const stage = new Stage(root, m.master); root.prepend(stage.box)
  stage.record = HOOKS && flags.expose
  if (HOOKS && flags.reject) stage.pool.play = () => Promise.reject(new DOMException('play() refused (forced by ?phone-reject, a test hook)', 'NotAllowedError'))
  const page = new PageLayer(dom, copies)
  const csp: string[] = []
  const onCsp = (e: SecurityPolicyViolationEvent) => csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`)
  document.addEventListener('securitypolicyviolation', onCsp)

  // ── what the manifest has, registered by key ──
  for (const id of Object.keys(m.stops)) stage.register(stillKey(id), url(m.stops[id].still.file))
  for (const [k, c] of Object.entries(m.pans)) { const [a, b] = k.split('>'); stage.register(panKey(a, b), url(c.file)) }
  if (m.entrance) stage.register(entranceKey, url(m.entrance.file))
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
  /** a first visit: the page layer (bar, reticle, paper) stays away until the entrance has played */
  const entering = !!entry
  let ready!: () => void
  const readyP = new Promise<void>((r) => { ready = r })
  let scrollP = 0
  let view = { w: innerWidth, h: innerHeight }
  let fits: Fit[] = [], winFit: Fit = { s: 1, tx: 0, ty: 0 }
  /** per stop: where its band starts and how tall its panel is (the marks frame the visible part of the reticle inside them) */
  let tops: number[] = [], panels: number[] = []
  const L = { barH: BAR, coverTop: BAR, panelC: 80, panelS: 252, natC: 0, natS: 0, specC: 80, specS: 252 }
  let progTo: number | null = null
  // P6b: the two media queries the shell asks all the time are read once and kept (asking a MediaQueryList costs a style and layout flush: 50 ms inside one scroll event on a slow phone)
  const mqLand = matchMedia('(orientation: landscape)'), mqRed = matchMedia('(prefers-reduced-motion: reduce)')
  let landscapeNow = mqLand.matches, reducedMotion = mqRed.matches
  const onMq = () => { landscapeNow = mqLand.matches; reducedMotion = mqRed.matches }
  mqLand.addEventListener('change', onMq); mqRed.addEventListener('change', onMq)
  let buttonClose = false
  let flow = 0
  const views = new Map<string, Promise<FileView>>()
  /** the entry whose file is opening, open or closing (any of the 19 stops, on the reel or not) */
  let openId: string | null = null
  /** where a file was opened from: the page's scroll position and the element to hand the focus back to */
  let origin: { sec: number; opener: HTMLElement | null } = { sec: 0, opener: null }
  /** a file is open: the page is the file (document scroll), the reel is out of the flow and its snap does not act */
  let fileMode = false
  /** a close was asked for while the file was still opening */
  let aborting = false   // a Back during an open is being carried out
  /** a file opened from the Index: where the page was, as a distance into the Index sheet (the sheet is as tall as its words, the reel's sections are as tall as the screen: a share of the screen height would not bring the page back to the same row when the toolbar has moved) (P5) */
  let ixBack: number | null = null
  const fitCache = new Map<string, Fit>()

  const stopOf = (i: number) => m.stops[reel[i]]
  const rest = (i: number) => visibleRect(rectOn(fits[i], stopOf(i).reticle), view, tops[i], panels[i])
  /** the stop being shown: the file's entry while one is open, else the reel's */
  const stopId = () => openId ?? reel[at]
  const fitOf = (id: string): Fit => { const i = reel.indexOf(id); if (i >= 0) return fits[i]; let f = fitCache.get(id); if (!f) { f = stopFit(view, m.master, m.stops[id].reticle, L.barH, L.panelS); fitCache.set(id, f) } return f }
  const restOf = (id: string): Rect => { const i = reel.indexOf(id); return i >= 0 ? rest(i) : visibleRect(rectOn(fitOf(id), m.stops[id].reticle), view, L.barH, L.panelS) }

  // ── layout: the fit for every stop on this screen (plan §2.1) ──
  function layout() {
    view = { w: innerWidth, h: svh() }   // P6a
    // P5: the Index sheet starts after five screens, so a change of the screen's height (the toolbar sliding) moves it: the page keeps its distance into the sheet
    const ixD = !fileMode && dom.ix.sec.offsetTop > 0 && scrollY >= dom.ix.sec.offsetTop - 1 ? scrollY - dom.ix.sec.offsetTop : null
    root.style.setProperty('--ph-h', `${view.h}px`)
    if (ixD !== null) { const y = Math.round(dom.ix.sec.offsetTop + ixD); if (Math.abs(y - scrollY) > 1) { scrollTo(0, y); scrollP = y / view.h; prevY = y } }   // P5
    // a short viewport: the panels keep the eyebrow, the title and the Open row (150 px); the summary and the small line are hidden
    if (view.h < COMPACT_BELOW) root.setAttribute('data-compact', ''); else root.removeAttribute('data-compact')
    page.staleMetrics()   // P6b
    L.barH = Math.max(BAR, dom.bar.offsetHeight)
    L.coverTop = Math.max(L.barH, dom.sheet.offsetHeight)
    L.specC = panelSpec(view.h, true); L.specS = panelSpec(view.h, false)
    // each panel's natural height with no minimum: the fit's panel height is the spec or the tallest content, whichever is more
    let natC = 0, natS = 0
    // P6b: all the minimums off, all the heights read, all the minimums back (one layout in the middle, not one per panel)
    const measured: [string, Panel][] = []
    for (const [id, p] of dom.panels) {
      if (p.el.classList.contains('ph-infile')) continue   // (a panel that is the head of an open file is not a stop's)
      p.el.style.minHeight = '0px'; measured.push([id, p])
    }
    const hs = measured.map(([, p]) => p.el.offsetHeight)
    measured.forEach(([id, p], i) => {
      p.el.style.minHeight = ''
      if (id === reel[0]) natC = hs[i]; else natS = Math.max(natS, hs[i])
    })
    L.natC = natC; L.natS = natS
    L.panelC = Math.max(L.specC, natC); L.panelS = Math.max(L.specS, natS)
    root.style.setProperty('--ph-pc', `${L.panelC}px`); root.style.setProperty('--ph-ps', `${L.panelS}px`)
    tops = reel.map((_, i) => (i === 0 ? L.coverTop : L.barH)); panels = reel.map((_, i) => (i === 0 ? L.panelC : L.panelS))
    fits = reel.map((id, i) => stopFit(view, m.master, m.stops[id].reticle, tops[i], panels[i]))
    winFit = windowFit(view, m.master)
    fitCache.clear()
    space?.onResize()
    for (const v of views.values()) void v.then((x) => x.relayout(view, winFit, heightsOf(x.id)))
    syncDom()
  }

  // ── the picture and the reticle follow the current state (called from the clip's frame callback and from the loop) ──
  /** reduced motion (P6a): a step is a crossfade and nothing travels: the stage's framing and the reticle's marks are the near end's until the fade's middle, the far end's after it (the far end of an open is the window, of a close the stop) */
  const farHalf = () => (phase === 'panning' ? panK >= 0.5 : !!shot && shotIndex >= shot.quads.length / 2)   // P6a
  function currentFit(): Fit {
    if (page.reduced && phase === 'panning') return farHalf() ? fits[to] : fits[at]   // P6a
    if (page.reduced && (phase === 'opening' || phase === 'closing') && shot) return (phase === 'opening') === farHalf() ? winFit : fitOf(stopId())   // P6a
    if (phase === 'panning') return lerpFit(fits[at], fits[to], smooth(panK))
    if (phase === 'file') return winFit
    if ((phase === 'opening' || phase === 'closing') && shot) return lerpFit(fitOf(stopId()), winFit, sampleAt(shot.cam, shotIndex))
    return openId ? fitOf(openId) : fits[at]
  }
  function marksTarget(): { pts: Pt[]; anchor: Rect } {
    if (phase === 'panning') { const r = page.reduced ? (farHalf() ? rest(to) : rest(at)) : lerpRect(rest(at), rest(to), smooth(panK)); return { pts: corners(r), anchor: r } }   // P6a
    const r = openId ? restOf(openId) : rest(at)
    // P6a: reduced motion: the marks stay on the stop's reticle until the fade's middle (an open) or leave the window's face at it (a close); no travel
    const atWindow = page.reduced && (phase === 'file' || ((phase === 'opening' || phase === 'closing') && (phase === 'opening') === farHalf()))
    if (page.reduced && (phase === 'opening' || phase === 'closing') && !atWindow) return { pts: corners(r), anchor: r }
    if ((phase === 'opening' || phase === 'file' || phase === 'closing') && shot) {
      // the reticle's corners lock onto the face's corners (0.16 s), each taking the nearest free one, then ride them (overlay.ts)
      const i = phase === 'file' || atWindow ? shot.quads.length - 1 : clamp(shotIndex, 0, shot.quads.length - 1)
      const f = currentFit(), lock = phase === 'file' || atWindow ? 1 : smooth(Math.min(1, tau / 0.16))   // P6a: (atWindow: at once)
      const q = quadAt(shot.quads, i).map((p: MPt) => toScreen(f, p)), used = new Set<number>()
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
    if (phase === 'space') return   // the interior's own frames place the stage and the reticle
    stage.setFit(currentFit())
    const { pts, anchor } = marksTarget()
    // the reticle belongs to the stops: it leaves with the last one when the Index comes up
    const away = clamp((scrollP - (N - 1)) / 0.5, 0, 1)
    page.placeMarks(pts, anchor, (phase === 'settled' || phase === 'panning' ? 1 - smooth(away) : 1) * (entering ? smooth(rise) : 1))
  }

  // ── the loop: runs only while something moves ──
  let raf = 0, last = 0, scrolling = false
  /** P6b: runs `fn` once nothing has moved for `ms` (the loop is not running, no pan, no scroll), checked every 150 ms */
  let quietWait = false
  const quietFns: (() => void)[] = []
  function whenQuiet(fn: () => void, ms = 600) {
    quietFns.push(fn)   // (P6c: a queue: the interior and the Index both wait for the same quiet)
    if (quietWait) return
    quietWait = true
    let since = 0
    const tick = () => {
      if (disposed) return
      const q = !raf && !busy && phase === 'settled' && !scrolling && !root.hasAttribute('data-entering'), now = performance.now()
      if (!q) since = 0; else if (!since) since = now
      if (since && now - since >= ms) { quietWait = false; const run = quietFns.splice(0); for (const f of run) f() } else setTimeout(tick, 150)
    }
    setTimeout(tick, 150)
  }
  // ── P6c: the Index's words are put in when the first screen is long done (a part per idle moment), or at once when somebody asks for the sheet ──
  let ixSlow = false, ixQueued = false
  function ensureIndex(now = true) {
    if (dom.ix.filled) {
      if (now && ixSlow) { ixSlow = false; for (const p of dom.ix.sec.querySelectorAll('[data-cold]')) p.removeAttribute('data-cold') }
      return
    }
    const parts = fillIndex(dom.ix, N)
    if (now) return
    ixSlow = true
    for (const p of parts) p.setAttribute('data-cold', '')
    void (async () => {
      for (const p of parts) { await idleSlot(300); if (!ixSlow || disposed) return; p.removeAttribute('data-cold'); p.getBoundingClientRect() }
      ixSlow = false
    })()
  }
  const indexLater = () => { if (ixQueued || dom.ix.filled) return; ixQueued = true; whenQuiet(() => { ixQueued = false; if (!disposed) ensureIndex(false) }, 800) }
  function frame(now: number) {
    raf = 0
    if (disposed) return
    const dt = clamp(last ? (now - last) / 1000 : 0, 0, 0.05); last = now
    if (riseOn && rise < 1) rise = Math.min(1, rise + dt / RISE_S)
    const f: PageFrame = { phase, stop: stopId(), settled: phase === 'settled' || phase === 'file', tau, dt, rise }
    // while panning the stop being left seals; once a pan has landed `at` is the new stop and it decrypts
    const moving = page.update(f)
    if (entering && riseOn && root.hasAttribute('data-barwait')) {
      dom.bar.style.setProperty('--ph-bar-a', String(smooth(rise)))   // P6b: on the bar, not the root (a custom property written on the root restyles the whole shell every frame of the rise)
      if (rise >= 1) { root.removeAttribute('data-barwait'); dom.bar.style.removeProperty('--ph-bar-a') }   // P6b
    }
    syncDom()
    // (waiting for the entrance: nothing moves, so the loop is not run)
    if (entering && !riseOn) { last = 0; return }
    if (moving || busy || scrolling || rise < 1) kick()
    else last = 0
  }
  function kick() { if (!raf && !disposed) raf = requestAnimationFrame(frame) }

  // ── preloading around the current stop ──
  function preload() {
    indexLater()   // P6c
    if (at === 0 && spaceReady()) whenQuiet(() => { if (at === 0) void warmSpace() })   // P6b: not while the paper rises or a pan lands
    const near = [at - 1, at, at + 1].filter((i) => i >= 0 && i < N)
    const keep: string[] = near.map((i) => stillKey(reel[i]))
    const id = reel[at]
    if (m.open[id] && at > 0) keep.push(windowKey(id))
    stage.pin(keep)
    for (const k of keep) void stage.loadStill(k)
    if (stage.mode !== 'clips') return
    for (const i of near) if (i !== at && m.pans[`${reel[at]}>${reel[i]}`]) stage.loadClip(panKey(reel[at], reel[i]))
    if (m.open[id] && at > 0) { stage.loadClip(openKey(id)); void warm(id) }   // the file's view (its body, its sealed text, the demo's core) is ready before the tap
    dropViews(openId ? [openId, reel[at]] : [reel[at]])
  }

  // ── the reel: the next stop, one hop at a time ──
  function pump() {
    if (disposed || busy || phase !== 'settled') return
    const target = clamp(want, 0, N - 1)
    if (target === at) return
    if (Math.abs(target - at) === 1) void pan(at, target, false)
    else void pan(at, target, true)
  }
  /** bumped when a tap takes a pan over (takePan): the pan's own landing then does not happen */
  let panToken = 0, taking = false
  async function pan(a: number, b: number, jump: boolean) {
    const tok = panToken
    busy = true; phase = 'panning'; to = b; panK = 0
    const key = `${reel[a]}>${reel[b]}`, clip = jump ? undefined : m.pans[key]
    kick()
    // the stop being panned to: its open clip and its file's view are made in an idle moment of the pan, so that a tap on its Open (taken by takePan) does not wait for them
    const nb = reel[b]
    if (m.open[nb] && b > 0) { stage.loadClip(openKey(nb)); const w = () => { if (!disposed) void warm(nb) }; if (typeof requestIdleCallback === 'function') requestIdleCallback(w, { timeout: 300 }); else setTimeout(w, 150) }
    await stage.run({
      clipKey: clip ? panKey(reel[a], reel[b]) : null, clip: clip ?? null,
      from: stillKey(reel[a]), to: stillKey(reel[b]), duration: FADE_PAN, fade: [0, FADE_PAN],
      onTick: (_t, _i, k) => { panK = k; syncDom() },
    })
    if (disposed || tok !== panToken) return
    at = b; phase = 'settled'; panK = 0; busy = false
    syncDom(); preload(); kick(); pump()
  }
  /**
   * A tap on the stop a pan is heading for (its Open, the cover's door) is taken at once: the pan's picture cross-fades 120 ms to that stop's still, the page layer lands on the stop in the same 120 ms
   * (the pan's progress runs to its end: the marks come to the stop's quad), and the stop is settled for the open to begin. A tap that belongs to any other stop is not taken.
   */
  async function takePan(id: string): Promise<boolean> {
    if (phase !== 'panning' || reel[to] !== id || taking) return false
    taking = true; ++panToken
    const ms = page.reduced ? 0 : 120, k0 = panK, t0 = performance.now()
    if (m.open[id]) { stage.loadClip(openKey(id)); void warm(id); void stage.loadStill(windowKey(id)) }   // (the open's own pictures are fetched while the pan's last frames fade)
    const tween = new Promise<void>((res) => {
      const f = (now: number) => { const k = ms ? Math.min(1, (now - t0) / ms) : 1; panK = k0 + (1 - k0) * k; syncDom(); if (k < 1 && !disposed) requestAnimationFrame(f); else res() }
      requestAnimationFrame(f)
    })
    await Promise.all([stage.abortTo(stillKey(id), ms), tween])
    taking = false
    if (disposed) return false
    at = to; phase = 'settled'; panK = 0; busy = false
    syncDom(); preload(); kick()
    return true
  }

  // ── scrolling ──
  let scrollTimer: ReturnType<typeof setTimeout> | undefined
  let prevY = 0, dir = 0
  function onScroll() {
    const y = scrollY
    if (Math.abs(y - prevY) > 0.5) dir = y > prevY ? 1 : -1
    prevY = y
    if (fileMode) return   // the file page reads the scroll itself (the sticky label, the text that decrypts)
    scrollP = y / view.h
    if (!dom.ix.filled && scrollP > N - 1.3) ensureIndex()   // P6c: the Index is close and not there yet: it is put in now
    if (phase === 'settled' || phase === 'panning') {
      if (progTo === null) want = clamp(sectionWant(scrollP, dir, dom.sections.length), 0, N - 1)
      pump()
    }
    scrolling = true; kick()
    clearTimeout(scrollTimer); scrollTimer = setTimeout(onScrollEnd, 140)
  }
  function onScrollEnd() {
    scrolling = false; dir = 0
    html.classList.remove('ph-nosnap')   // P5
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
  function goTo(section: number, y?: number) {   // P5: `y`: a place inside the section (Contact, in the Index sheet)
    section = clamp(section, 0, dom.sections.length - 1)
    if (phase !== 'settled' && phase !== 'panning') return
    if (section >= dom.sections.length - 1) ensureIndex()   // P6c
    const from = Math.round(scrollP)
    progTo = Math.abs(section - from) > 1 ? section : null
    if (progTo !== null) want = clamp(at, 0, N - 1)
    scrollTo({ top: y ?? section * view.h, behavior: reducedMotion ? 'auto' : 'smooth' })   // P6b
  }
  /** the top bar's Contact: the Index sheet's Contact block, under the bar (P5) */
  function goContact() {
    ensureIndex()   // P6c
    const y = Math.max(0, dom.ix.contact.getBoundingClientRect().top + scrollY - L.barH - 12)
    // (the Index's start is a snap stop that a programmatic scroll from far above would end at: snapping is off until it has arrived)
    html.classList.add('ph-nosnap'); setTimeout(() => html.classList.remove('ph-nosnap'), 2500)
    goTo(dom.sections.length - 1, y)
  }
  /** a row of the Index: the sheet slides down out of the way on the page's spring (~0.3 s), the entry's stop picture is shown (120 ms), its open clip plays (enterFile); the profile goes through the door (P5) */
  function openFromIndex(btn: HTMLButtonElement, e: MouseEvent) {
    const id = btn.dataset.id!
    // a tap while the stage is still finishing a step (a pan that was cut short by the scroll) waits for it, up to 1.5 s, rather than being lost
    if (phase !== 'settled' || busy) { const t0 = performance.now(); const again = () => { if (disposed || performance.now() - t0 > 1500) return; if (phase === 'settled' && !busy) openFromIndex(btn, e); else requestAnimationFrame(again) }; if (phase === 'settled' || phase === 'panning' || phase === 'opening') requestAnimationFrame(again); return }
    if (id === 'YW-000' ? !spaceReady() : !m.open[id]) return
    btn.focus({ preventScroll: true })   // (iOS does not focus a tapped button: the close hands the focus back to this row)
    ixBack = scrollY - dom.ix.sec.offsetTop
    page.slideIndex(1); kick()
    void enterFile(id, { push: true, inputAt: e.timeStamp })
    if (!busy) { ixBack = null; page.slideIndex(0) }   // (it did not start)
  }

  // ── open / close ──
  const lockScroll = (on: boolean) => {
    document.documentElement.classList.toggle('ph-locked', on)
    if (on) document.addEventListener('touchmove', stopMove, { passive: false }); else document.removeEventListener('touchmove', stopMove)
  }
  const stopMove = (e: TouchEvent) => { if (e.cancelable) e.preventDefault() }
  const html = document.documentElement
  /** the page becomes the file: from the top, the reel out of the flow, no snap (the reel's place is remembered as a share of the screen height) */
  function enterFileMode() {
    if (fileMode) return
    fileMode = true
    html.classList.add('ph-filemode')   // P6b: the reel is hidden by `content-visibility` (not inert + visibility: both restyle every element under it, 50 to 70 ms on a slow phone, twice per file)
    scrollTo(0, 0)
  }
  /** back to the reel, in the same task as the picture's last frame: the reel is in the flow again and the page is where it was (at the same share of the screen) */
  function leaveFileMode() {
    if (!fileMode) return
    fileMode = false
    html.classList.remove('ph-filemode')
    if (innerWidth !== view.w || svh() !== view.h) layout()   // P6b: only if the screen changed while the file was read (the same screen gives the same layout)
    const y = ixBack !== null ? Math.max(0, Math.round(dom.ix.sec.offsetTop + ixBack)) : Math.round(origin.sec * view.h); ixBack = null   // P5
    scrollTo(0, y)
    scrollP = y / view.h; prevY = scrollY; dir = 0
  }
  const goPanelFocus = (el: HTMLElement | null) => el?.focus({ preventScroll: true })

  // ── the file page (P3b): any of the 19 stops opens; the view is built (and its text sealed) before the tap ──
  let fileMods: Promise<{ fv: typeof import('./file/fileview'); mount: typeof import('./file/mount') }> | null = null
  const loadFile = () => (fileMods ??= Promise.all([import('./file/fileview'), import('./file/mount')]).then(([fv, mount]) => ({ fv, mount })))
  let visitor: Visitor | null = null
  const audit: [string, string][] = []
  const record = (line: string) => { audit.push([new Date().toLocaleTimeString('en-GB'), line]); if (audit.length > 40) audit.shift() }
  let curView: FileView | null = null
  const bridge: Bridge = {
    get visitor() { return (visitor ??= reconVisitor()) },
    get reduced() { return reducedMotion },   // P6b
    status: (html, ms) => curView?.say(html, ms), record, audit,
    onCapture: () => record(`${(visitor ??= reconVisitor()).id} breached SENTINEL-1`),
    jump: (id) => void jumpTo(id),
  }
  const heightsOf = (id: string) => ({ stop: id === reel[0] ? L.panelC : L.panelS, file: L.panelS })
  /** a panel for any entry: the reel's own, or (for an entry that is not on the reel) one made for the occasion and never put in the reel */
  function panelOf(id: string): Panel {
    let p = dom.panels.get(id)
    if (p) return p
    const copy = stopCopy(id, -1)
    const mk = (parent: HTMLElement, cls: string, text: string, tag: keyof HTMLElementTagNameMap = 'div') => { const l = new Line(parent, cls, text, tag); dom.lines.push(l); return l }
    p = makePanel(document.createElement('section'), copy, -1, (x) => !!m.open[x], mk)
    dom.panels.set(id, p); page.ensure(copy)
    return p
  }
  /** P6b: the views somebody is waiting for (a tap on Open): their steps follow each other without waiting for idle moments */
  const hurry = new Set<string>()
  function warm(id: string): Promise<FileView> {
    let v = views.get(id)
    if (!v) {
      v = (async () => {
        const mods = await loadFile()
        const panel = panelOf(id)
        await prepareFile(dom, id)
        return mods.fv.FileView.create({ dom, stage, entry: entryById.get(id)!, panel, shot: m.open[id], url, winFit, view, heights: heightsOf(id), bridge, mod: mods.mount }, new Slicer(6, () => hurry.has(id)))   // P6b: in steps
      })()
      views.set(id, v)
    }
    return v
  }
  /** take down every view but these */
  function dropViews(keep: string[]) { for (const [k, v] of [...views]) if (!keep.includes(k)) { views.delete(k); void v.then((x) => x.dispose()) } }

  /** one crossfade between two stop pictures (an entry opened from somewhere else, a jump between files) */
  async function crossTo(key: string) {
    stage.pin([key, stillKey(reel[at])])
    await stage.loadStill(key)
    const from = stage.current
    if (!from || from === key) { stage.show(key); return }
    await stage.run({ clipKey: null, clip: null, from, to: key, duration: FADE_STOP, fade: [0, FADE_STOP], onTick: () => {} })
  }

  async function openCore(id: string, o: { push: boolean; inputAt?: number; replace?: boolean }) {
    const sh = m.open[id]
    if (!sh) return
    const my = ++flow
    openId = id; busy = true; phase = 'opening'; tau = 0; shotIndex = 0; shot = sh
    page.showBack(true)   // `← All files` is there, and takes a tap (abortOpen), within ~100 ms
    lockScroll(true)
    if (o.push) pushFile(id); else if (o.replace) history.replaceState({ ph: PUSHED }, '', pathOfId(id))
    stage.pin([stillKey(id), windowKey(id), stillKey(reel[at])]); void stage.loadStill(windowKey(id)); stage.loadClip(closeKey(id))
    kick()
    // two frames first: building the file's view and taking the page out of the reel are one long task, and `← All files` must already be coming in (and tappable) when it starts
    await new Promise<void>((res) => { const t = setTimeout(res, 90); requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); res() })) })
    if (my !== flow || disposed) return
    hurry.add(id)   // P6b
    const v = await warm(id)
    hurry.delete(id)   // P6b
    if (my !== flow || disposed) return
    curView = v; enterFileMode(); v.show()
    record(`${bridge.visitor.id} opened ${id}`)
    await stage.run({
      clipKey: openKey(id), clip: sh,
      from: stillKey(id), to: windowKey(id), duration: sh.frames / sh.fps, fade: FADE_SHOT, inputAt: o.inputAt,
      onTick: (t, i) => { tau = t; shotIndex = i; syncDom(); v.update(t, 'opening') },
    })
    if (my !== flow || disposed) return
    phase = 'file'; tau = Math.max(tau, OPEN_END); shotIndex = sh.quads.length - 1; busy = false
    page.showBack(false)   // (the open's own timing keeps the control from here)
    v.update(OPEN_END, 'file'); v.settle(); lockScroll(false); syncDom(); kick()   // the file scrolls with the document from here
    v.focusHeading()
  }

  /** open an entry from where the visitor is (the reel's stop, the Index, a link): its stop picture first when it is not already on screen */
  async function enterFile(id: string, o: { push: boolean; inputAt?: number }) {
    if (id === 'YW-000' && spaceReady()) return enterSpace(o)
    if (phase === 'panning') await takePan(id)
    if (!m.open[id] || phase !== 'settled' || busy) return
    busy = true
    origin = { sec: scrollY / view.h, opener: document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null }
    lockScroll(true)
    if (stage.current !== stillKey(id)) {
      page.setPlain(id, 1)   // the stop is skipped: its panel is already there when the open begins
      void warm(id); void stage.loadStill(windowKey(id)); stage.loadClip(openKey(id)); stage.loadClip(closeKey(id))
      await crossTo(stillKey(id))
      await Promise.all([stage.buffered(openKey(id), BUFFER_WAIT_MS), stage.stills.ready(windowKey(id))])
      if (disposed) return
    }
    await openCore(id, o)
  }

  async function closeCore(id: string, o: { play: boolean; rate?: number }): Promise<boolean> {
    const sh = m.close[id], v = curView
    const my = ++flow
    await v?.beginClose(bridge.reduced)
    if (my !== flow || disposed) return false
    lockScroll(true); if (innerWidth !== view.w || svh() !== view.h) layout()   // (the toolbar may have moved while it was read: the stage is fitted to the screen as it is now; P6b: only if it did)
    if (!o.play || !sh) {
      // a back gesture (iOS already animated it) or no close clip: land on the end state at once
      stage.finish(); stage.show(stillKey(id)); phase = 'closing'; tau = 0
      v?.update(0, 'closing')
      return true
    }
    busy = true; phase = 'closing'; tau = OPEN_END; shot = sh; shotIndex = 0
    kick()
    await stage.run({
      clipKey: closeKey(id), clip: sh,
      from: windowKey(id), to: stillKey(id), duration: sh.frames / sh.fps, fade: FADE_SHOT, rate: o.rate,
      onTick: (t, i) => { tau = Math.max(0, OPEN_END - t * CLOSE_SPEED); shotIndex = i; syncDom(); v?.update(tau, 'closing') },
    })
    v?.update(0, 'closing')
    return my === flow && !disposed
  }
  async function closeFile(play: boolean) {
    if (phase === 'opening') { void abortOpen(play); return }
    if (phase !== 'file' || !openId) return
    const id = openId
    if (!(await closeCore(id, { play }))) return
    await finishFile(id)
  }
  /**
   * Back (the bar's, Esc, the browser's, a swipe) while the open clip is still playing: the open stops where it stands. The picture goes to the reel's stop still over 180 ms
   * (the related-file grammar), the page layer goes back to the stop in step with it (the open's own animation, run backwards: the marks ride the open's quads back to the stop's,
   * the panel returns), and no close clip plays: there is nothing to re-encrypt yet. A history gesture (`play` false: iOS has already animated it) swaps at once; so does reduced motion.
   * The open reached its window? Then it is the normal close. From the Index the Index sheet is back under the same row; after a related-file jump this lands on the reel's stop, not on the file it came from.
   */
  async function abortOpen(play: boolean) {
    const id = openId
    if (phase !== 'opening' || !id || aborting) return
    aborting = true
    ++flow   // the open's own continuation is void from here
    const ms = play && !bridge.reduced ? 180 : 0
    const v = curView, tau0 = tau, i0 = shotIndex, t0 = performance.now()
    const pageBack = new Promise<void>((res) => {
      const f = (now: number) => {
        const k = ms ? Math.min(1, (now - t0) / ms) : 1
        tau = tau0 * (1 - k); shotIndex = i0 * (1 - k)
        syncDom(); v?.update(tau, 'opening')
        if (k < 1 && !disposed) requestAnimationFrame(f); else res()
      }
      requestAnimationFrame(f)
    })
    await Promise.all([stage.abortTo(stillKey(reel[at]), ms), pageBack])
    aborting = false
    if (disposed) return
    await finishFile(id)
  }
  /**
   * A tap while the close clip is playing (the stop's Open, the cover's door, a tick, the Index, Contact, an Index row) is taken at once: the close stops where it stands, the picture
   * cross-fades 120 ms to the stop's still, the page layer lands on the stop in the same 120 ms (the close's animation run to its end), the shell is settled, and then the tapped action
   * starts. Taps that arrive while this is going on wait for it. Resolves when the shell is settled.
   */
  let closeTake: Promise<void> | null = null
  function takeClose(): Promise<void> {
    if (closeTake) return closeTake
    const id = openId
    if (phase !== 'closing' || !id) return Promise.resolve()
    closeTake = (async () => {
      ++flow   // the close's own continuation is void from here
      const ms = reducedMotion ? 0 : 120
      const tau0 = tau, i0 = shotIndex, iEnd = shot ? shot.quads.length - 1 : i0, v = curView, t0 = performance.now()
      const pageDown = new Promise<void>((res) => {
        const f = (now: number) => {
          const k = ms ? Math.min(1, (now - t0) / ms) : 1
          tau = tau0 * (1 - k); shotIndex = i0 + (iEnd - i0) * k
          syncDom(); v?.update(tau, 'closing')
          if (k < 1 && !disposed) requestAnimationFrame(f); else res()
        }
        requestAnimationFrame(f)
      })
      await Promise.all([stage.abortTo(stillKey(id), ms), pageDown])
      if (!disposed) await finishFile(id)
      closeTake = null
    })()
    return closeTake
  }
  /** back on the reel: the stop the visitor came from is under the page again, the focus is where it was */
  async function finishFile(id: string) {
    const home = stillKey(reel[at])
    if (stillKey(id) !== home) await crossTo(home)
    if (disposed) return
    const opener = origin.opener
    const v = curView; views.delete(id); v?.dispose()
    phase = 'settled'; busy = false; tau = 0; shotIndex = 0; shot = null; panK = 0; openId = null; curView = null
    dropViews([])
    leaveFileMode(); page.showBack(false); page.setFileBar(false); page.slideTo(0); page.slideIndex(0)   // P5: (the Index sheet, if the file came from it, slides back in)
    lockScroll(false)
    syncDom(); kick()
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!disposed) preload() }))   // P6b: the stills and clips for this stop are asked for two frames later (the close's last frame is already heavy)
    const back = opener && document.contains(opener) ? opener : dom.panels.get(reel[at])?.open ?? null
    goPanelFocus(back)
    pump()
  }
  /** a related file: close this one at 1.5x, show the other's stop (120 ms), open it (plan 2.6) */
  async function jumpTo(id: string) {
    if (phase !== 'file' || !openId || !m.open[id] || id === openId || busy) return
    const a = openId
    void warm(id); void stage.loadStill(windowKey(id)); stage.loadClip(openKey(id))   // B's open clip buffers while A closes
    if (!(await closeCore(a, { play: true, rate: JUMP_RATE }))) return
    const va = curView; views.delete(a); va?.dispose()
    openId = id; page.setPlain(id, 1); curView = null
    await crossTo(stillKey(id))
    await Promise.all([stage.buffered(openKey(id), BUFFER_WAIT_MS), stage.stills.ready(windowKey(id))])
    if (disposed) return
    await openCore(id, { push: false, replace: true })
  }

  // ── the profile drive's door and interior (P3c): YW-000 has no open clip; it goes through the door ──
  let space: PhoneSpace | null = null
  const reducedNow = () => reducedMotion   // P6b
  const spaceReady = () => !!m.space && !!m.door?.['YW-000']
  const spaceHost: SpaceHost = {
    m, stage, page, dom, url,
    view: () => view, winFit: () => winFit, coverFit: () => fits[0], coverRest: () => rest(0), coverStill: stillKey('YW-000'),
    reduced: reducedNow, visitor: () => bridge.visitor, audit,
    cut: () => spaceCut(), go: (id) => void spaceGo(id),
    warmFile: (id) => { if (!m.open[id]) return; void warm(id); void stage.loadStill(windowKey(id)); stage.loadClip(openKey(id)) },
  }
  // (one instance, however many callers ask before the chunk has arrived: the cover's warm-up and the door's entry may overlap)
  let spaceLoad: Promise<PhoneSpace> | null = null
  const loadSpace = () => (spaceLoad ??= import('./space/PhoneSpace').then((mod) => (space = new mod.PhoneSpace(spaceHost))))
  /** the interior's data and paper are made while the cover is on screen, so the door does not wait for them */
  async function warmSpace() { try { await (await loadSpace()).init() } catch { /* the door will say so */ } }
  async function enterSpace(o: { push: boolean; inputAt?: number }) {
    if (phase === 'panning') await takePan('YW-000')
    if (!spaceReady() || phase !== 'settled' || busy) return
    busy = true
    origin = { sec: scrollY / view.h, opener: document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null }
    lockScroll(true)
    const sp = await loadSpace()
    // the cover's picture first (a cold link, the Index): the door starts from it
    if (stage.current !== stillKey('YW-000')) await crossTo(stillKey('YW-000'))
    if (disposed) return
    openId = 'YW-000'; phase = 'space'; tau = 0; shot = null
    if (o.push) pushFile('YW-000')
    page.slideTo(1); kick()
    record(`${bridge.visitor.id} opened YW-000`)
    sp.enter().catch((err: unknown) => { console.error('the interior could not be shown', err); void closeSpace(false) })
  }
  /** the door has played: the page is the interior's page from here (the reel is out of the flow, the bar is the file bar, the page scrolls) */
  function spaceCut() {
    enterFileMode()
    page.setFileBar(true); page.ownLabel('YW-000')
    lockScroll(false)
    busy = false
    space?.sheet.querySelector<HTMLElement>('.ph-sp-title')?.focus({ preventScroll: true })
  }
  /** back to the cover: the way out plays (or, for a back gesture the browser has already animated, the cover is simply there) */
  async function closeSpace(play: boolean, o: { rate?: number; keep?: boolean; to?: string } = {}) {
    if (phase !== 'space' || !space) return
    busy = true; lockScroll(true)
    if (scrollY > 0 && !o.to) scrollTo(0, 0)
    if (play) await (o.to ? space.leaveToFile(o.to, { rate: o.rate }) : space.leave({ rate: o.rate })); else await space.leaveNow()
    if (disposed) return
    finishSpace(!!o.keep)
  }
  function finishSpace(keep: boolean) {
    const opener = origin.opener
    phase = 'settled'; busy = false; openId = null; tau = 0; shot = null
    page.ownLabel(null)
    if (keep) return   // a jump to a file: the page stays the file's, the cover's paper stays out until that file is closed
    leaveFileMode(); page.setFileBar(false); page.slideTo(0); page.slideIndex(0)   // P5: (the Index sheet, if the file came from it, slides back in)
    lockScroll(false)
    syncDom(); preload(); kick()
    const cp = dom.panels.get(reel[0])
    goPanelFocus(opener && document.contains(opener) ? opener : cp?.el.querySelector<HTMLElement>('.ph-door') ?? null)
    pump()
  }
  /** `Open X-…` from the interior: the way out at 1.5x, the target's stop picture for 120 ms, then its file (the related-file path) */
  async function spaceGo(id: string) {
    if (phase !== 'space' || !m.open[id]) return
    void warm(id); void stage.loadStill(windowKey(id)); stage.loadClip(openKey(id)); stage.loadClip(closeKey(id))
    // out-i at 1.5x, a 180 ms crossfade to the target's stop picture, then its open clip (no exit to the cover on the way)
    page.setPlain(id, 1)
    await closeSpace(true, { rate: JUMP_RATE, keep: true, to: stillKey(id) })
    if (disposed) return
    openId = id
    // the target's paper comes in with its stop picture (180 ms), not in one frame
    const pe = dom.panels.get(id)?.el
    if (pe && !reducedNow()) pe.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'linear' })
    await crossTo(stillKey(id))
    await Promise.all([stage.buffered(openKey(id), BUFFER_WAIT_MS), stage.stills.ready(windowKey(id))])
    if (disposed) return
    await openCore(id, { push: false, replace: true })
  }
  /** whatever is open, closed: the interior or a file */
  const closeCurrent = (play: boolean) => (phase === 'space' ? closeSpace(play) : closeFile(play))

  /** the in-page "← All files": through history when this shell pushed the entry (so Back and the button agree), plain otherwise */
  function backButton() {
    if (phase !== 'file' && phase !== 'space' && phase !== 'opening') return
    if (pushedByUs()) {
      buttonClose = true
      history.back()
      setTimeout(() => { if (buttonClose && (phase === 'file' || phase === 'space' || phase === 'opening')) { buttonClose = false; toBrowse(); void closeCurrent(true) } }, 500)
    } else { toBrowse(); void closeCurrent(true) }
  }
  function onPop() {
    const id = idFromPath(location.pathname)
    if (!id || (!m.open[id] && !(id === 'YW-000' && spaceReady()))) {
      if (phase === 'file' || phase === 'opening' || phase === 'space') { const play = buttonClose; buttonClose = false; void closeCurrent(play) }
      return
    }
    if (phase === 'file' || phase === 'opening' || phase === 'space' || busy) return
    const ix = reel.indexOf(id)
    if (ix >= 0 && ix !== at) { stage.show(stillKey(id)); at = ix; to = ix; want = ix; scrollTo({ top: ix * view.h, behavior: 'auto' }); syncDom(); preload() }
    void enterFile(id, { push: false })
  }

  // ── the entrance (first visit, plan §2.6): the sealed entry page holds until the clip can play through, then the clip plays under it and the page leaves over its first frames ──
  const ENTRANCE_MIN_HAVE = 0.3, ENTRANCE_WAIT_MS = 2000, GATE_FADE_S = 0.45, GATE_FADE_REDUCED_S = 0.25
  const playable = async (v: HTMLVideoElement | undefined, ms: number) => {
    if (!v) return false
    if (v.readyState < 4) await new Promise<void>((res) => { const f = () => { clearTimeout(t); v.removeEventListener('canplaythrough', f); res() }; const t = setTimeout(f, ms); v.addEventListener('canplaythrough', f) })
    return v.readyState >= 4
  }
  const fadeAway = (el: HTMLElement, seconds: number) => new Promise<void>((res) => {
    const t0 = performance.now()
    const step = (now: number) => {
      const k = clamp((now - t0) / 1000 / seconds, 0, 1)
      el.style.opacity = String(1 - smooth(k))
      if (k < 1 && !disposed) requestAnimationFrame(step); else { el.style.opacity = '0'; res() }
    }
    requestAnimationFrame(step)
  })
  async function enter(gate: HTMLElement, o: EnterOptions) {
    const lg = entry!.log; lg.enterAt = performance.now()
    // the sealed page holds (no blank, no spinner); past 1.2 s it says, in the words it already has, what it is waiting for
    const note = setTimeout(() => gate.classList.add('waiting'), 1200)
    await readyP
    if (disposed) { clearTimeout(note); return }
    const cover = stillKey(reel[0]), clip = m.entrance
    let via: 'clip' | 'fade' = 'fade'
    if (stage.mode === 'clips' && !o.reduced && clip) {
      // hold on the sealed page (no blank, no spinner) until the entrance can play through; a slow network gives up and cross-fades
      const t0 = performance.now()
      if (!stage.pool.holding(entranceKey)) stage.loadClip(entranceKey)
      const v = stage.pool.holding(entranceKey)
      // waiting is for a clip that is nearly there: one that is hardly begun on a slow network is not worth the wait
      const have = v && v.duration > 0 && v.buffered.length ? v.buffered.end(v.buffered.length - 1) / v.duration : 0
      if (v && (v.readyState >= 4 || have >= ENTRANCE_MIN_HAVE) && await playable(v, ENTRANCE_WAIT_MS)) via = 'clip'
      lg.clipWaitMs = performance.now() - t0
    }
    clearTimeout(note); gate.classList.remove('waiting')
    lg.via = via
    let gone: Promise<void> | null = null
    const leave = () => { if (!gone) gone = fadeAway(gate, via === 'clip' ? GATE_FADE_S : o.reduced ? GATE_FADE_REDUCED_S : GATE_FADE_S); return gone }
    let ran: Promise<unknown> = Promise.resolve()
    if (via === 'clip') {
      // the cover waits under the clip; the page leaves once the clip's first frame is on screen (or the step has fallen back to a cross-fade)
      let framed!: () => void
      const onFrame = new Promise<void>((r) => { framed = r })
      ran = stage.run({
        clipKey: entranceKey, clip, from: '', to: cover, duration: clip.frames / clip.fps, fade: FADE_SHOT,
        onFirstFrame: () => { lg.firstFrameAt = performance.now(); framed() }, onTick: () => {},
      })
      await Promise.race([onFrame, ran])
      if (!lg.firstFrameAt) lg.firstFrameAt = performance.now()
    } else { stage.show(cover); lg.firstFrameAt = performance.now() }
    await leave()
    if (disposed) return
    // the page is gone; the entrance (if any) plays on, then the paper rises over the cover
    void ran.then(() => {
      if (disposed) return
      lg.coverAt = performance.now()
      stage.show(cover)
      root.removeAttribute('data-entering'); root.inert = false; riseOn = true; document.documentElement.classList.remove('ph-entry'); kick()   // P5: the page is reachable again
      if (via === 'fade') stage.pool.release(new Set())   // (the entrance was given up on: stop fetching it)
      preload()
    })
  }

  // ── listeners ──
  const prime = () => stage.prime()
  const onResize = () => {
    if (innerWidth === view.w && svh() === view.h) return   // P6a: only the toolbar moved: the layout is the small viewport's and stays
    if (landscapeNow) return   // P5: in landscape the page is not laid out again (the notice covers it; turning back finds it as it was)
    if (visualViewport && visualViewport.scale > 1.01) return
    if (fileMode && phase === 'file' && Math.abs(innerWidth - view.w) < 1) return   // Safari's toolbar sliding while a file is read: only the height moves, the page stays as it is
    layout(); kick()
  }
  const onVis = () => { if (document.hidden) { stage.suspend(); space?.suspend() } else { stage.resume(); space?.wake(); kick() } }
  const onShow = (e: PageTransitionEvent) => { if (e.persisted) { stage.resync(); if (phase === 'space') void space?.resync(); layout(); preload(); kick() } }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && (phase === 'file' || phase === 'space' || phase === 'opening')) backButton() }
  const mq = matchMedia('(orientation: landscape)')
  // P5: in landscape the notice covers a page that does not scroll; turning upright puts the page back exactly where it was (the same size gives the same pixel, another size the same share)
  let landSaved: { y: number; w: number; h: number } | null = null, portraitY = 0, portraitW = innerWidth, portraitH = innerHeight
  const trackY = () => { if (!landscapeNow) { portraitY = scrollY; portraitW = view.w; portraitH = view.h } }
  addEventListener('scroll', trackY, { passive: true })
  const onOrient = () => {
    landscapeNow = mq.matches
    if (mq.matches) {
      landSaved ??= { y: portraitY, w: portraitW, h: portraitH }
      root.setAttribute('data-land', ''); html.classList.add('ph-landscape')
    } else {
      root.removeAttribute('data-land'); html.classList.remove('ph-landscape')
    }
    layout()
    if (!mq.matches && landSaved) {
      const s = landSaved; landSaved = null
      const back = () => { const y = Math.abs(view.w - s.w) < 2 && Math.abs(view.h - s.h) < 2 ? s.y : s.y / s.h * view.h; scrollTo(0, Math.round(y)); scrollP = scrollY / view.h; prevY = scrollY }
      back(); setTimeout(() => { if (!mq.matches && !disposed) { layout(); back() } }, 160)
    }
  }
  const onClick = (e: MouseEvent) => {
    // a tap during a close lands on the file layer's shield (it is over everything until the close is done): the close is taken over first (takeClose), and then the tap goes to what is under that
    // point now, as if it had been made there
    if (phase === 'closing') {
      const x = e.clientX, y = e.clientY
      void takeClose().then(() => { if (!disposed) document.elementFromPoint(x, y)?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, view: window })) })
      return
    }
    const t = (e.target as HTMLElement).closest('button')
    if (!t) {
      // a tap on the cover's drive (inside its reticle, not on the paper or the bar) opens the profile
      const el = e.target as HTMLElement
      if (((phase === 'settled' && at === 0 && !busy) || (phase === 'panning' && to === 0)) && spaceReady() && !el.closest('a, .ph-sheet, .ph-panel, .ph-bar')) {
        const r = rest(0)
        if (e.clientX >= r.x0 && e.clientX <= r.x1 && e.clientY >= r.y0 && e.clientY <= r.y1) void enterSpace({ push: true, inputAt: e.timeStamp })
      }
      return
    }
    if (t.classList.contains('ph-door')) void enterSpace({ push: true, inputAt: e.timeStamp })
    else if (t.classList.contains('ph-go')) { void enterFile(t.dataset.id!, { push: true, inputAt: e.timeStamp }) }
    else if (t.classList.contains('ph-tick')) goTo(Number(t.dataset.stop))
    else if (t.dataset.go === 'index') goTo(dom.sections.length - 1)
    else if (t.dataset.go === 'contact') goContact()   // P5
    else if (t.classList.contains('ph-ix')) openFromIndex(t as HTMLButtonElement, e)   // P5
    else if (t.classList.contains('ph-back')) backButton()
  }
  root.addEventListener('click', onClick)
  for (const t of ['touchend', 'pointerup', 'click']) document.addEventListener(t, prime, { passive: true })
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onResize); visualViewport?.addEventListener('resize', onResize)
  addEventListener('popstate', onPop); addEventListener('pageshow', onShow); addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVis)
  mq.addEventListener('change', onOrient)
  const mqR = matchMedia('(prefers-reduced-motion: reduce)')   // P5: reduced motion is stills and crossfades everywhere
  const onReduced = () => { stage.setReduced(mqR.matches); kick() }
  mqR.addEventListener('change', onReduced); stage.setReduced(mqR.matches)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

  // ── start ──
  const route = idFromPath(location.pathname)
  /** a cold link to a file: every entry that has an open clip opens (on the reel, or from the Index when it is not on the reel) */
  const coldId = route && m.open[route] ? route : null
  const coldIx = coldId ? reel.indexOf(coldId) : -1
  /** a cold link to the profile goes through the door (it shows the cover first; no entry page, no entrance) */
  const coldSpace = route === 'YW-000' && spaceReady()
  if (route && !coldId && !coldSpace) toBrowse()
  at = to = want = coldIx >= 0 ? coldIx : coldId ? N - 1 : 0
  await nextTask()   // P6c
  onOrient()
  layout()
  void document.fonts?.ready.then(() => { if (!disposed) { layout(); kick() } })
  const first = coldId ?? reel[at]
  if (entry) { root.setAttribute('data-entering', ''); root.setAttribute('data-barwait', ''); root.inert = true; entry.attach({ prime, enter }) }   // (the first touch may come before the cover is in); P5: nothing behind the entry page is reachable by keyboard or reader
  stage.pin([stillKey(first)])
  await stage.loadStill(stillKey(first))
  await Promise.all(dom.lines.map((l) => l.ready))
  if (disposed) return { dispose() {} }
  if (coldId && coldIx < 0) { ensureIndex(); scrollTo({ top: N * view.h, behavior: 'auto' }) }   // an entry that is not on the reel belongs to the Index
  else if (at > 0) scrollTo({ top: at * view.h, behavior: 'auto' })
  scrollP = scrollY / view.h; prevY = scrollY
  // a return visit: the paper rises over 0.4 s; a cold link to a file: its panel is already there; a first visit: it waits for the entrance
  if (entry) { rise = 0; riseOn = false } else stage.show(stillKey(first))
  if (coldId || coldSpace) { page.setPlain(first, 1); rise = 1 } else if (!entry) { rise = 0; riseOn = true }
  syncDom()
  root.setAttribute('data-ready', '')
  if (entry) {
    // the entrance is attached now (after the cover, so the cover has the network first), and the gate may proceed
    if (stage.mode === 'clips' && m.entrance) stage.loadClip(entranceKey)
    ready()
  } else preload()
  kick()

  if (coldId) {
    // the stop's picture, then its open clip (buffered if it can be, else a crossfade), then the file
    void stage.loadStill(windowKey(first)); stage.loadClip(openKey(first)); void warm(first)
    await Promise.all([stage.buffered(openKey(first), COLD_WAIT_MS), stage.stills.ready(windowKey(first)), warm(first)])
    if (!disposed) void enterFile(coldId, { push: false })
  }

  if (coldSpace) {
    await warmSpace()
    if (!disposed) void enterSpace({ push: false })
  }

  // the cover's panel is a button too (the whole panel opens the profile)
  const coverPanel = dom.panels.get('YW-000')
  if (coverPanel && spaceReady()) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ph-door'; b.dataset.id = 'YW-000'
    b.setAttribute('aria-label', 'Open the profile: six areas of work')
    Object.assign(b.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', zIndex: '2', background: 'transparent' })
    coverPanel.el.appendChild(b)
  }

  const api = {
    get space() { return space },
    land: () => ({ landSaved, portraitY, ixBack }),   // P5 (for the tests)
    get phase() { return phase }, get at() { return at }, get want() { return want }, get busy() { return busy },
    get mode() { return stage.mode }, get ready() { return root.hasAttribute('data-ready') },
    stage, page, dom, manifest: m, csp, entry: entry?.log, layout: L, get fits() { return fits }, get winFit() { return winFit }, get view() { return view },
    get tau() { return tau }, get panK() { return panK }, get shotIndex() { return shotIndex },
    marks: () => dom.marks.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }),
    openFile: (i: number) => enterFile(reel[i], { push: true }), openEntry: (id: string) => enterFile(id, { push: true }), jumpTo,
    get openId() { return openId }, get file() { return curView }, closeFile: (play = true) => backOrClose(play), goTo,
    pathOf: pathOfId,
  }
  function backOrClose(play: boolean) { if (play) backButton(); else { toBrowse(); void closeFile(false) } }
  if (HOOKS && flags.expose) (window as unknown as { __phone?: typeof api }).__phone = api   // a test hook: compiled out of a production build

  return {
    dispose() {
      disposed = true
      cancelAnimationFrame(raf); clearTimeout(scrollTimer)
      lockScroll(false); html.classList.remove('ph-filemode'); space?.dispose()
      root.removeEventListener('click', onClick)
      for (const t of ['touchend', 'pointerup', 'click']) document.removeEventListener(t, prime)
      removeEventListener('scroll', trackY); removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); visualViewport?.removeEventListener('resize', onResize)   // P5
      removeEventListener('popstate', onPop); removeEventListener('pageshow', onShow); removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('securitypolicyviolation', onCsp)
      mq.removeEventListener('change', onOrient); mqR.removeEventListener('change', onReduced)   // P5
      stage.dispose(); root.remove()
      if (HOOKS && flags.expose && (window as unknown as { __phone?: unknown }).__phone === api) delete (window as unknown as { __phone?: unknown }).__phone
    },
  }
}
