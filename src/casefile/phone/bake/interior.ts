// The interior for the bake (P3c): the page side of the profile drive's door and inside. It drives the REAL interior: the space built by
// bootSpace, its clock (space/clock.ts), its runtime loop (space/runtime.ts: the tour, the way out) and the archive's own close() for the
// door running backwards. No pose is made here: the bake only chooses which clock state a shot starts from and reads the picture's numbers
// (where each chip's anchor is, where the evidence plate is) after each drawn frame. Only built in `vite build --mode bake` and in dev.
import { bootSpace } from '../../space/boot'
import { startRuntime, type Runtime } from '../../space/runtime'
import { AREA_CONTENT } from '../../space/content'
import { INTRO } from '../../space/shots'
import { RESULT_AT, STEP_AT } from '../../space/station'
import type { Handoff, Space, SpaceFrame, SpaceLayout } from '../../space/scene'
import type { Clock, ClockState } from '../../space/clock'
import type { Archive } from '../../scene/archive'

/** the master canvas and the subject's region in it (PM, 10-13): region y 64–536 of 960 */
export const SPACE_LAYOUT: SpaceLayout = { width: 480, height: 960, cx: 0.5, cy: 300 / 960, rw: 1, rh: 472 / 960 }
/** the tour's frame step (the bake's 25 fps) */
const DT = 0.04

export interface InteriorSample {
  /** the frame the runtime drew last */
  frame: { intro: number; area: number; p: number; into: number; compose: number; travel: { to: number; k: number } | null } | null
  clock: { intro: number; area: number; p: number; travel: { to: number; t: number; dur: number } | null; tour: boolean; playing: boolean; reason: string; retained: boolean[] }
  /** chips (phone: true) of the frame's station: anchor in canvas px, in front of the camera */
  chips: { chip: number; at: string; x: number; y: number; on: boolean }[]
  plate: { x: number; y: number } | null
  /** the runtime is alive and drawing the interior */
  drawing: boolean
  /** the archive is standing still (the interior has the canvas); false again once the door runs backwards */
  suspended: boolean
  /** archive.close() (the desktop's whole way out) has finished */
  closed: boolean
  /** the door is running (forwards or backwards) / is open (the interior is behind it) */
  doorOn: boolean; doorOpen: boolean
}

export function createInterior() {
  // (suspended is the archive's private flag: the door's cut sets it; sessions that skip the door set it here)
  const archive = window.__cf as unknown as { suspended: boolean; interior: null | { exit: () => Promise<void> } }
  const host = window.__cf as Archive
  const doorOf = () => (window.__cf as unknown as { door: { on: boolean; open: boolean } }).door
  let space: Space | null = null, clock: Clock | null = null, rt: Runtime | null = null, last: SpaceFrame | null = null
  let off: (() => void) | null = null, closed = false
  const api = {
    get booted() { return !!space },
    get drawing() { return !!rt },
    /** build the interior on the archive's renderer, as the desktop does once the archive is on screen */
    async boot() { if (space) return; const b = await bootSpace(host, false); space = b.space; clock = b.clock; (window as unknown as { __space?: Space }).__space = space },
    get clock() { return clock! },
    get space() { return space! },
    restart(tour = true) { clock!.restart(tour) },
    /** the archive stands still while the interior draws (a door's cut does this itself) */
    suspend() { archive.suspended = true },
    /** the clock's tick, without drawing: the tour's own state, reached a frame at a time (pure) */
    fastForward(until: 'intro' | 'arrive' | 'flight' | 'result' | 'done', area = 0) {
      const c = clock!
      const hit = (s: ClockState) => {
        if (until === 'intro') return s.intro >= INTRO.dur
        if (until === 'arrive') return s.intro >= INTRO.dur && !s.travel && s.area === area && s.p === 0
        if (until === 'flight') return !!s.travel && s.travel.to === area && s.travel.t === 0
        if (until === 'result') return s.intro >= INTRO.dur && !s.travel && s.area === area && s.p >= 1
        return !s.playing && s.reason === 'done'
      }
      for (let n = 0; n < 20000 && !hit(c.state); n++) c.tick(DT)
      if (!hit(c.state)) throw new Error('the clock never reached ' + until + ' ' + area)
    },
    /** start the runtime (the interior's own loop) from the clock's state */
    start(h: Handoff) {
      if (rt) rt.stop()
      rt = startRuntime(space!, clock!, { handoff: h, layout: SPACE_LAYOUT, reduced: false })
      off?.(); off = rt.onFrame((f) => { last = f })
      archive.interior = { exit: () => rt!.exit() }
    },
    stop() { rt?.stop(); rt = null; off?.(); off = null },
    /** the way out, as the desktop plays it: the flight to the hub, then the intro backwards */
    exit(): Promise<void> { return rt!.exit() },
    /** the desktop's whole way out: archive.close() plays the interior's exit, then the door backwards, then the drive's landing */
    closeArchive() { closed = false; void host.close(Promise.resolve()).then(() => { closed = true }) },
    thumbs() { return rt ? rt.thumbs() : {} },
    /** the hub as the runtime draws it at the end of the flight out (travel to −1 at k = 1) */
    showHub(retained: boolean) {
      const f: SpaceFrame = { intro: INTRO.dur, area: 0, into: -1, p: 0, travel: { to: -1, k: 1 }, retained: Array(6).fill(retained), compose: 1 }
      space!.update(f, DT, 0); space!.render(); last = f
    },
    sample(): InteriorSample {
      const s = clock!.state, door = doorOf()
      const f = last, out: InteriorSample = {
        frame: f ? { intro: f.intro, area: f.area, p: f.p, into: f.into, compose: f.compose, travel: f.travel } : null,
        clock: { intro: s.intro, area: s.area, p: s.p, travel: s.travel, tour: s.tour, playing: s.playing, reason: s.reason, retained: s.retained },
        chips: [], plate: null, drawing: !!rt, suspended: archive.suspended, closed, doorOn: door.on, doorOpen: door.open,
      }
      if (f && rt) {
        const i = f.area
        if (f.intro >= INTRO.dur && (!f.travel || f.travel.k === 0)) {
          const an = space!.anchors(i)
          AREA_CONTENT[i].chips.forEach((c, n) => { if (c.phone && an[c.at]) out.chips.push({ chip: n, at: c.at, x: an[c.at].x, y: an[c.at].y, on: an[c.at].on }) })
          out.plate = space!.plateScreen(i)
        }
      }
      return out
    },
    areas: () => AREA_CONTENT.map((a) => ({ key: a.key, entry: a.entry, chips: a.chips.map((c) => ({ at: c.at, phone: !!c.phone })) })),
    constants: { RESULT_AT, STEP_AT: [...STEP_AT], INTRO_DUR: INTRO.dur, HUB_AT: INTRO.hubAt, LAYOUT: SPACE_LAYOUT },
  }
  return api
}
export type Interior = ReturnType<typeof createInterior>
