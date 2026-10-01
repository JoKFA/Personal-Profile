// The archive controller: owns the stage, the motion model and the selection, runs the frame
// loop, and exposes a small snapshot for the React HUD. Camera rig and frame logic ported from
// RhineLabUI src/scene.ts (MIT, github.com/LBEILC/RhineLabUI): telephoto yaw 59°, elevation 19°,
// distance 140, span 7.33; the selection ripple fires with the selection itself.
import * as THREE from 'three'
import { ENTRIES } from '../data/entries'
import type { Entry, Lens } from '../data/types'
import { isPlain, land, rekey, sealAll, slotIndex, type ShownMap } from '../model/archive'
import { Ueba, type Alert } from '../model/ueba'
import { COLUMN_SPACING as CS, LANES, ROW_SPACING as RS, ROWS, cellKey, nearest, nearestCell, sameCell, wrap, type Cell } from '../motion/grid'
import { approach, damp, LIFT, RATES, REDUCED_FACTOR, spring, type Spring } from '../motion/spring'
import { field, PULSE_LIFE, settlingWave, slope, smooth, TILT, type FieldState, type Pulse } from '../motion/waves'
import { CARD, LED } from './drive'
import { createHero, type Hero } from './hero'
import { loadDriveModel } from './model'
import { FrameBudget, initialQuality, lower, type Quality } from './quality'
import { CIPHER_CELLS, COLS, createStage, DROWS, RECORD_CELL0, type Stage } from './stage'

export type Mode = 'entry' | 'archive' | 'opening' | 'file' | 'closing'
export interface Snapshot {
  mode: Mode
  sel: Cell
  entry: Entry | null
  plain: boolean
  lens: Lens
  readable: number
  risk: number
  riskLevel: string
  captured: boolean
  destroyed: ReadonlySet<string>
  quality: Quality['name']
  version: number
}

const ENTRY_INDEX = new Map(ENTRIES.map((e, i) => [e.id, i]))
const yaw = THREE.MathUtils.degToRad(59), elev = THREE.MathUtils.degToRad(19)
const READ_FLASH = new THREE.Color(0xffc27a).multiplyScalar(1.6)
const viewDir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev))
const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), viewDir).normalize()
const upV = new THREE.Vector3().crossVectors(viewDir, right).normalize()
const ARRAY_AIM = new THREE.Vector3(-1.091, -0.045, 0.481)
const TRACE = new THREE.Color(0xe6c98f), SHRED = new THREE.Color(0xe0502a)
/** Yaw that turns a drive's face toward the camera (the opened drive faces the reader, as in the reference). */
const FACE_YAW = Math.atan2(viewDir.x, viewDir.z)
const BASE_Y = -4.6
const cellPos = (c: Cell) => new THREE.Vector3((c.lane - 2) * CS, BASE_Y, (c.row - 15.5) * RS)
const ledKind = (e: Entry | null): 'long' | 'double' | 'dot' => (!e ? 'long' : e.kind === 'service' ? 'double' : e.kind === 'skill' || e.kind === 'credential' ? 'dot' : 'long')
export const kindLabel = (e: Entry) => ({ service: 'SERVICE RECORD', case: 'CASE FILE', education: 'EDUCATION', skill: 'SKILL', credential: 'CREDENTIAL', subject: 'SUBJECT FILE', visitor: 'VISITOR FILE', restricted: 'RESTRICTED' } as const)[e.kind]
const cipherCell = (c: Cell) => (wrap(c.lane, LANES) * 131 + wrap(c.row, ROWS) * 57) % CIPHER_CELLS
const HEX = '0123456789abcdef'
const rhex = (n: number) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('')
export { sealedId } from '../model/archive'

export interface ArchiveOptions { reduced: boolean; onAlert?: (a: Alert) => void }

export class Archive {
  readonly entryAt = slotIndex(ENTRIES)
  private stage: Stage
  private hero: Hero
  private heroGroup = new THREE.Group()
  private quality: Quality
  private budget = new FrameBudget()
  private listeners = new Set<() => void>()
  private snap!: Snapshot
  private version = 0

  private t = 0
  private enteredAt = -10
  private spotAt = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private focusEase = [0.5, 0.5, 0.2, 0.2]
  private slotFade = 0
  /** per entry: eased lamp and shade, so light never jumps */
  private lightEase = new Map<string, [number, number]>()
  private prevTrack = 0
  private prevRail = 0
  private last = performance.now()
  private raf = 0
  private mode: Mode = 'entry'
  private sel: Cell = { lane: 1, row: 12 }
  private lens: Lens = 'all'
  private shown: ShownMap = new Map()
  private destroyed = new Set<string>()
  private captured = false
  readonly ueba = new Ueba()

  private shoulder: Spring
  private laneFocus: Spring
  private colCam: Spring
  private rail: Spring
  private lift = spring(0)
  private lifts = new Map<string, Spring>()
  private hovers = new Map<string, number>()
  private pulses: Pulse[] = []
  private idleGain = 0
  private pulseGain = 1
  private detail = 0
  private shake = 0
  private lastInteraction = 0
  private opening = false
  /** 0 = drive faces its slot, 1 = drive turned to the reader; independent of lift so a closing
   *  drive turns back while it still hovers, and only then descends (as in the reference) */
  private face = 0
  private faceTarget = 0
  /** a closing drive stays up here until it has turned back, then descends */
  private holdHigh = false
  /** 0..1: the room dims while a drive is read (exposure), the trace light blooms */
  private focus = { value: 0, target: 0 }
  private bloom = { value: 0, target: 0 }
  /** smallest vertical gap (world units) between the selected drive's world box and any drive whose
   *  footprint it overlaps, over the current open/close; negative means the meshes intersect */
  clearanceMin = Infinity
  /** a motion wait gave up during the last open/close (it should never have to) */
  stalled = false
  private light = { reveal: 1, glow: 0, glowTarget: 0, die: 0, seam: 0 }
  private camAim = ARRAY_AIM.clone()
  private pointer = new THREE.Vector2(-9, -9)
  private ray = new THREE.Raycaster()
  private drawn: Cell[] = []
  private hoverCell: Cell | null = null
  private heroHover = false
  private tmp = new THREE.Vector3()
  private tops = new Float32Array(COLS * DROWS).fill(-Infinity)
  /** per drawn drive: x, bottom y, z of this frame (NaN y = the selected, drawn as the hero) */
  private boxes = new Float32Array(COLS * DROWS * 3)
  private heroBox = new THREE.Box3()
  /** Independent of the turn gate: the hero's real world box against every drawn drive's box. */
  private measureClearance() {
    this.heroGroup.updateMatrixWorld(true)
    const h = this.heroBox.setFromObject(this.heroGroup), hw = CARD.W / 2, ht = CARD.T / 2
    for (let i = 0; i < this.stage.N; i++) {
      const x = this.boxes[i * 3], y = this.boxes[i * 3 + 1], z = this.boxes[i * 3 + 2]
      if (Number.isNaN(y) || h.max.x <= x - hw || h.min.x >= x + hw || h.max.z <= z - ht || h.min.z >= z + ht) continue
      const gap = h.min.y - (y + CARD.H)
      if (gap < this.clearanceMin) this.clearanceMin = gap
    }
  }
  private copies = new Uint8Array(COLS * DROWS)

  private canvas: HTMLCanvasElement
  private opts: ArchiveOptions
  constructor(canvas: HTMLCanvasElement, opts: ArchiveOptions) {
    this.canvas = canvas; this.opts = opts
    this.quality = initialQuality()
    this.stage = createStage(canvas, this.quality)
    this.hero = createHero(this.quality.transmission)
    this.heroGroup.add(this.hero.group); this.stage.scene.add(this.heroGroup)
    const c = cellPos(this.sel)
    this.shoulder = spring(this.sel.row); this.laneFocus = spring(this.sel.lane)
    this.colCam = spring(c.x); this.rail = spring(-2.17 - c.z)
    this.stage.camera.position.copy(ARRAY_AIM).addScaledVector(viewDir, 140)
    sealAll(this.shown, ENTRIES, 0)
    for (const e of ENTRIES) this.drawLabel(e)
    this.paintHero('cipher')
    this.bindInput()
    this.publish()
    // compile every shader off the main thread (KHR_parallel_shader_compile) before the first
    // frame, so the entry animation is never frozen by a synchronous compile
    this.ready = loadDriveModel().then((g) => { this.stage.useModel(g); this.hero.useModel(g) }).catch(() => undefined)
      .then(() => this.stage.prepare(this.hero.spare))
      .catch(() => undefined)
      .then(() => new Promise<void>((res, rej) => { this.raf = requestAnimationFrame((t) => { try { this.frame(t) } catch (err) { rej(err); return } requestAnimationFrame(() => res()) }) }))
  }
  /** Resolves once shaders are compiled and the first frame is on screen. */
  readonly ready: Promise<void>

  // ── snapshot for React (useSyncExternalStore) ──
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  getSnapshot = () => this.snap
  private publish() {
    const entry = this.entryAt(this.sel)
    this.snap = {
      mode: this.mode, sel: { ...this.sel }, entry, plain: isPlain(this.shown, entry), lens: this.lens,
      readable: ENTRIES.filter((e) => isPlain(this.shown, e)).length,
      risk: Math.round(this.ueba.risk), riskLevel: this.ueba.level, captured: this.captured, destroyed: this.destroyed,
      quality: this.quality.name, version: ++this.version,
    }
    this.listeners.forEach((f) => f())
  }

  // ── state queries ──
  get reduced() { return this.opts.reduced }
  isReadable = (e: Entry | null | undefined) => isPlain(this.shown, e)
  isLocked = (e: Entry | null | undefined) => e?.kind === 'restricted' && !this.captured
  isShredded = (e: Entry | null | undefined) => !!e && this.destroyed.has(e.id)
  get selected() { return this.entryAt(this.sel) }

  // ── selection ──
  select(next: Cell) {
    if (sameCell(next, this.sel) || this.mode === 'opening' || this.mode === 'closing') return
    this.lifts.set(cellKey(this.sel), { ...this.lift })
    const was = this.lifts.get(cellKey(next)); this.lift = was ? { ...was } : spring(0); this.lifts.delete(cellKey(next))
    this.sel = { ...next }; this.lastInteraction = this.t
    if (!this.reduced) { this.pulses.push({ ...this.sel, time: this.t }); this.pulses = this.pulses.slice(-6) }
    this.paintSelected()
    const a = this.ueba.select(this.t); if (a) this.opts.onAlert?.(a)
    this.publish()
  }
  /** ↑↓ step to the next drive with a record in this drawer; ←→ change drawer, landing on the nearest record. */
  move(dLane: number, dRow: number) {
    if (this.mode !== 'archive' || this.ueba.throttledUntil > this.t) return
    const lane = this.sel.lane + dLane
    const inLane = ENTRIES.filter((e) => e.slot.lane === wrap(lane, LANES)).map((e) => nearestCell(e.slot, { lane, row: this.sel.row }))
    if (!inLane.length) { this.select({ lane, row: this.sel.row + dRow }); return }
    if (dRow) {
      const ahead = inLane.flatMap((c) => [c, { ...c, row: c.row + ROWS }, { ...c, row: c.row - ROWS }]).filter((c) => (c.row - this.sel.row) * dRow > 0)
      const next = ahead.sort((a, b) => Math.abs(a.row - this.sel.row) - Math.abs(b.row - this.sel.row))[0]
      if (next) this.select(next)
    } else this.select(inLane.sort((a, b) => Math.abs(a.row - this.sel.row) - Math.abs(b.row - this.sel.row))[0])
  }
  /** Move to a drawer by index (0–5), landing on its first file. */
  showDrawer(lane: number) {
    if (this.mode !== 'archive') return
    const first = ENTRIES.find((e) => e.slot.lane === lane && (e.kind === 'case' || e.kind === 'subject')) ?? ENTRIES.find((e) => e.slot.lane === lane)
    if (first) this.select(nearestCell(first.slot, this.sel))
  }
  /** What the pointer is over, and where on screen (for the hover label). */
  hovered(): { entry: Entry | null; cell: Cell; x: number; y: number } | null {
    const c = this.hoverCell ?? (this.heroHover ? this.sel : null)
    if (!c || this.mode !== 'archive') return null
    this.tmp.set((c.lane - 2) * CS - this.colCam.value, BASE_Y + 4.2, (c.row - 15.5) * RS + this.rail.value).project(this.stage.camera)
    return { entry: this.entryAt(c), cell: c, x: (this.tmp.x + 1) / 2 * innerWidth, y: (1 - this.tmp.y) / 2 * innerHeight }
  }
  jumpTo(id: string) { const e = ENTRIES.find((x) => x.id === id); if (e) this.select(nearestCell(e.slot, this.sel)) }

  /** Switch the "Hiring for" lens. Returns how many drives change. */
  setLens(lens: Lens) {
    if (lens !== this.lens) this.lensAt = this.t
    this.lens = lens
    const n = rekey(this.shown, ENTRIES, lens, this.sel, this.t)
    if (!this.reduced) this.pulses.push({ ...this.sel, time: this.t })
    else land(this.shown, Infinity)
    this.lastInteraction = this.t
    this.publish()
    return n
  }
  /** The entry wave: everything sealed, then decrypted outward under "Any role". */
  enter(select?: string) {
    this.mode = 'archive'
    if (select) { const e = ENTRIES.find((x) => x.id === select); if (e) { this.sel = { ...e.slot }; const c = cellPos(this.sel); this.colCam.value = c.x; this.rail.value = -2.17 - c.z; this.shoulder.value = this.sel.row; this.laneFocus.value = this.sel.lane } }
    this.setLens(this.lens)
    this.lift = spring(0)
    this.paintSelected()
  }
  /**
   * The PV's entrance, started the moment the archive is first on screen (not when it is built,
   * which can be seconds earlier): the camera whips in from far down the field and slows to a stop,
   * swells roll across the drives, and the selected drive rises once everything has settled.
   */
  startEntrance() {
    if (!this.reduced) { this.colCam.value += CS * 1.4; this.rail.value += RS * 26 }
    this.lift = spring(0)
    this.enteredAt = this.t
  }

  // ── open / close choreography (awaited by the UI flow) ──
  denyFeedback() {
    this.lift.velocity += 5.5; this.shake = 1; this.paintHero('denied')
    const a = this.ueba.deny(this.t); this.publish()
    const at = cellKey(this.sel)
    setTimeout(() => { if (cellKey(this.sel) === at && !isPlain(this.shown, this.selected)) this.paintHero('cipher') }, this.reduced ? 0 : 1100)
    return a
  }
  /** Lift the drive and push the camera in. Resolves when framed. */
  async beginOpen() {
    this.mode = 'opening'; this.publish(); this.clearanceMin = Infinity; this.stalled = false
    // read request: the slit flashes warm twice and goes dark, and the drive gives a little before it ejects
    const e = this.selected, kind = ledKind(e), on = READ_FLASH
    if (!this.reduced) {
      for (const [ms, c] of [[0, on], [90, null], [180, on], [300, null]] as const) setTimeout(() => this.hero.setLed(c, kind), ms)
      this.lift.velocity -= 1.6
      await new Promise((r) => setTimeout(r, 240))
    }
    this.opening = true; this.faceTarget = 1; this.focus.target = 1
    if (!(await this.until(() => this.face > 0.85 && this.detail > 0.8))) this.stalled = true
  }
  /** Light leaves the LED, runs over the top edge and across the face; the die flashes; the seam lights. */
  async readDrive() {
    const L = this.light
    L.glow = L.glowTarget = 1.25; L.reveal = 0; this.bloom.target = 1
    await this.tween(880, (k) => { L.reveal = k * 1.02 })
    await this.tween(200, (k) => { L.die = k })
    await this.tween(240, (k) => { L.seam = k; L.die = 1 - k * 0.6 })
    // the page is out: lights come back up, the traces settle low so they never fight the demo
    this.bloom.target = 0; this.focus.target = 0; L.glowTarget = 0.28
    void this.tween(420, (k) => { L.seam = 1 - k })
  }
  fileShown() { this.mode = 'file'; this.publish() }
  /** Reverse of opening: light retracts to the LED, the drive turns back while hovering, then lands. */
  /** `pageGone` resolves when the file view has left; the archive is not interactive before then. */
  async close(pageGone: Promise<unknown> = Promise.resolve()) {
    this.mode = 'closing'; this.publish(); this.clearanceMin = Infinity; this.stalled = false
    const L = this.light, glow0 = Math.max(L.glow, 0.6)
    L.seam = 0
    // the light retracts while the drive turns back, still up; it starts descending once most of
    // the turn is done
    this.holdHigh = true; this.opening = false; this.faceTarget = 0; this.focus.target = 0; this.bloom.target = 0
    const retract = this.tween(170, (k) => { L.die = 0.4 * (1 - k); L.reveal = 1.02 * (1 - k); L.glow = glow0 })
    if (!(await this.until(() => this.face < 0.35, 1500))) this.stalled = true
    await retract
    L.reveal = 1; L.glowTarget = 0
    this.holdHigh = false
    this.hero.setTraceColor(TRACE)
    // the HUD comes back while the drive finishes its last few centimetres
    if (!(await this.until(() => this.lift.value < 1.1, 1500))) this.stalled = true
    await pageGone
    await new Promise((r) => requestAnimationFrame(r))   // let React commit the unmount first
    this.mode = 'archive'; this.paintSelected()
    // landed: the LED answers once
    const e = this.selected
    if (!this.reduced && this.ledOf(e)) { this.hero.setLed(null, ledKind(e)); setTimeout(() => this.hero.setLed(this.ledOf(this.selected), ledKind(this.selected)), 90) }
    if (!this.reduced) this.pulses.push({ ...this.sel, time: this.t })
    this.publish()
  }
  /** One overwrite pass shown on the drive: the trace light flashes red and loses strength. */
  shredPass(pass: number) {
    this.hero.setTraceColor(SHRED)
    this.hero.setLed(LED.shredded, ledKind(this.selected))
    const L = this.light
    L.glowTarget = 0; L.glow = 1.4 - pass * 0.4
  }
  shred(id: string) { this.destroyed.add(id); const e = ENTRIES.find((x) => x.id === id); if (e) this.drawLabel(e); this.publish() }
  restore(id: string) { this.destroyed.delete(id); const e = ENTRIES.find((x) => x.id === id); if (e) this.drawLabel(e); this.publish() }
  capture() {
    this.captured = true; this.ueba.captured()
    const e = ENTRIES.find((x) => x.kind === 'restricted'); if (e) this.drawLabel(e)
    this.paintSelected(); this.publish()
  }
  /** Screen position of the selected drive's top-left corner (for the HUD leader line). */
  anchor(): { x: number; y: number } | null {
    this.tmp.copy(this.heroGroup.position).add(new THREE.Vector3(-1.9, 3.9, 0)).project(this.stage.camera)
    // lifted to the camera plane while a file is open: the projection degenerates
    if (this.tmp.z > 1 || !Number.isFinite(this.tmp.x) || !Number.isFinite(this.tmp.y)) return null
    return { x: (this.tmp.x + 1) / 2 * innerWidth, y: (1 - this.tmp.y) / 2 * innerHeight }
  }
  /** Screen-aligned box around the selected drive (for the HUD's corner markers), or null. */
  screenBox(): { x0: number; y0: number; x1: number; y1: number } | null {
    this.heroGroup.updateMatrixWorld()
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const x of [-CARD.W / 2, CARD.W / 2]) for (const y of [CARD.H * 0.45, CARD.H]) for (const z of [-CARD.T / 2, CARD.T / 2]) {
      this.tmp.set(x, y, z).applyMatrix4(this.heroGroup.matrixWorld).project(this.stage.camera)
      if (this.tmp.z > 1 || !Number.isFinite(this.tmp.x)) return null
      const sx = (this.tmp.x + 1) / 2 * innerWidth, sy = (1 - this.tmp.y) / 2 * innerHeight
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
    }
    return { x0, y0, x1, y1 }
  }
  /** Screen corners of the selected drive's face (TL, TR, BR, BL), for projecting a DOM demo onto it. */
  faceQuad(inset = 0.3): { x: number; y: number }[] {
    const hw = CARD.W / 2 - inset, top = CARD.H - inset, bot = inset, z = CARD.T / 2 + 0.01
    this.heroGroup.updateMatrixWorld()
    return [[-hw, top], [hw, top], [hw, bot], [-hw, bot]].map(([x, y]) => {
      this.tmp.set(x, y, z).applyMatrix4(this.heroGroup.matrixWorld).project(this.stage.camera)
      return { x: (this.tmp.x + 1) / 2 * innerWidth, y: (1 - this.tmp.y) / 2 * innerHeight }
    })
  }
  /** debug / perf probe: hold the read bloom on */
  debugBloom(s: number) { this.stage.setBloom(s) }
  setPointer(x: number, y: number) { this.pointer.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1) }
  clearPointer() { this.pointer.set(-9, -9) }
  /** Click on the canvas: select a drive, or return true if the selected one was clicked. */
  click(): 'selected' | 'hero' | null {
    if (this.mode !== 'archive') return null
    if (this.hoverCell) { this.select(this.hoverCell); return 'selected' }
    return this.heroHover ? 'hero' : null
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.unbind?.()
    this.stage.dispose()
  }

  // ── internals ──
  private unbind?: () => void
  private bindInput() {
    const move = (e: PointerEvent) => { if (e.pointerType === 'mouse') this.setPointer(e.clientX, e.clientY) }
    const leave = () => this.clearPointer()
    const vis = () => { if (!document.hidden) this.last = performance.now() }
    addEventListener('pointermove', move); addEventListener('pointerleave', leave); document.addEventListener('visibilitychange', vis)
    this.unbind = () => { removeEventListener('pointermove', move); removeEventListener('pointerleave', leave); document.removeEventListener('visibilitychange', vis) }
  }
  /** Wait for the motion to reach a state; gives up after `ms` (a hidden tab pauses the frame loop).
   *  Resolves true when the state was reached, false when it gave up. */
  private until(ok: () => boolean, ms = 4000) {
    const end = performance.now() + ms
    return new Promise<boolean>((res) => { const f = () => (ok() || this.reduced ? res(true) : performance.now() > end ? res(false) : setTimeout(f, 30)); f() })
  }
  /** The selected drive has landed in its slot and stopped moving. */
  settled() { return this.mode === 'archive' && Math.abs(this.lift.value - LIFT.rest) < 0.06 && Math.abs(this.lift.velocity) < 0.3 && this.face < 0.02 }
  private tween(ms: number, fn: (k: number) => void) {
    return new Promise<void>((res) => {
      if (this.reduced) { fn(1); return res() }
      const s = performance.now()
      const f = (now: number) => { const k = Math.min(1, (now - s) / ms); fn(smooth(k)); if (k < 1) requestAnimationFrame(f); else res() }
      requestAnimationFrame(f)
    })
  }
  private ledOf(e: Entry | null) {
    if (!e) return null
    if (this.destroyed.has(e.id)) return LED.shredded
    if (this.isLocked(e)) return null
    // the field stays quiet: under "Any role" only the selected drive lights; a lens lights its drives
    // no indicator lights (after the PV): relevance reads from height, inner light and focus
    return null
  }
  /**
   * What the field says about each drive, by light alone (no indicator, no height):
   *  · a drive that holds a record glows faintly from inside, a lantern; empty drives stay plain
   *  · under a lens the house lights dip a little, a light front sweeps out from the selection, and
   *    the drives that matter to that role take a full inner light; the other records go out
   * `r` eases 0→1 for a readable drive under a lens.
   */
  private relief = new Map<string, number>()
  private lensAt = -10
  private relOf(e: Entry | null, dt: number) {
    if (!e) return 0
    const want = this.lens !== 'all' && isPlain(this.shown, e) && !this.isLocked(e) && !this.destroyed.has(e.id) ? 1 : 0
    const v = approach(this.relief.get(e.id) ?? 0, want, this.reduced ? 60 : 2.2, dt); this.relief.set(e.id, v)
    return v
  }
  private lampOf(e: Entry | null, r: number, sweep: number) {
    if (!e || e.kind === 'restricted' || this.destroyed.has(e.id)) return sweep * 0.12
    const minor = e.kind === 'skill' || e.kind === 'credential'
    // light leaks from the slots around a record: a faint warm seam in the overview, a full glow
    // for the drives a lens picks out, nearly nothing for the rest
    const rest = this.lens === 'all' ? (minor ? 2.4 : 5.5) : 0.1
    return Math.max(rest, r * (minor ? 3 : 5.5)) + sweep * (r > 0.01 ? 4 : 0.8)
  }
  private fieldGlow(e: Entry | null, r: number) {
    if (!e || this.isLocked(e) || this.destroyed.has(e.id)) return 0
    return this.lens === 'all' ? 0.18 : 0.9 * r
  }
  private glowOf(e: Entry | null) {
    return e && isPlain(this.shown, e) && !this.isLocked(e) && !this.destroyed.has(e.id) ? 1 : 0
  }
  /** Printed on the drive: the ID and one short line, nothing smaller. */
  private drawLabel(e: Entry) {
    const g = this.stage.atlas.canvas.getContext('2d')!, c = this.stage.atlas.cell(RECORD_CELL0 + ENTRY_INDEX.get(e.id)!)
    const dark = e.kind === 'restricted', dead = this.destroyed.has(e.id)
    g.clearRect(c.x, c.y, c.w, c.h); g.textBaseline = 'middle'
    g.fillStyle = dark ? 'rgba(222,224,228,.9)' : 'rgba(30,29,26,.85)'; g.font = '700 34px "JetBrains Mono", monospace'
    g.fillText(e.id, c.x + 10, c.y + 40)
    g.font = '600 17px "JetBrains Mono", monospace'; g.fillStyle = dead ? '#d9431c' : dark ? 'rgba(200,203,208,.7)' : 'rgba(60,57,50,.6)'
    g.fillText(dead ? 'SHREDDED' : this.isLocked(e) ? 'RESTRICTED' : kindLabel(e), c.x + 12, c.y + 80)
    this.stage.atlas.texture.needsUpdate = true
  }
  private heroTimer = 0
  private paintSelected() {
    const e = this.selected
    this.hero.setDark(e?.kind === 'restricted')
    this.hero.setLed(this.ledOf(e), ledKind(e))
    this.light.glowTarget = this.glowOf(e)
    clearInterval(this.heroTimer)
    if (e && isPlain(this.shown, e)) {
      const t0 = performance.now()
      this.heroTimer = window.setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 650); this.paintHero('plain', this.reduced ? 1 : k); if (k >= 1) clearInterval(this.heroTimer) }, 40)
    } else this.paintHero('cipher')
  }
  private paintHero(kind: 'plain' | 'cipher' | 'denied', k = 1) {
    const g = this.hero.labelCanvas.getContext('2d')!, e = this.selected, dark = e?.kind === 'restricted'
    g.clearRect(0, 0, 512, 256); g.textBaseline = 'middle'
    const mix = (s: string) => s.split('').map((ch, j) => (j / s.length < k || ch === ' ' ? ch : HEX[Math.floor(Math.random() * 16)])).join('')
    const ink = dark ? 'rgba(222,224,228,.92)' : 'rgba(30,29,26,.88)', sub = dark ? 'rgba(200,203,208,.72)' : 'rgba(60,57,50,.62)'
    if (kind === 'plain' && e) {
      g.fillStyle = ink; g.font = '700 68px "JetBrains Mono", monospace'; g.fillText(mix(e.id), 20, 80)
      g.fillStyle = this.destroyed.has(e.id) ? '#d9431c' : sub; g.font = '600 34px "JetBrains Mono", monospace'
      g.fillText(mix(this.destroyed.has(e.id) ? 'SHREDDED' : this.isLocked(e) ? 'RESTRICTED' : kindLabel(e)), 24, 160)
    } else {
      g.fillStyle = kind === 'denied' ? '#d9431c' : sub; g.font = '700 68px "JetBrains Mono", monospace'; g.fillText(`0x${rhex(4)}`, 20, 80)
      g.font = '600 34px "JetBrains Mono", monospace'; g.fillText(kind === 'denied' ? 'ACCESS DENIED' : 'SEALED', 24, 160)
    }
    this.hero.labelTex.needsUpdate = true
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    if (document.hidden) return
    const rawDt = now - this.last
    const dt = Math.min(0.05, rawDt / 1000); this.last = now; this.t += dt
    if (this.budget.sample(rawDt, now) && this.quality.name !== 'low') this.degrade()
    const t = this.t, R = this.reduced ? REDUCED_FACTOR : 1, S = this.stage
    const chosen = cellPos(this.sel)
    damp(this.shoulder, this.sel.row, RATES.shoulder * R, dt); damp(this.laneFocus, this.sel.lane, RATES.laneFocus * R, dt)
    // the entrance decelerates over about three seconds (the PV's whip); after it, normal tracking
    const track = (t - this.enteredAt < 3.4 ? 1.45 : RATES.track) * R
    damp(this.colCam, chosen.x, track, dt); damp(this.rail, -2.17 - chosen.z, track, dt)
    const trackX = this.colCam.value
    // screen-space speed of the field this frame → blur along it
    {
      let dx = trackX - this.prevTrack, dz = this.rail.value - this.prevRail; this.prevTrack = trackX; this.prevRail = this.rail.value
      if (Math.abs(dx) > 6 || Math.abs(dz) > 6) { dx = 0; dz = 0 }   // a jump, not a move
      this.tmp.set(0, BASE_Y, 0).project(S.camera); const ax = this.tmp.x, ay = this.tmp.y
      this.tmp.set(-dx, BASE_Y, dz).project(S.camera)
      const k = this.reduced || dt <= 0 ? 0 : 0.5 * Math.min(1, 1 / 60 / dt) * 2.2
      S.setMotion((this.tmp.x - ax) * k, (this.tmp.y - ay) * k)
    }
    this.pulses = this.pulses.filter((p) => t - p.time < PULSE_LIFE)
    // the field keeps breathing whenever the archive is showing, not only when idle
    const idle = this.mode === 'archive' && !this.reduced
    const still = t - this.lastInteraction > 2.5
    this.idleGain = approach(this.idleGain, idle ? (still ? 1 : 0.55) : 0, idle ? 0.8 : 4, dt)
    this.pulseGain = approach(this.pulseGain, this.opening || this.mode === 'closing' ? 0 : 1, RATES.pulseGain, dt)

    // flips landing this frame
    const changed = land(this.shown, t)
    if (changed.length) { if (this.selected && changed.includes(this.selected.id)) this.paintSelected(); this.publish() }

    // hover
    this.hoverCell = null; this.heroHover = false
    if (this.mode === 'archive' && this.pointer.x > -2) {
      this.ray.setFromCamera(this.pointer, S.camera)
      const hH = this.ray.intersectObject(this.heroGroup, true)[0], hI = this.ray.intersectObject(S.pick, false)[0]
      if (hI && hI.instanceId != null && (!hH || hI.distance < hH.distance)) { if (!this.copies[hI.instanceId]) this.hoverCell = this.drawn[hI.instanceId] } else if (hH) this.heroHover = true
      this.canvas.style.cursor = this.hoverCell || this.heroHover ? 'pointer' : 'default'
      if (this.hoverCell) { const a = this.ueba.hover(cellKey(this.hoverCell), t); if (a) { this.opts.onAlert?.(a); this.publish() } }
    }
    const hk = this.hoverCell ? cellKey(this.hoverCell) : this.heroHover ? cellKey(this.sel) : null
    if (hk && !this.hovers.has(hk)) this.hovers.set(hk, 0)
    for (const [k, v] of this.hovers) { const n = approach(v, k === hk ? 0.28 : 0, RATES.hover, dt); if (k !== hk && n < 1e-4) this.hovers.delete(k); else this.hovers.set(k, n) }

    const up = this.opening || this.holdHigh
    const settling = this.mode === 'archive' && t - this.enteredAt < 2.4
    damp(this.lift, up ? LIFT.open : settling ? 0 : LIFT.rest, (this.opening ? RATES.eject : this.mode === 'closing' ? RATES.land : RATES.lift) * R, dt)
    for (const [k, s] of this.lifts) { damp(s, 0, RATES.outgoing * R, dt); if (Math.abs(s.value) < 1e-4 && Math.abs(s.velocity) < 1e-3) this.lifts.delete(k) }

    const fs: FieldState = { shoulder: this.shoulder.value, laneFocus: this.laneFocus.value, idleGain: this.idleGain, pulseGain: this.pulseGain, pulses: this.pulses, time: t, entry: this.reduced ? 0 : t - this.enteredAt }
    const cLane = Math.round(trackX / CS) + 2, cRow = Math.round((-2.17 - this.rail.value) / RS + 15.5)
    for (let i = 0; i < S.N; i++) {
      const c = { lane: cLane - (COLS >> 1) + Math.floor(i / DROWS), row: cRow - (DROWS >> 1) + (i % DROWS) }
      this.drawn[i] = c
      const k = cellKey(c), isSel = sameCell(c, this.sel), lifted = this.lifts.get(k)?.value || 0
      // the extra rows/columns at the far edges are wrapped copies: draw them as plain sealed drives
      // so every record (and the one black drive) appears exactly once, and never pick them
      const copy = !isSel && (c.row !== nearest(c.row, cRow, ROWS) || c.lane !== nearest(c.lane, cLane, LANES))
      this.copies[i] = copy ? 1 : 0
      const e = copy ? null : this.entryAt(c)
      const y = BASE_Y + field(c.row, c.lane, fs) + lifted + (this.hovers.get(k) || 0)
      // tops of the drives the selected one could sweep when it turns (same lane, ±4 rows), and every
      // drive's box, for the clearance check
      this.tops[i] = !isSel && c.lane === this.sel.lane && Math.abs(c.row - this.sel.row) <= 4 ? y + CARD.H : -Infinity
      this.boxes[i * 3] = (c.lane - 2) * CS - trackX; this.boxes[i * 3 + 1] = isSel ? NaN : y; this.boxes[i * 3 + 2] = (c.row - 15.5) * RS + this.rail.value
      const r = isSel ? 0 : this.relOf(e, dt)
      // the light front after a lens change, travelling out from the selection
      const dist = Math.hypot((c.row - this.sel.row) * 0.55, (c.lane - this.sel.lane) * 2.2), front = (t - this.lensAt) * 11
      const sweep = this.reduced || t - this.lensAt > 3 ? 0 : Math.exp(-((dist - front) ** 2) / 2.5) * Math.exp(-(t - this.lensAt) * 0.6)
      // the overview is the main view: a record stands in light, an empty drive sits in warm shade;
      // under a lens, records the lens does not pick join the shade
      const isRecord = !!e && e.kind !== 'restricted' && !this.destroyed.has(e.id)
      const lit = this.lens === 'all' ? (isRecord ? 1 : 0) : r
      // eased per entry (decrypt flips, lens changes): the light glides, it never jumps
      let shade = isSel ? 1 : 1 - 0.48 * (1 - lit), lamp = isSel ? 0 : this.lampOf(e, r, sweep)
      if (e && !this.reduced) {
        const le = this.lightEase.get(e.id) ?? [lamp, shade], k2 = 1 - Math.exp(-dt * 4)
        le[0] += (lamp - le[0]) * k2; le[1] += (shade - le[1]) * k2; this.lightEase.set(e.id, le); lamp = le[0]; shade = le[1]
      }
      S.set(i, (c.lane - 2) * CS - trackX, y, (c.row - 15.5) * RS + this.rail.value, slope(c.row, c.lane, fs) * TILT * (1 - smooth(lifted / 0.4)),
        e && (isPlain(this.shown, e) || e.kind === 'restricted') ? RECORD_CELL0 + ENTRY_INDEX.get(e.id)! : cipherCell(c),
        this.ledOf(e), isSel, this.fieldGlow(e, r), e?.kind === 'restricted', ledKind(e), shade, this.fieldGlow(e, r), 0, lamp)
    }
    S.commit(t)

    const L = this.light
    L.glow = approach(L.glow, L.glowTarget, this.reduced ? 60 : 3, dt)
    this.hero.setLight(L.reveal, L.glow, L.die, L.seam, t)
    this.hero.setLabel(this.detail < 0.5)
    this.hero.setClear(smooth(Math.min(1, this.detail * 1.25)))
    this.shake *= Math.exp(-dt * 6)
    this.heroGroup.position.set(chosen.x - trackX, BASE_Y + field(this.sel.row, this.sel.lane, fs) + this.lift.value + (this.hovers.get(cellKey(this.sel)) || 0), chosen.z + this.rail.value)
    {
      // the selection light: a drive-shaped panel in the slot in front of the selected drive, facing
      // it; it glides to a new selection and fades while a file is open
      const h = this.heroGroup.position
      // it does not slide across the field to a new selection (that lights every drive on the way):
      // it fades out where it was and back in where the selection is
      this.tmp.set(h.x, h.y + CARD.H - 0.3, h.z)
      const far = this.spotAt.distanceTo(this.tmp)
      this.slotFade = approach(this.slotFade, far > 0.8 ? 0 : 1, this.reduced ? 60 : far > 0.8 ? 9 : 3.5, dt)
      if (this.slotFade < 0.02 || far <= 0.8) this.spotAt.lerp(this.tmp, this.slotFade < 0.02 ? 1 : 1 - Math.exp(-dt * 12))
      const s = this.spotAt, on = (1 - this.detail) * (this.mode === 'entry' ? 0 : 1) * this.slotFade
      // the black drive is lit by its own dark register, not by a warm slot that would mirror in its coat
      S.setSlotLight(s.x, s.y, s.z, RS * 0.5, (this.selected?.kind === 'restricted' ? 0 : 16) * on)
    }
    // the drive may only turn once it is clear of the drives around it: 5 wide, turned 48° it
    // sweeps ±3 rows, so its underside has to be above their tops first (no clipping, by construction)
    let top = -Infinity
    for (let i = 0; i < S.N; i++) if (this.tops[i] > top) top = this.tops[i]
    const gap = this.heroGroup.position.y - top
    const turn = Math.min(smooth(this.face), Math.max(0, Math.min(1, (gap - 0.12) / 0.5)))
    this.heroGroup.rotation.set(slope(this.sel.row, this.sel.lane, fs) * TILT * (1 - this.detail) * (1 - smooth(this.lift.value / 0.4)), Math.sin(t * 38) * this.shake * 0.05 + FACE_YAW * 0.82 * turn, 0)

    if (this.mode === 'opening' || this.mode === 'closing') this.measureClearance()
    this.face = approach(this.face, this.faceTarget, this.reduced ? 60 : this.faceTarget ? 4.2 : 6.5, dt)
    this.focus.value = approach(this.focus.value, this.focus.target, this.reduced ? 60 : this.focus.target ? 3 : 4.5, dt)
    this.bloom.value = approach(this.bloom.value, this.bloom.target, this.reduced ? 60 : 5, dt)
    S.setExposure(0.86 - 0.24 * this.focus.value)   // high-key, after the PV
    S.setFaceLight(this.detail)
    // depth of field: focus on the selected drive; the closer the camera has pushed in (an open
    // file), the shallower the focus, so the archive behind the file falls away
    this.tmp.copy(this.heroGroup.position); this.tmp.y += CARD.H * 0.5
    const fd = S.camera.position.distanceTo(this.tmp)
    S.setDof(fd, 0, 0)
    {
      // the focus follows the selected drive on screen; an open file widens it to the drive it holds
      const b = this.screenBox()
      if (b) {
        const cx = (b.x0 + b.x1) / 2 / innerWidth, cy = 1 - (b.y0 + b.y1) / 2 / innerHeight
        const rx = Math.max(0.14, (b.x1 - b.x0) / innerWidth * 0.72), ry = Math.max(0.16, (b.y1 - b.y0) / innerHeight * 0.85)
        const f = this.focusEase, k = this.reduced ? 1 : 1 - Math.exp(-dt * 5)
        f[0] += (cx - f[0]) * k; f[1] += (cy - f[1]) * k; f[2] += (rx - f[2]) * k; f[3] += (ry - f[3]) * k
        S.setFocus(f[0], f[1], f[2] * 1.8, f[3] * 1.7, this.reduced ? 0 : (4.5 + 6 * this.detail) * Math.min(innerWidth / 1440, 1.2))   // the overview stays sharp; only the far edges soften
      }
    }
    S.setBloom(this.reduced ? 0 : 0.95 * this.bloom.value)
    // camera
    const detailTarget = this.opening || this.holdHigh ? smooth((this.lift.value - 0.8) / 2.4) : smooth((this.lift.value - 0.4) / 3.65)
    this.detail = approach(this.detail, detailTarget, (this.opening ? RATES.detailOpen : RATES.detail) * R, dt)
    const d = this.detail, W = innerWidth, H = innerHeight, aspect = W / H, portrait = aspect < 1.05
    const baseSpan = 7.33 + (5.9 - 7.33) * d
    const pdSpan = Math.max(6.3 / aspect, 3.7 * H / Math.max(100, 0.54 * H - 156))
    const span = portrait ? Math.max(baseSpan, 8.4 / aspect + (pdSpan - 8.4 / aspect) * d) : Math.max(baseSpan, baseSpan * (16 / 9) / aspect)
    const distance = 140 + (72 - 140) * d, pixelScale = H / span
    const aim = ARRAY_AIM.clone()
    if (portrait) aim.set(0, BASE_Y + settlingWave(0) + 0.4 + 1.85, -2.17).addScaledVector(upV, (0.36 - 0.5) * H / pixelScale)
    const dX = portrait ? 0.5 : 550 / 1920, dY = portrait ? 0.27 + 34 / H : 560 / 1080
    const detailAim = this.heroGroup.position.clone().add(new THREE.Vector3(0, 1.85, 0)).addScaledVector(right, (0.5 - dX) * W / pixelScale).addScaledVector(upV, (dY - 0.5) * H / pixelScale)
    aim.lerp(detailAim, d)
    // while the drive ejects and the camera has not pushed in yet, tilt up with it so it never
    // leaves the frame through the top
    if (this.opening || this.holdHigh) aim.addScaledVector(upV, Math.max(0, this.lift.value - LIFT.rest) * 0.55 * (1 - d))
    // the entrance turns the view as well as moving it: it starts swung round and higher, and eases
    // to the archive's angle as the camera settles
    const ek = this.reduced ? 1 : smooth(Math.min(1, Math.max(0, (t - this.enteredAt) / 3.4)))
    const yawE = yaw + THREE.MathUtils.degToRad(17) * (1 - ek), elevE = elev + THREE.MathUtils.degToRad(10) * (1 - ek)
    const dir = this.tmp2.set(-Math.sin(yawE) * Math.cos(elevE), Math.sin(elevE), Math.cos(yawE) * Math.cos(elevE))
    const camPos = aim.clone().addScaledVector(d > 0.01 ? viewDir : dir, distance)
    if (this.pointer.x > -2 && this.mode === 'archive') { camPos.x += this.pointer.x * 0.12; camPos.y -= this.pointer.y * 0.12 }
    const blend = this.reduced ? 1 : 1 - Math.exp(-dt * RATES.camera)
    S.camera.position.lerp(camPos, blend); this.camAim.lerp(aim, blend); S.camera.lookAt(this.camAim)
    S.camera.fov = THREE.MathUtils.lerp(S.camera.fov, THREE.MathUtils.radToDeg(2 * Math.atan(span / (2 * distance))), blend)
    const rd = S.camera.position.distanceTo(this.camAim), fog = S.scene.fog as THREE.Fog
    fog.near = rd + 8 - 9 * d; fog.far = rd + 46 - 34 * d
    S.camera.updateProjectionMatrix()

    const before = Math.round(this.ueba.risk)
    this.ueba.tick(dt)
    if (Math.round(this.ueba.risk) !== before) this.publish()
    S.render()
    ;(window as unknown as { __frames?: number }).__frames = ((window as unknown as { __frames?: number }).__frames || 0) + 1
  }
  private degrade() {
    this.quality = lower(this.quality)
    this.stage.renderer.setPixelRatio(Math.min(this.quality.dpr, devicePixelRatio || 1))
    this.stage.composer.setPixelRatio(Math.min(this.quality.dpr, devicePixelRatio || 1))
    if (!this.quality.ao) this.stage.composer.passes.forEach((p) => { if (p.constructor.name === 'GTAOPass') p.enabled = false })
    if (!this.quality.shadows) this.stage.renderer.shadowMap.enabled = false
    this.publish()
  }
}
