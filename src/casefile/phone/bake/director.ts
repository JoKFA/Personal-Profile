// The phone's director (extracted from phone/lab.ts; the timeline, springs and numbers are the approved prototype's).
// It drives the real archive frame by frame through the lab hooks (scene/lab.ts): the camera, the drive's pose, the
// field's drop, fog and light. Everything is still drawn by the real engine; springs are the engine's own
// (critically damped, motion/spring.ts). Only built in dev and in `vite build --mode bake`.
//
// Two framings share this code:
//  - master (the bake): the viewport is the 480 × 960 master. The stop's drive stands at the master's centre, at the
//    prototype's pixels per world unit (the prototype framed stops at a viewport height of 844), and the field's idle
//    "breathing" is held at 0, so the baked pixels are still when nothing moves.
//  - prototype (?phone, phone/lab.ts): the numbers exactly as the approved prototype had them.
import * as THREE from 'three'
import type { Archive } from '../../scene/archive'
import { damp, spring, type Spring } from '../../motion/spring'
import { smooth } from '../../motion/waves'
import { CARD } from '../../scene/drive'
import { DOOR, doorAt } from '../../scene/door'
import type { LabHooks } from '../../scene/lab'
import { ENTRIES } from '../../data/entries'
import type { ShotState } from '../overlay'
import type { Interior } from './interior'
import type { Handoff } from '../../space/scene'

declare global {
  interface Window {
    __cf?: Archive
    __ph?: Director
  }
}

const D2R = Math.PI / 180
/** the archive's own view (scene/archive.ts): yaw 59°, elevation 19° */
const VIEW = { yaw: 59, elev: 19 }
/** the drive turned square to that view */
const FACE_YAW = Math.atan2(-Math.sin(VIEW.yaw * D2R), Math.cos(VIEW.yaw * D2R))
/** the viewport height the prototype's stops were framed at (390 × 844) */
export const PROTO_H = 844
/** a stop: the drive stands 1.8 out of its slot, its shell clear, in the reader. The cover sits lower (the thesis is above it). */
const FRAME: Record<string, { span: number; dy: number; lift: number }> = { cover: { span: 10.6, dy: 1.1, lift: 2.5 }, stop: { span: 10, dy: -1.2, lift: 1.8 } }
/** the master's aim: the reticle's centre sits at master y 575 on the cover and 395 on every file stop (PM, 10-13), x unchanged; the span is the prototype's */
const MASTER_DY = { cover: 1.2031, stop: -1.123 }
const frameOf = (id: string) => (id === 'YW-000' ? FRAME.cover : FRAME.stop)
/** the face inside its frame, once stood upright: 3.1 wide, 4.4 tall (CARD less the 0.3 frame) */
const INNER = { w: CARD.H - 0.6, h: CARD.W - 0.6 }

function vspring(v: THREE.Vector3) { return { x: spring(v.x), y: spring(v.y), z: spring(v.z) } }
function vdamp(s: { x: Spring; y: Spring; z: Spring }, to: THREE.Vector3, rate: number, dt: number) { damp(s.x, to.x, rate, dt); damp(s.y, to.y, rate, dt); damp(s.z, to.z, rate, dt) }
const vval = (s: { x: Spring; y: Spring; z: Spring }) => new THREE.Vector3(s.x.value, s.y.value, s.z.value)

type Mode = 'stop' | 'opening' | 'open' | 'closing' | 'door'
/** what the bake reads after a frame is drawn: the face's corners (px of the viewport) and the camera's progress */
export interface Sample {
  /** faceQuad(0): the face at rest, tl, tr, br, bl */
  quad0: [number, number][]
  /** faceQuad(0.3): the face inside its frame (where a demo goes once the face fills the width) */
  inner: [number, number][]
  /** faceQuad(0.5): the page layer's corner marks ride this */
  quad: [number, number][]
  /** 0 = the stop's framing, 1 = the window's (the face filling the width) */
  cam: number
}
export interface Director {
  mode: Mode; stopId: string; t: number; k: number; ready: boolean; near: boolean
  open(): void; close(): void; stop(id: string): void
  /** the engine's own door (beginOpen → the key's light → beginDoor), the director keeping its hands off the camera.
   *  With `interior`, the interior's runtime starts on the cut exactly as CasefileApp starts it (clock restarted, the tour from the top);
   *  `ff` first runs the clock (without drawing) to a state of the tour. */
  door(o?: { interior?: boolean; ff?: { until: 'intro' | 'arrive' | 'flight' | 'result' | 'done'; area?: number } }): void
  /** after the archive has closed the file again (archive.close()): the director takes the camera from where the engine left it, back to the cover's framing */
  retake(): void
  /** what the exterior handed over at the cut */
  handoff: Handoff | null
  /** the interior, once spaceBoot() has built it (bake only) */
  space: Interior | null
  /** build the interior on the archive's renderer (as the desktop does under the entry) */
  spaceBoot(): Promise<void>
  /** the door has reached its cut: the exterior's last frame has been drawn */
  doorCut: boolean
  sample(): Sample
  /** every entry the phone Index lists (all but skills and credentials), in the archive's order */
  stops: { id: string; kind: string }[]
  marks: [number, string][]
}
export interface InstallOptions {
  /** the bake's framing (see the top of this file) */
  master?: boolean
  /** the prototype's page layer, drawn after the engine's frame from the same clock */
  page?: (s: ShotState) => void
}

export function install(opts: InstallOptions = {}) {
  const master = !!opts.master
  /** world units per prototype world unit: keeps the drive the same size in CSS px when the viewport is taller */
  const sc = () => (master ? innerHeight / PROTO_H : 1)
  const dyOf = (f: { dy: number }) => (master ? (f === FRAME.cover ? MASTER_DY.cover : MASTER_DY.stop) : f.dy)
  // (the page's HUD, grain and file view are not part of the bake's pixels / the prototype's film)
  const st = document.createElement('style')
  st.textContent = '.hud, .cf-grain, .file, .door-skip { visibility: hidden !important; }'
  document.head.appendChild(st)
  // The desktop's page vignette (archive.css .cf::after: the top 30% and the edges dissolve into warm white) is part of the page, not the scene: no baked pixel carries it
  // (the phone has its own page layer; over a dark field it is a soft glow, over a pale one it washes the top of every picture).
  if (master) {
    const vig = document.createElement('style')
    vig.textContent = '.cf::after { display: none !important; }'
    document.head.appendChild(vig)
  }

  let mode: Mode = 'stop', stopId = ''
  let t0 = 0, now = 0, stopAt = 0
  /** the drive's centre at the stop (in the archive's own frame), measured once it has settled */
  let c0: THREE.Vector3 | null = null
  // the shot's springs
  const up = spring(0), yawK = spring(0), rollK = spring(0), camK = spring(0), dip = spring(0)
  // the stop's framing glides between the cover's and the files' (the reader moves with it)
  const span = spring(FRAME.stop.span * sc()), dy = spring(dyOf(FRAME.stop)), dist = spring(140), yaw = spring(VIEW.yaw), elev = spring(VIEW.elev)
  let aim: ReturnType<typeof vspring> | null = null
  let sweepAt = -1, framed = false, pending = false
  // the hero's shell clears as it rises into the reader; drives let go of clear back slowly; the others' light steps back once
  const clearK = spring(0), quietK = spring(0)
  const letGo = new Map<string, Spring>()
  const marks: [number, string][] = []
  const mark = (s: string) => marks.push([+now.toFixed(3), s])
  const pts = (q: { x: number; y: number }[]) => q.map((p) => [p.x, p.y] as [number, number])

  const dir: Director = {
    mode, stopId, t: 0, k: 0, marks, ready: false, near: false, doorCut: false, handoff: null, space: null,
    stops: ENTRIES.filter((e) => e.kind !== 'skill' && e.kind !== 'credential').map((e) => ({ id: e.id, kind: e.kind })),
    stop(id: string) {
      const a = window.__cf!
      const was = (a as unknown as { sel: { lane: number; row: number } }).sel
      if (stopId && stopId !== id) { letGo.set(`${was.lane}:${was.row}`, { value: clearK.value, velocity: 0 }); clearK.value = 0; clearK.velocity = 0 }
      a.setBrief(false); a.jumpTo(id)
      // the first stop takes the camera from the engine where it is (after the entrance: the archive's own view)
      if (!framed) {
        const f = frameOf(id), x = a as unknown as { camAim: THREE.Vector3; stage: { camera: THREE.PerspectiveCamera } }
        const cam = x.stage.camera, d = cam.position.distanceTo(x.camAim)
        span.value = 2 * d * Math.tan(cam.fov * D2R / 2); dist.value = d; dy.value = dyOf(f)
        // and from where it looks: the view's yaw and elevation (a telephoto lens turns a degree into the whole frame)
        const v = cam.position.clone().sub(x.camAim).normalize()
        elev.value = Math.asin(v.y) / D2R; yaw.value = Math.atan2(-v.x, v.z) / D2R
        aim = vspring(x.camAim.clone()); framed = true
      }
      mode = 'stop'; stopId = id; stopAt = now; c0 = null; pending = false; dir.near = false; up.value = 0; yawK.value = rollK.value = camK.value = 0; mark(`stop ${id}`)
    },
    // a tap before the drive has come to rest is kept, and honoured the moment it has
    open() { if (mode !== 'stop') return; if (!c0) { pending = true; mark('open (queued)'); return } pending = false; mode = 'opening'; t0 = now; sweepAt = -1; mark('open') },
    close() { if (mode !== 'open' && mode !== 'opening') return; mode = 'closing'; t0 = now; mark('close') },
    async spaceBoot() {
      if (dir.space) return
      const m = await import('./interior'); const it = m.createInterior(); await it.boot(); dir.space = it
    },
    retake() { framed = false; dir.stop('YW-000') },
    door(o = {}) {
      const a = window.__cf!
      mode = 'door'; stopId = 'YW-000'; dir.doorCut = false; mark('door')
      void (async () => {
        a.jumpTo('YW-000')
        // the subject file opens like any other, the key's light crosses the face, then the door takes the camera (CasefileApp.openEntry)
        await a.beginOpen()
        const read = a.runSweep(700)
        await new Promise((r) => setTimeout(r, 300))
        await a.beginDoor().then((h) => {
          dir.handoff = h; dir.doorCut = true; mark('door cut')
          // the interior takes the canvas from the next frame, as CasefileApp.openEntry starts it
          if (o.interior && dir.space) { dir.space.restart(true); if (o.ff) dir.space.fastForward(o.ff.until, o.ff.area); dir.space.start(h) }
        })
        await read
      })()
    },
    sample() {
      const a = window.__cf!
      let cam = camK.value
      // the door's own progress: running (forwards or back) = its stand; cut and inside = 1; before the cut and after the way back = 0
      if (mode === 'door') { const d = (a as unknown as { door: { on: boolean; open: boolean; t: number } }).door; cam = d.on ? doorAt(Math.min(d.t, DOOR.end)).stand : d.open ? 1 : 0 }
      return { quad0: pts(a.faceQuad(0)), inner: pts(a.faceQuad(0.3)), quad: pts(a.faceQuad(0.5)), cam }
    },
  }
  window.__ph = dir

  // the prototype's page: drawn after the engine's frame (its rAF is registered after the archive's), from the same clock
  if (opts.page) {
    let lastPage = 0
    const page = () => {
      requestAnimationFrame(page)
      const a = window.__cf; if (!a) return
      const dt = Math.min(0.05, Math.max(0, now - lastPage)); lastPage = now
      opts.page!({ mode: mode === 'door' ? 'stop' : mode, k: now - t0, stop: stopId, ready: !!c0, near: dir.near, entry: a.entranceAge(), sel: a.selected ? `${a.selected.id} · ${a.selected.title}` : '', anchor: a.anchor(), quad: a.faceQuad(0), inner: a.faceQuad(0.5), dt })
    }
    requestAnimationFrame(page)
  }

  window.__phoneDirector = (t, dt, a) => {
    now = t; dir.t = t; dir.mode = mode; dir.stopId = stopId; dir.ready = !!c0; dir.k = t - t0; if (c0) dir.near = true
    // the baked field lies still (before the first stop too: the entrance's pixels)
    const still: Pick<LabHooks, 'idle0'> = master ? { idle0: true } : {}
    if (!stopId) { window.__lab = { ...still }; return }
    // motion blur stays (speed shows only while something moves, A2); depth of field never (A9)
    const f = frameOf(stopId), fspan = f.span * sc()
    // one hero at a time: the other records' light steps back; pans smear a third as much as the desktop's
    damp(clearK, dir.near || c0 ? 1 : 0.15, 5, dt); damp(quietK, 0.7, 3, dt)
    const cells = new Map<string, number>()
    for (const [key, sp] of letGo) { damp(sp, 0, 4, dt); if (sp.value < 0.002) letGo.delete(key); else cells.set(key, sp.value) }
    const lab: LabHooks = { ...still, sharp: true, clear: clearK.value, lift: f.lift, quiet: quietK.value, blur: 0.35, clearCells: cells }
    const g = (a as unknown as { heroGroup: THREE.Group }).heroGroup
    damp(span, fspan, 4.2, dt); if (mode !== 'door') damp(dy, dyOf(f), 4.2, dt); damp(dist, 140, 4.2, dt); damp(yaw, VIEW.yaw, 4.2, dt); damp(elev, VIEW.elev, 4.2, dt)
    // the camera's aim follows the drive a beat behind (the engine pans the archive; the aim adds the weight)
    const hc = g.position.clone().add(new THREE.Vector3(0, CARD.H / 2, 0))
    // the stop: the engine places the drive (it pans the archive under the camera, lifts the drive, on its own springs);
    // the director takes the drive only when it is opened, from wherever it is at that moment
    // the engine's own door (beginOpen, the key's light, beginDoor; and, running backwards, close()): the engine's camera and its drive, with the
    // light the cover had kept until the engine takes it over, and the camera's AIM following the drive: it springs after the drive's centre (the
    // cover's offset relaxing to the middle of the screen: the page clears its sheet and panel for the door) and hands over to the door's own aim
    // as the drive stands (weight 1 − stand), so the drive never leaves the frame and only grows as the dolly comes. Nothing else is invented.
    if (mode === 'door') {
      const x = a as unknown as { opening: boolean; door: { on: boolean; t: number } }
      window.__camOv = undefined
      damp(dy, 0, 4.2, dt); vdamp(aim!, hc.clone().add(new THREE.Vector3(0, dy.value, 0)), 6, dt)
      const A = vval(aim!), stand = x.door.on ? doorAt(Math.min(x.door.t, DOOR.end)).stand : 0
      // (until the drive is asked to open, it stays at the cover's lift: no seating before the rise)
      if (x.opening) delete lab.lift
      window.__lab = { ...lab, aim: { to: [A.x, A.y, A.z], k: 1 - stand } }
      return
    }
    if (mode === 'stop') {
      window.__lab = lab
      vdamp(aim!, hc.clone().add(new THREE.Vector3(0, dy.value, 0)), 6, dt)
      const A0 = vval(aim!)
      window.__camOv = { yaw: yaw.value, elev: elev.value, span: span.value, dist: dist.value, aim: [A0.x, A0.y, A0.z] }
      const lift = (a as unknown as { lift: Spring }).lift
      // the text may start to decrypt a little before the drive has come to rest (it lands on the settle, A5)
      dir.near = t - stopAt > 0.35 && Math.abs(lift.value - f.lift) < 0.3 && Math.abs(lift.velocity) < 0.8 && Math.abs(span.value - fspan) < 0.3
      // it can be opened once it is nearly there (a tap before that is kept)
      if (!c0 && dir.near) { c0 = hc; mark(`ready ${stopId}`); if (pending) dir.open() }
      if (c0) c0 = hc
      return
    }
    if (!c0) return
    const k = t - t0
    // closing: the page re-encrypts first (the overlay plays the open backwards); the drive goes back after it
    const opening = mode === 'opening' || mode === 'open' || (mode === 'closing' && k < 0.4)
    // ── timeline (seconds from the tap) ──
    // a read request: the drive gives a little (anticipation), then is thrown out of its slot
    damp(dip, opening && k < 0.12 ? -0.22 : 0, 18, dt)
    damp(up, opening && k >= 0.08 ? 2.8 : 0, opening ? 7.5 : 10.5, dt)
    // it turns to the reader while it rises, then stands up the way the phone is held
    damp(yawK, opening && k >= 0.2 ? 1 : 0, opening ? 6 : 7, dt)
    damp(rollK, opening && k >= 0.36 ? 1 : 0, opening ? 6.2 : 8, dt)
    // the camera comes down to the drive and closes in, a beat behind it (weight)
    damp(camK, opening && k >= 0.16 ? 1 : 0, opening ? 4.4 : 6, dt)
    if (mode === 'opening' && k > 1.6) { mode = 'open'; mark('open settled') }
    if (mode === 'closing' && k > 1.6 && up.value < 0.01) { mode = 'stop'; mark('closed') }

    const c = c0.clone().add(new THREE.Vector3(0, up.value + dip.value, 0))
    lab.pose = { c: [c.x, c.y, c.z], yaw: FACE_YAW * yawK.value, tilt: 0, roll: -Math.PI / 2 * rollK.value }
    // the rest of the archive goes back into the rack: a wave from the drive's slot outward
    // (a beat after the eject, so the eye has the drive first; slower than the drive, so it never leads)
    const w = mode === 'closing' ? Math.max(0, 1.9 - Math.max(0, k - 0.4) * 2.0) : mode === 'stop' ? 0 : k
    lab.drop = (dr, dl) => 11 * smooth((w - 0.16 - Math.hypot(dr * 0.55, dl * 2.2) * 0.03) / 0.75)
    // the selection's slot light stays in the slot: it goes out as the drive leaves it
    lab.slot = 1 - smooth(Math.min(1, up.value / 1.2))
    // the key's light: out of the secure element and along the traces as it turns
    if (opening && k >= 0.14) { if (sweepAt < 0) sweepAt = t; a.setSweep(Math.min(1, (t - sweepAt) / 0.75)) }

    // camera: from the stop's framing to the face filling the width, at its height
    const q = camK.value
    // The sealed black drive (X-000) has an opaque dark shell: where every other drive's shell clears to show its board, this one stays a slab, and seen
    // square-on its soft fresnel rim reads as a large blurred dark glow. Its cover slides off with the turn instead (the engine's own door look): the
    // board, its traces and its chip are there, hard-edged, as in every other window; closing slides it back on, so the stop is the stop.
    if (ENTRIES.find((e) => e.id === stopId)?.kind === 'restricted') lab.cover = smooth(Math.min(1, Math.max(0, (q - 0.25) / 0.6)))
    const sp = THREE.MathUtils.lerp(span.value, INNER.w / (innerWidth / innerHeight), q)
    // the face's top at the top of the screen: its centre sits (span/2 − h/2) above the aim
    const lead = THREE.MathUtils.lerp(-dy.value, sp / 2 - INNER.h / 2, q)
    vdamp(aim!, c.clone().add(new THREE.Vector3(0, -lead, 0)), 9, dt)
    const A = vval(aim!)
    window.__camOv = { yaw: VIEW.yaw, elev: THREE.MathUtils.lerp(VIEW.elev, 0, q), span: sp, dist: THREE.MathUtils.lerp(140, 70, q), aim: [A.x, A.y, A.z] }
    window.__lab = lab
  }
  return dir
}
