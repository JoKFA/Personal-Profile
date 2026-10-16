// PhoneSpace (P3c): the profile drive's door and interior on the phone. Everything on screen is baked from the real engine (the door, the intro, six
// stations, the flights between them, the way out and in through the hub, the way back to the cover); this file plays those clips in the order a
// visit needs, rides the page layer on their frames (the chips on the baked anchors, the reticle on the door's face quads), and keeps the
// show's state (which station, which step, what has been produced). No three.js: the words and the pace are space/content.ts and space/station.ts.
import type { Visitor } from '../../../visitor'
import type { Pt, Rect, SpaceExit, SpaceManifest, Shot } from '../../manifest'
import { damp, spring } from '../../../motion/spring'
import { lerpFit, toScreen, type Fit } from '../fit'
import { Slicer, idleSlot, nextTask } from '../idle'   // P6b
import { loadSpaceMount } from '../early'   // P7f
import type { PageDom, PageLayer } from '../page'
import type { PhoneManifest } from '../../manifest'
import type { Stage } from '../stage/stage'
import { BodyDecrypt } from './decrypt'
import { ChipLayer } from './chips'
import { ClipPlayer } from './player'
import { AREA_CONTENT } from '../../../space/content'
import { AREAS, K, RESULT_AT, at as tableAt, marksOpacity, pAt, pickSegs, stepOf, tourSegs, quadAt, ridePoints, type Box, type Seg } from './model'
import type { SheetActions, SheetState, SheetStore } from './SpaceSheet'

export interface SpaceHost {
  m: PhoneManifest
  stage: Stage
  page: PageLayer
  dom: PageDom
  url(file: string): string
  view(): { w: number; h: number }
  winFit(): Fit
  coverFit(): Fit
  /** the cover stop's reticle on screen (where the marks are at rest) */
  coverRest(): Rect
  coverStill: string
  reduced(): boolean
  visitor(): Visitor
  audit: [string, string][]
  /** the door has played: the page becomes the interior's page (the reel goes out of the flow, the bar becomes the file bar) */
  cut(): void
  /** `Open X-…`: leave the interior (the exit at 1.5x) and open that file */
  go(id: string): void
  /** the file a result links to is fetched now (its open clip and window picture), so `Open X-…` does not wait for it */
  warmFile(id: string): void
}
export type Mode = 'idle' | 'door' | 'intro' | 'station' | 'fly' | 'out' | 'in' | 'hub' | 'rest' | 'held' | 'exit'

const BAR_GAP = 4
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class PhoneSpace {
  S!: SpaceManifest
  mode: Mode = 'idle'
  /** the station on screen, and the one last looked at (a later visit returns to it) */
  area = 0
  lastArea = 0
  retained: boolean[] = Array(AREAS).fill(false)
  order: number[] = []
  visited = false
  readonly sheet: HTMLElement
  chips!: ChipLayer
  player!: ClipPlayer
  /** what the page lays out: the interior's region (screen px) */
  region: Box = { l: 0, t: 0, r: 0, b: 0 }
  /** the last frame the chips were drawn for (a resize redraws them) */
  last: { i: number; pos: number; end: boolean; live: boolean } | null = null
  /** a seek or a station's frame the tests may ask for */
  frameLog: { kind: string; pos: number; t: number }[] = []

  private host: SpaceHost
  private urls = new Map<string, string>()
  private token = 0
  private ui: SheetState
  private listeners = new Set<() => void>()
  private ready: Promise<void> | null = null
  private decrypt: BodyDecrypt | null = null
  private unmount: (() => void) | null = null
  private restTop = 0
  private cut = false
  private trail: SVGSVGElement | null = null
  private off: (() => void)[] = []
  private resultSeen = new Set<number>()
  /** the app is scrolling the page itself (bringIn): the reading pause is not for that */
  private autoScroll = 0
  private barBack = false
  private cancelScroll: (() => void) | null = null

  constructor(host: SpaceHost) {
    this.host = host
    this.ui = { area: 0, step: 0, playing: false, reason: '', tour: false, travelling: false, result: false, retained: this.retained.slice(), count: 0, live: false }
    this.sheet = document.createElement('div'); this.sheet.className = 'ph-space'; this.sheet.hidden = true
    host.dom.root.appendChild(this.sheet)
  }

  // ── what the paper reads ──
  readonly store: SheetStore = { get: () => this.ui, subscribe: (f) => { this.listeners.add(f); return () => { this.listeners.delete(f) } } }
  private setUi(patch: Partial<SheetState>) {
    const n = { ...this.ui, ...patch, retained: this.retained.slice(), count: this.order.length }
    const same = (Object.keys(n) as (keyof SheetState)[]).every((k) => (k === 'retained' ? n.retained.every((v, i) => v === this.ui.retained[i]) : n[k] === this.ui[k]))
    if (same) return
    this.ui = n
    this.listeners.forEach((f) => f())
  }
  get state() { return this.ui }

  // ── loading: the interior's pictures are described by their own JSON, fetched when YW-000 is entered ──
  init(): Promise<void> {
    return (this.ready ??= (async () => {
      const { m, stage } = this.host
      if (!m.space) throw new Error('no interior in the manifest')
      const S = await (await fetch(this.host.url(m.space.file))).json() as SpaceManifest
      this.S = S
      const door = m.door?.['YW-000']
      if (!door) throw new Error('no door in the manifest')
      const clip = (key: string, file: string) => this.urls.set(key, this.host.url(file))
      clip(K.door, door.file); clip(K.intro, S.intro.file); clip(K.exit, S.exit.file)
      S.stations.forEach((st, i) => { clip(K.st(i), st.clip.file); stage.register(K.rest(i), this.host.url(st.rest.file)) })
      for (const [k, c] of Object.entries(S.fly)) clip(K.fly(Number(k.split('>')[0])), c.file)
      for (const [k, c] of Object.entries(S.out)) clip(K.out(Number(k)), c.file)
      for (const [k, c] of Object.entries(S.in)) clip(K.in(Number(k)), c.file)
      stage.register(K.hub, this.host.url(S.hub.file))
      this.player = new ClipPlayer(stage, (key) => this.urls.get(key))
      this.chips = new ChipLayer(this.host.dom.root)
      this.layout()
      const { mountSheetAsync } = await loadSpaceMount()
      const sl = new Slicer(6, () => true)   // P6b: the paper is built in steps
      const thumbs: Record<number, string> = {}
      S.stations.forEach((st, i) => { thumbs[i] = this.host.url(st.thumb.file) })
      const actions: SheetActions = {
        pick: (i) => void this.pick(i), step: (n) => void this.step(n), toggle: () => this.toggle(), replay: () => void this.replay(),
        go: (id) => this.host.go(id), evidence: () => this.sheet.querySelector('#ph-sp-evidence')?.scrollIntoView({ behavior: this.host.reduced() ? 'auto' : 'smooth', block: 'start' }),
      }
      await nextTask()
      const mounted = await mountSheetAsync(this.sheet, { store: this.store, actions, thumbs, visitor: this.host.visitor(), audit: this.host.audit })
      this.unmount = mounted.unmount
      this.decrypt = new BodyDecrypt(this.sheet.querySelector<HTMLElement>('.ph-sp-body')!, this.host.reduced())
      await nextTask()
      await this.decrypt.seal(sl)
      this.trail = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.trail.setAttribute('class', 'ph-sp-trail'); this.trail.setAttribute('aria-hidden', 'true')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('pathLength', '1'); this.trail.appendChild(path)
      this.host.dom.root.appendChild(this.trail)
      // reading the profile pauses the show (as on the desktop): a scroll well away from where the last command left the page
      const scroll = () => { if (this.cut && !this.autoScroll && Math.abs(scrollY - this.restTop) > 40) this.pauseFor('reading') }
      const rest = () => { this.restTop = scrollY }
      addEventListener('scroll', scroll, { passive: true })
      const grab = () => this.cancelScroll?.()   // a finger or a wheel takes the page back from the app's own scroll
      addEventListener('touchstart', grab, { passive: true }); addEventListener('wheel', grab, { passive: true })
      this.sheet.addEventListener('pointerdown', rest, true); this.sheet.addEventListener('keydown', rest, true)
      this.off.push(() => removeEventListener('scroll', scroll), () => { removeEventListener('touchstart', grab); removeEventListener('wheel', grab) }, () => { this.sheet.removeEventListener('pointerdown', rest, true); this.sheet.removeEventListener('keydown', rest, true) })
      void this.prelayout()   // P6b
    })())
  }

  // ── P6b: the paper is laid out hidden, one part per idle moment, and stays laid out between visits ──
  private prelaid = false
  private topSet = ''
  private async prelayout(): Promise<void> {
    if (this.prelaid || !this.sheet.hidden) return
    const sh = this.sheet
    const parts = [...sh.querySelectorAll<HTMLElement>('.ph-sp > *, .ph-sp-body > .ph-fb-in > *')]
    for (const p of parts) p.setAttribute('data-cold', '')
    sh.classList.add('ph-pre'); sh.hidden = false
    for (const p of parts) {
      await idleSlot(300)
      if (this.cut || !sh.classList.contains('ph-pre')) return   // (the door opened first: doCut shows it all)
      p.removeAttribute('data-cold'); p.getBoundingClientRect()   // (this part is laid out now, in this task)
    }
    this.prelaid = true
  }
  private shown() { return !this.sheet.hidden && !this.sheet.classList.contains('ph-pre') }

  // ── geometry: the window rule (s = W / 480, top aligned); the subject's region is master y 64-536, the paper starts under it ──
  layout() {
    if (!this.S) return
    const { w } = this.host.view(), fit = this.host.winFit(), r = this.S.region.rect
    const barB = Math.max(this.host.dom.bar.offsetHeight, 64)
    this.region = { l: 8, r: w - 8, t: Math.max(barB + BAR_GAP, r.y0 * fit.s + fit.ty + BAR_GAP), b: r.y1 * fit.s + fit.ty - BAR_GAP }
    // (P6b: a custom property written on the paper restyles everything under it, so it is written only when it changes)
    const top = `${(r.y1 * fit.s + fit.ty).toFixed(1)}px`
    if (top !== this.topSet) { this.topSet = top; this.sheet.style.setProperty('--ph-sp-top', top) }
    this.redraw()
  }
  /** a resize or a rotation: the chips are laid out again for the frame that is on screen */
  redraw() {
    const l = this.last
    if (l && this.chips) this.chips.update(l.pos, l.live, this.host.winFit(), this.region, l.end)
  }

  // ── entering: the door, the cut, the intro and (the first visit) the tour ──
  async enter(): Promise<void> {
    await this.init()
    const token = ++this.token
    const first = !this.visited
    this.visited = true; this.cut = false
    const { stage } = this.host
    const clips = !this.host.reduced() && stage.mode === 'clips'
    const area = first ? 0 : this.lastArea
    this.area = area; this.resultSeen.clear()
    this.setUi({ area, step: 0, live: false, travelling: false, result: false, playing: clips, reason: '', tour: first && clips })
    this.chips.setStation(null); this.last = null
    stage.pin([this.host.coverStill, K.hub, K.rest(area)]); void stage.loadStill(K.rest(area)); void stage.loadStill(K.hub)
    if (clips) {
      this.preload(K.door, K.intro, K.st(area === 0 ? 0 : area))
      this.mode = 'door'
      const door = this.host.m.door!['YW-000']
      const r = await this.player.play(K.door, door, { from: this.host.coverStill, onFrame: (pos) => this.doorFrame(door, pos) })
      if (token !== this.token) return
      if (r === 'done') {
        this.doCut()
        const segs = area === 0 ? tourSegs(this.S, 0, true).slice(0, first ? undefined : 2) : tourSegs(this.S, 0, true).slice(0, 1)
        const end = await this.runChain(segs, token, { land: area === 0 ? 'rest' : 'none' })
        if (token !== this.token || end !== 'done') return
        if (area !== 0) {
          await this.player.land(K.hub); this.mode = 'hub'; this.setUi({ travelling: true })
          await sleep(300); if (token !== this.token) return
          await this.runChain(pickSegs(this.S, null, area), token, { land: 'rest', from: K.hub })
        }
        return
      }
      this.degrade()
    }
    await this.enterStills(token, area)
  }

  /** the door: the stage goes from the cover's framing to the window's by the shot's camera, the reticle rides the drive's face until it outgrows the screen */
  private doorFrame(d: Shot, pos: number) {
    const cam = tableAt(d.cam, pos)
    this.rideFace(d.quads, pos, cam)
    this.log('door', pos)
  }
  private rideFace(quads: Pt[][], pos: number, cam: number) {
    const { stage, page } = this.host
    const fit = lerpFit(this.host.coverFit(), this.host.winFit(), cam)
    stage.setFit(fit)
    if (!quads.length || !quads[Math.min(quads.length - 1, Math.floor(pos))]?.length) { page.placeMarks(ridePoints(this.host.coverRest(), [], 0), this.host.coverRest(), 0); return }
    const q = quadAt(quads, pos).map((p) => toScreen(fit, p))
    const lock = Math.min(1, cam / 0.16), k = lock * lock * (3 - 2 * lock)
    page.placeMarks(ridePoints(this.host.coverRest(), q, k), this.host.coverRest(), marksOpacity(q, this.host.view().w, (p) => p))
  }
  private doCut() {
    this.cut = true
    this.host.cut()
    this.host.page.placeMarks(ridePoints(this.host.coverRest(), [], 0), this.host.coverRest(), 0)
    this.host.stage.setFit(this.host.winFit())
    this.layout()
    this.sheet.classList.remove('ph-pre'); for (const p of this.sheet.querySelectorAll('[data-cold]')) p.removeAttribute('data-cold')   // P6b
    this.sheet.hidden = false
    this.decrypt?.begin()   // P6b
    this.restTop = scrollY
    if (!this.host.reduced()) this.sheet.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' })
  }

  // ── running clips in order ──
  private preload(...keys: string[]) { for (const k of keys) this.player.load(k) }
  private log(kind: string, pos: number) { if (this.host.stage.record) { this.frameLog.push({ kind, pos, t: performance.now() }); if (this.frameLog.length > 4000) this.frameLog.shift() } }

  /**
   * Play `segs` one after the other with no still between them (each clip's video is held until the next one's first frame is up), then land.
   * A clip that cannot start (not buffered in 3 s, play refused) turns the rest into stills.
   */
  private async runChain(segs: Seg[], token: number, o: { land: 'rest' | 'hub' | 'none'; from?: string; crossMs?: number; rate?: number }): Promise<'done' | 'aborted' | 'failed'> {
    for (let k = 0; k < segs.length; k++) {
      const seg = segs[k]
      this.arrive(seg)
      const nextKeys = segs.slice(k + 1, k + 3).map((s) => s.key); this.preload(...nextKeys)
      const r = await this.player.play(seg.key, seg.clip, {
        from: k === 0 ? o.from : undefined, crossMs: k === 0 ? o.crossMs : undefined, rate: o.rate,
        onFrame: (pos) => this.frame(seg, pos),
      })
      if (token !== this.token) return 'aborted'
      if (r === 'aborted') return 'aborted'
      if (r === 'failed') { this.degrade(); await this.settleStills(segs.slice(k), token); return 'failed' }
      this.segDone(seg)
    }
    const last = segs[segs.length - 1]
    if (o.land === 'rest' && last.kind === 'station') await this.landRest(last.i)
    else if (o.land === 'hub') { await this.player.land(K.hub); this.mode = 'hub'; this.chips.hide(); this.last = null; this.setUi({ travelling: true }) }
    return token === this.token ? 'done' : 'aborted'
  }

  private arrive(seg: Seg) {
    this.mode = seg.kind === 'station' ? 'station' : seg.kind === 'door' ? 'door' : seg.kind === 'exit' ? 'exit' : seg.kind
    this.curSeg = seg
    if (seg.kind === 'station') {
      this.area = seg.i; this.lastArea = seg.i
      this.chips.setStation(this.S.stations[seg.i])
      this.setUi({ area: seg.i, travelling: false, live: true, step: 0, result: false })
      this.last = { i: seg.i, pos: 0, end: false, live: true }
    } else {
      this.chips.hide(); this.last = null
      this.setUi({ travelling: seg.kind !== 'intro', live: seg.kind !== 'intro' })
    }
  }
  private segDone(seg: Seg) { if (seg.kind === 'station') this.frame(seg, seg.clip.frames - 1) }

  /** one presented frame of a clip: the chips follow the baked anchors, the paper follows the step and the result */
  private frame(seg: Seg, pos: number) {
    this.log(seg.kind, pos)
    if (seg.kind !== 'station') return
    const st = this.S.stations[seg.i], p = pAt(st, pos)
    this.last = { i: seg.i, pos, end: false, live: true }
    this.chips.update(pos, true, this.host.winFit(), this.region)
    if (p >= RESULT_AT) this.retain(seg.i)
    this.setUi({ step: stepOf(p), result: p >= RESULT_AT, playing: !this.player.paused, reason: this.player.paused ? this.ui.reason : '' })
  }

  /** the station at p = 1 (a still): its sequence has ended and the result stands */
  private async landRest(i: number) {
    await this.player.land(K.rest(i))
    this.mode = 'rest'; this.area = i; this.lastArea = i
    this.chips.setStation(this.S.stations[i])
    this.last = { i, pos: this.S.stations[i].clip.frames - 1, end: true, live: true }
    this.chips.update(this.last.pos, true, this.host.winFit(), this.region, true)
    this.retain(i)
    this.host.warmFile(AREA_CONTENT[i].entry)
    this.setUi({ area: i, step: 3, result: true, playing: false, reason: 'done', tour: false, travelling: false, live: true })
  }

  // ── evidence ──
  private retain(i: number) {
    if (this.retained[i]) return
    this.retained[i] = true; this.order.push(i)
    this.setUi({})
    this.traceTo(i)
  }
  /** a hairline from the evidence plate's baked point to the Evidence button (WAAPI: nothing inline, nothing the CSP minds) */
  private traceTo(i: number) {
    if (this.host.reduced() || !this.trail) return
    const fit = this.host.winFit(), st = this.S.stations[i]
    const btn = this.sheet.querySelector<HTMLElement>('.ph-sp-ev')
    if (!btn) return
    const from = st.plate.result, b = btn.getBoundingClientRect()
    const x0 = from.x * fit.s + fit.tx, y0 = from.y * fit.s + fit.ty
    const x1 = Math.min(innerWidth - 8, Math.max(8, b.left + b.width / 2)), y1 = Math.min(innerHeight - 6, b.top)
    const path = this.trail.querySelector('path')!, cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 60
    path.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`)
    path.getAnimations().forEach((a) => a.cancel())
    path.animate([{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }], { duration: 1500, easing: 'cubic-bezier(.22,1,.36,1)' })
    btn.getAnimations().forEach((a) => a.cancel())
    btn.animate([{ color: 'var(--label)' }, { color: 'var(--acc-text)', offset: 0.55 }, { color: 'var(--label)' }], { duration: 1500, delay: 600 })
  }

  // ── the visitor's commands ──
  /**
   * Every command that starts motion in the picture (a pick, a step, Replay, Resume) first brings the picture into view: the page scrolls to the top on the app's
   * spring (about 0.35 s; at once under reduced motion), in parallel with the command's own first move. Skipped when the picture is already 90% in view.
   * Scrolling down to read (the reading pause) is not touched by this.
   */
  private bringIn() {
    if (!this.cut || scrollY <= 1) return
    const paper = this.sheet.querySelector<HTMLElement>('.ph-sp')
    const reg = this.region, h = Math.max(1, reg.b + BAR_GAP - reg.t)
    const seen = paper ? Math.max(0, Math.min(h, paper.getBoundingClientRect().top - reg.t)) / h : 1
    if (seen >= 0.9) return
    this.cancelScroll?.()
    if (this.host.reduced()) { scrollTo(0, 0); this.restTop = 0; return }
    const s = spring(scrollY); let last = performance.now(), raf = 0, live = true
    this.autoScroll++
    const done = () => { if (!live) return; live = false; cancelAnimationFrame(raf); this.autoScroll--; this.cancelScroll = null; this.restTop = scrollY }
    this.cancelScroll = done
    const tick = (now: number) => {
      if (!live) return
      damp(s, 0, 14, Math.min(0.05, (now - last) / 1000)); last = now
      if (s.value < 0.5) { scrollTo(0, 0); done(); return }
      scrollTo(0, s.value); raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  private clipsOk() { return !this.host.reduced() && this.host.stage.mode === 'clips' }
  /** which station the picture is in (for the way out), and how it is on screen */
  private whereNow(): { i: number | null; video: boolean; still: string | null } {
    const held = !!this.player.held || this.player.playing
    switch (this.mode) {
      case 'hub': return { i: null, video: false, still: K.hub }
      case 'rest': return { i: this.area, video: false, still: K.rest(this.area) }
      case 'fly': { const seg = this.curSeg; return { i: seg ? (this.segK(seg) < 0.5 ? seg.i : seg.i + 1) : this.area, video: held, still: null } }
      case 'out': case 'in': return { i: null, video: held, still: null }
      default: return { i: this.area, video: held, still: null }
    }
  }
  private curSeg: Seg | null = null
  private segK(seg: Seg) { const l = this.last; return l ? Math.min(1, l.pos / Math.max(1, seg.clip.frames - 1)) : 0 }

  async pick(j: number) {
    if (this.mode === 'idle' || this.mode === 'door' || this.mode === 'exit') return
    const token = ++this.token
    const where = this.whereNow()
    this.bringIn()
    this.player.abort()
    this.setUi({ tour: false, travelling: true, playing: true, reason: '', result: false })
    this.chips.hide(); this.last = null
    if (!this.clipsOk()) return void this.stillsTo(j, token)
    this.preload(K.in(j), K.st(j))
    if (where.i !== null) {
      this.preload(K.out(where.i))
      const out = pickSegs(this.S, where.i, j)[0]
      const r = await this.runChain([out], token, { land: 'hub', from: where.still ?? undefined, crossMs: where.video ? 180 : undefined })
      if (r !== 'done') return
    } else if (where.video) { await this.player.land(K.hub); this.mode = 'hub'; if (token !== this.token) return }
    await sleep(320); if (token !== this.token) return
    await this.runChain(pickSegs(this.S, null, j), token, { land: 'rest', from: K.hub })
  }

  /** a step dot: seek to the step's first frame and hold there */
  async step(n: number, frameOverride?: number) {
    if (this.mode === 'idle' || this.mode === 'door' || this.mode === 'exit' || this.mode === 'fly' || this.mode === 'in' || this.mode === 'out' || this.mode === 'hub') return
    const token = ++this.token
    const i = this.area, st = this.S.stations[i]
    const frame = frameOverride ?? st.stepFrames[n]
    if (frameOverride === undefined) this.bringIn()
    this.player.abort()
    const p = pAt(st, frame)
    this.setUi({ tour: false, playing: false, reason: 'user', step: stepOf(p), result: p >= RESULT_AT })
    if (this.clipsOk()) {
      const ok = await this.player.seek(K.st(i), st.clip.fps, frame)
      if (token !== this.token) return
      if (ok) {
        this.mode = 'held'; this.chips.setStation(st)
        this.last = { i, pos: frame, end: false, live: true }
        this.chips.update(frame, true, this.host.winFit(), this.region)
        if (p >= RESULT_AT) this.retain(i)
        this.setUi({ step: stepOf(p), result: p >= RESULT_AT, playing: false, reason: 'user' })
        return
      }
    }
    await this.stillsTo(i, token, n)
  }

  async replay() {
    if (this.mode === 'idle' || this.mode === 'door' || this.mode === 'exit') return
    const i = this.mode === 'fly' || this.mode === 'in' || this.mode === 'out' || this.mode === 'hub' ? this.area : this.area
    const token = ++this.token
    const fromStill = this.mode === 'rest' ? K.rest(i) : undefined
    this.bringIn()
    this.player.abort()
    this.setUi({ tour: false, playing: true, reason: '', step: 0, result: false, travelling: false })
    if (!this.clipsOk()) return void this.stillsTo(i, token)
    await this.runChain([{ kind: 'station', key: K.st(i), i, clip: this.S.stations[i].clip }], token, { land: 'rest', from: fromStill })
  }

  toggle() {
    const u = this.ui
    if (u.playing) { this.pauseFor('user'); return }
    this.bringIn()
    if (this.player.playing) { this.player.resume(); this.setUi({ playing: true, reason: '' }); return }
    if (this.mode === 'held' && this.clipsOk()) { void this.resumeHeld(); return }
    void this.replay()
  }
  private pauseFor(reason: string) {
    if (!this.ui.playing) return
    this.player.pause()
    this.setUi({ playing: false, reason })
  }
  private async resumeHeld() {
    const i = this.area, token = ++this.token, st = this.S.stations[i]
    const l = this.last, frame = l ? Math.max(0, Math.floor(l.pos)) : 0
    this.setUi({ playing: true, reason: '', tour: false })
    const seg: Seg = { kind: 'station', key: K.st(i), i, clip: st.clip }
    this.arrive(seg)
    const r = await this.player.play(seg.key, seg.clip, { startFrame: frame, onFrame: (pos) => this.frame(seg, pos) })
    if (token !== this.token || r !== 'done') return
    await this.landRest(i)
  }

  // ── leaving: out-i then the exit back to the cover ──
  /** play the way back to the cover; resolves once the cover stop is on screen again */
  async leave(o: { rate?: number } = {}): Promise<void> {
    if (this.mode === 'idle') return
    const token = ++this.token
    const rate = o.rate ?? 1
    const where = this.whereNow()
    const early = this.mode === 'door'
    this.player.abort()
    this.chips.hide(); this.last = null
    if (!early) this.sheetOut()
    this.setUi({ playing: false, reason: '', tour: false })
    const { stage } = this.host
    const exit = this.S.exit
    if (!this.clipsOk()) { await this.stillsLeave(token); return }
    if (early) {
      // the door was still running: its frame is crossfaded into the cover (there is no way back through a door that has not opened)
      await this.player.land(this.host.coverStill); this.finishLeave(); return
    }
    this.preload(K.exit)
    if (where.i !== null) {
      this.preload(K.out(where.i))
      const out = pickSegs(this.S, where.i, where.i)[0]
      const r = await this.runChain([out], token, { land: 'hub', from: where.still ?? undefined, crossMs: where.video ? 180 : undefined, rate })
      if (token !== this.token || r === 'aborted') return
      if (r === 'failed') { await this.stillsLeave(token); return }
    } else if (where.video) { await this.player.land(K.hub) }
    this.mode = 'exit'; this.barBack = false
    this.chips.hide()
    stage.pin([this.host.coverStill, K.hub])
    await stage.loadStill(this.host.coverStill)
    const r = await this.player.play(K.exit, exit, { from: K.hub, rate, onFrame: (pos) => this.exitFrame(exit, pos) })
    if (token !== this.token) return
    if (r === 'failed') { await this.stillsLeave(token); return }
    await this.player.land(this.host.coverStill)
    this.finishLeave()
  }
  /**
   * `Open X-…`: the way out is only out-i (at 1.5x), then a 180 ms crossfade to the target's stop picture, the stage's fit going from the window's to the stop's
   * with it. No exit to the cover: the related-file path (a file closing into another file) is the grammar, and it is the quicker one.
   */
  async leaveToFile(to: string, o: { rate?: number } = {}): Promise<void> {
    if (this.mode === 'idle') return
    const token = ++this.token
    const rate = o.rate ?? 1.5, { stage } = this.host
    const where = this.whereNow()
    this.bringIn()
    this.player.abort()
    this.chips.hide(); this.last = null
    this.sheetOut()
    this.host.page.ownLabel(null, this.host.reduced() ? 0 : 120)
    this.setUi({ playing: false, reason: '', tour: false })
    stage.pin([to, this.host.coverStill])
    const loaded = stage.loadStill(to)
    if (this.clipsOk() && where.i !== null && this.mode !== 'door') {
      this.preload(K.out(where.i))
      const out = pickSegs(this.S, where.i, where.i)[0]
      const r = await this.runChain([out], token, { land: 'none', from: where.still ?? undefined, crossMs: where.video ? 180 : undefined, rate })
      if (token !== this.token || r === 'aborted') return
    }
    await loaded
    if (token !== this.token) return
    this.mode = 'exit'
    // the fit eases from the window's to the stops' while the picture crossfades (both the video and the stills sit under the one transform)
    const a = this.host.winFit(), b = this.host.coverFit()
    const t0 = performance.now(), MS = 180
    const ease = (now: number) => { const k = Math.min(1, (now - t0) / MS); stage.setFit(lerpFit(a, b, k * k * (3 - 2 * k))); if (k < 1 && token === this.token) requestAnimationFrame(ease) }
    if (!this.host.reduced()) requestAnimationFrame(ease); else stage.setFit(b)
    if (this.player.held) await this.player.land(to, MS); else await this.cross(to, MS)
    if (token !== this.token) return
    this.host.page.placeMarks(ridePoints(this.host.coverRest(), [], 0), this.host.coverRest(), 0)
    this.finishLeave()
  }
  /** the browser has already animated the way back (a swipe-back, the Back key): no clip, the cover is simply there */
  async leaveNow(): Promise<void> {
    if (this.mode === 'idle') return
    this.token++
    this.player?.clear(); this.chips.hide(); this.last = null
    const { stage } = this.host
    await stage.loadStill(this.host.coverStill)
    stage.show(this.host.coverStill)
    this.host.page.placeMarks(ridePoints(this.host.coverRest(), [], 0), this.host.coverRest(), 1)
    this.finishLeave()
  }
  private exitFrame(e: SpaceExit, pos: number) {
    const cam = tableAt(e.cam, pos)
    this.log('exit', pos)
    if (pos < e.doorFrame) { this.host.stage.setFit(this.host.winFit()); return }
    if (!this.barBack) { this.barBack = true; this.host.page.setFileBar(false) }   // the bar's words go back at the picture's cut, on the same spring as they came (a crossfade of about 0.2 s)
    this.rideFace(e.quads, pos, cam)
  }
  private finishLeave() {
    this.mode = 'idle'; this.cut = false; this.lastArea = this.area
    for (const a of this.sheet.getAnimations()) a.cancel()   // P6b
    if (this.prelaid) this.sheet.classList.add('ph-pre'); else this.sheet.hidden = true   // (kept laid out, hidden)
    this.host.stage.setFit(this.host.coverFit())
    this.setUi({ live: false, playing: false })
  }
  private sheetOut() {
    if (this.host.reduced() || !this.shown()) return
    this.sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'linear', fill: 'forwards' })
  }

  // ── stills and crossfades (reduced motion, play refused, a clip that could not start) ──
  degrade() { this.player.clear(); this.host.stage.mode = 'stills' }
  private async cross(key: string, ms = 180) {
    const { stage } = this.host
    await stage.loadStill(key)
    const from = stage.current
    if (!from || from === key) { stage.show(key); return }
    await stage.run({ clipKey: null, clip: null, from, to: key, duration: ms / 1000, fade: [0, ms / 1000], onTick: () => {} })
  }
  private async stillsTo(i: number, token: number, step?: number) {
    const stills = this.host.stage.mode !== 'clips' && !this.host.reduced()
    this.player.clear()
    if (stills && this.mode !== 'hub') { await this.cross(K.hub); if (token !== this.token) return; this.mode = 'hub'; this.setUi({ travelling: true }); await sleep(250); if (token !== this.token) return }
    await this.cross(K.rest(i)); if (token !== this.token) return
    this.mode = 'rest'; this.area = i; this.lastArea = i
    const st = this.S.stations[i]
    this.chips.setStation(st); this.last = { i, pos: st.clip.frames - 1, end: true, live: true }
    this.chips.update(this.last.pos, true, this.host.winFit(), this.region, true)
    const s = step ?? 3
    this.retain(i)
    this.setUi({ area: i, step: s, result: true, playing: false, reason: step === undefined ? 'done' : 'user', tour: false, travelling: false, live: true })
  }
  /** a chain that cannot go on: land on the station it was heading for */
  private async settleStills(rest: Seg[], token: number) {
    const target = rest.find((s) => s.kind === 'station')
    await this.stillsTo(target ? target.i : this.area, token)
  }
  private async enterStills(token: number, area: number) {
    const stills = this.host.stage.mode !== 'clips' && !this.host.reduced()
    this.mode = 'intro'
    if (stills) { await this.cross(K.hub, 400); if (token !== this.token) return }
    this.doCut()
    await this.stillsTo(area, token)
    if (token === this.token) this.setUi({ playing: false, reason: 'done', tour: false })
  }
  private async stillsLeave(token: number) {
    this.player.clear()
    await this.cross(this.host.coverStill, 220); if (token !== this.token) return
    this.host.page.placeMarks(ridePoints(this.host.coverRest(), [], 0), this.host.coverRest(), 1)
    this.finishLeave()
  }

  // ── the page asks ──
  /** the clips are held and sized for this window: a resize redraws the chips and refits the stage */
  onResize() { this.layout(); if (this.cut && this.mode !== 'exit') this.host.stage.setFit(this.host.winFit()) }
  suspend() { this.player?.suspend() }
  wake() { this.player?.wake() }
  /** the stage was re-synced (bfcache): no clip is in flight any more; the station on screen is shown by its still */
  async resync() {
    if (this.mode === 'idle' || this.mode === 'door' || this.mode === 'exit') return
    const token = ++this.token
    this.player.clear()
    await this.stillsTo(this.area, token)
  }
  /** for tests and the sizes check: put station i on frame `frame`, held */
  async showFrame(i: number, frame: number) {
    if (this.mode === 'idle') return
    this.area = i
    this.chips.setStation(this.S.stations[i])
    this.setUi({ area: i })
    this.mode = 'rest'
    await this.step(0, frame)
  }
  dispose() {
    this.token++
    for (const f of this.off) f()
    this.player?.clear(); this.chips?.dispose(); this.decrypt?.dispose(); this.unmount?.(); this.trail?.remove(); this.sheet.remove()
  }
}
