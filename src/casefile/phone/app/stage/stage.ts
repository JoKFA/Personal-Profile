// The phone's stage: a full-bleed stack of still <img>s and a pool of <video>s, nothing else (no three.js, no scene code).
// Handoff rules (plan §2.4, measured in P0):
//   still -> clip: the still stays until the clip's first frame has been presented (requestVideoFrameCallback), then it goes;
//   clip -> still: the target still goes under the clip's last frame, then the clip fades out over 120 ms;
//   never a blank or black frame: exactly one still is opaque whenever no clip is on top.
// play() refused (NotAllowedError: iOS low-power mode, data saver) -> the whole session runs "stills + crossfade";
// a clip that is not buffered in time, or never starts, is replaced by a crossfade for that one step.
// The page layer is told the time of each presented frame through StepSpec.onTick (media clock + one frame of lead).
import { smooth } from '../../../motion/waves'
import { pageIndex, pageTime } from '../clock'
import type { Fit } from '../fit'
import { VideoPool } from './pool'
import { Stills } from './stills'

export type StageMode = 'clips' | 'stills'

export interface StepSpec {
  /** the pool key of the clip to play; null = there is none, only a crossfade */
  clipKey: string | null
  clip: { frames: number; fps: number } | null
  /** still keys: where the step starts and where it lands */
  from: string
  to: string
  /** seconds the step lasts when no clip plays (a pan: the fade's length; an open or close: the clip's own length) */
  duration: number
  /** the crossfade's window inside `duration`: [start, length] seconds */
  fade: [number, number]
  /** playback speed of the clip (a close that hands over to another file runs 1.5x); the page layer follows the clip's own media time, so it needs nothing else */
  rate?: number
  /** when the input that caused the step arrived (performance.now), for the latency record */
  inputAt?: number
  /** the clip's first frame has been presented (the entrance: the entry page starts to leave over it) */
  onFirstFrame?(): void
  /** time (s), clip-frame index and progress 0..1 the page layer should show; called for every presented frame (clip) or animation frame (fade) */
  onTick(time: number, index: number, k: number): void
}

export interface FrameRecord { clip: string; t: number; mediaTime: number; presented: number; index: number; domIndex: number }
export interface HandoffRecord { clip: string; via: 'clip' | 'fade'; inputAt: number; playAt: number; firstFrameAt: number; latencyMs: number; endAt: number; stillShownAt: number }

const FADE_OUT_MS = 120
/** still -> clip: the start still fades out over this long once the clip's first frame is presented (4 frames at 25 fps) */
const STILL_FADE_MS = 100
/** a clip not ready this long after the step is asked for is replaced by a crossfade */
const BUFFER_GRACE_MS = 150
/** no first frame this long after play(): crossfade instead */
const START_WATCHDOG_MS = 1200
/** no frame this long during playback: land on the target at once */
const FRAME_WATCHDOG_MS = 1500

const once = (target: EventTarget, type: string, ms: number) => new Promise<void>((res) => { const f = () => { clearTimeout(t); target.removeEventListener(type, f); res() }; const t = setTimeout(f, ms); target.addEventListener(type, f) })

export class Stage {
  /** the clipped, fixed box (the screen) */
  readonly box: HTMLElement
  /** the master picture; moved and scaled by the fit */
  readonly el: HTMLElement
  readonly stills: Stills
  readonly pool: VideoPool
  mode: StageMode = 'clips'
  /** a session's evidence for tests: every presented frame and every handoff */
  record = false
  readonly frames: FrameRecord[] = []
  readonly handoffs: HandoffRecord[] = []
  rejects = 0
  fades = 0

  private urls = new Map<string, string>()
  private shownKey: string | null = null
  private pinned = new Set<string>()
  private active = new Set<HTMLVideoElement>()
  private abortStep: (() => void) | null = null
  /** a step stopped by abortTo lands here instead of on its own target */
  private land: { key: string; ms: number } | null = null
  /** bumped by abortTo: a run that was still getting ready when it was called does not start */
  private epoch = 0
  private playing: HTMLVideoElement | null = null
  private primed = false

  constructor(parent: HTMLElement, master: { w: number; h: number }) {
    this.box = document.createElement('div'); this.box.className = 'ph-stagebox'; this.box.setAttribute('aria-hidden', 'true')
    this.el = document.createElement('div'); this.el.className = 'ph-stage'
    this.el.style.width = `${master.w}px`; this.el.style.height = `${master.h}px`
    this.box.appendChild(this.el); parent.appendChild(this.box)
    this.stills = new Stills(this.el, 6)
    this.pool = new VideoPool(this.el, 3)
  }

  get current() { return this.shownKey }
  register(key: string, url: string) { this.urls.set(key, url) }
  setFit(f: Fit) { this.el.style.transform = `translate(${f.tx}px, ${f.ty}px) scale(${f.s})` }
  /** the keys that must stay in memory */
  pin(keys: Iterable<string>) { this.pinned = new Set(keys); if (this.shownKey) this.pinned.add(this.shownKey) }

  loadStill(key: string) { const u = this.urls.get(key); return u ? this.stills.load(key, u, this.pinned) : Promise.resolve() }
  /** attach a clip to a pool element so it is buffered before it is needed (not in "stills" mode: then no clip is ever played) */
  loadClip(key: string) {
    if (this.mode !== 'clips') return
    const u = this.urls.get(key); if (!u) return
    this.pool.assign(key, u, this.active)
  }
  /** resolves when the clip on its element can play through (or after `ms`: then the step that wants it cross-fades) */
  async buffered(key: string, ms: number) {
    const v = this.pool.holding(key)
    if (v && v.readyState < 3) await once(v, 'canplaythrough', ms)
  }
  /** make `key` the only opaque still */
  show(key: string) { this.stills.show(key); this.shownKey = key; this.pinned.add(key) }

  /** the first touch: every pool element is played and paused once, which unlocks them where a gesture is required (P4 calls this inside the fingerprint hold) */
  prime() {
    if (this.primed || this.mode !== 'clips') return
    const live = this.pool.els.filter((v) => v.getAttribute('src') && !this.active.has(v))
    if (!live.length) return
    this.primed = true
    for (const v of live) {
      this.pool.play(v).then(() => { if (!this.active.has(v)) { v.pause(); try { v.currentTime = 0 } catch { /* */ } } }).catch((e: unknown) => { if ((e as { name?: string })?.name === 'NotAllowedError') this.refused() })
    }
  }
  private refused() { this.mode = 'stills'; this.rejects++ }
  /** reduced motion: stills and crossfades only (no clip is fetched or played); back to clips if it is turned off and play() was never refused (P5) */
  setReduced(on: boolean) { if (on) this.mode = 'stills'; else if (!this.rejects) this.mode = 'clips' }

  /** run one step: a clip when there is one buffered and playable, otherwise a crossfade */
  async run(spec: StepSpec): Promise<'clip' | 'fade'> {
    const inputAt = spec.inputAt ?? performance.now(), epoch = this.epoch
    await Promise.race([Promise.all([this.stills.ready(spec.from), this.stills.ready(spec.to)]), new Promise((r) => setTimeout(r, 1500))])
    if (epoch !== this.epoch) return 'fade'   // (stopped by abortTo before it began)
    let v: HTMLVideoElement | undefined
    if (this.mode === 'clips' && spec.clipKey && spec.clip) {
      v = this.pool.holding(spec.clipKey)
      if (!v) this.loadClip(spec.clipKey)   // not attached: this step cross-fades, the next one can play
      else {
        if (v.readyState < 3) await once(v, 'canplay', BUFFER_GRACE_MS)
        if (v.currentTime > 0.001) { v.currentTime = 0; await once(v, 'seeked', 300) }
        if (v.readyState < 3) v = undefined
        if (epoch !== this.epoch) return 'fade'
      }
    }
    if (v && this.mode === 'clips') {
      this.active.add(v); this.pool.touch(v)
      const ok = await this.playClip(spec, v, inputAt)
      this.active.delete(v)
      if (ok) return 'clip'
    }
    this.fades++
    const t0 = performance.now()
    await this.fade(spec)
    if (this.record) this.handoffs.push({ clip: spec.clipKey ?? '(none)', via: 'fade', inputAt, playAt: t0, firstFrameAt: t0, latencyMs: 0, endAt: performance.now(), stillShownAt: performance.now() })
    return 'fade'
  }

  /** the crossfade path: the target still fades in over the (opaque) start still; the page layer runs on the animation clock */
  private fade(spec: StepSpec): Promise<void> {
    return new Promise((resolve) => {
      const to = this.stills.get(spec.to), from = this.stills.get(spec.from)
      const fps = spec.clip?.fps ?? 25, last = spec.clip ? spec.clip.frames - 1 : Math.max(1, Math.floor(spec.duration * fps))
      const [at, len] = spec.fade
      const t0 = performance.now()
      let done = false
      const finish = () => {
        if (done) return; done = true; this.abortStep = null
        const land = this.land
        if (land && to && to !== from) {
          // stopped by abortTo: the target still (partly in) goes back out over `ms`, and the landing still is the picture from now on
          this.shownKey = land.key; this.pinned.add(land.key)
          if (land.ms > 0) { to.style.transition = `opacity ${land.ms}ms linear`; to.style.opacity = '0' }
          setTimeout(() => { to.style.transition = ''; if (this.shownKey === land.key) this.stills.show(land.key) }, land.ms + 20)
        } else this.show(land ? land.key : spec.to)
        resolve()
      }
      this.abortStep = () => { if (!this.land) spec.onTick(spec.duration, last, 1); finish() }
      const frame = (now: number) => {
        if (done) return
        const t = Math.min(spec.duration, (now - t0) / 1000 * (spec.rate ?? 1))
        spec.onTick(t, Math.min(last, t * fps), t / spec.duration)
        if (to && to !== from) { to.style.zIndex = '4'; to.style.opacity = String(smooth((t - at) / Math.max(0.001, len))) }
        if (t >= spec.duration) finish(); else requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
  }

  private playClip(spec: StepSpec, v: HTMLVideoElement, inputAt: number): Promise<boolean> {
    const clip = spec.clip!, fps = clip.fps, last = clip.frames - 1, dur = clip.frames / fps, name = spec.clipKey!
    const rec: HandoffRecord = { clip: name, via: 'clip', inputAt, playAt: 0, firstFrameAt: 0, latencyMs: 0, endAt: 0, stillShownAt: 0 }
    return new Promise<boolean>((resolve) => {
      let first = true, ended = false, started = false, handle = 0, polled = 0
      const wd: { start?: ReturnType<typeof setTimeout>; frame?: ReturnType<typeof setTimeout>; flip?: ReturnType<typeof setTimeout> } = {}
      const hasRvfc = typeof v.requestVideoFrameCallback === 'function'
      let seen = v.currentTime
      const clear = () => { clearTimeout(wd.start); clearTimeout(wd.frame); clearTimeout(wd.flip); v.removeEventListener('ended', onEnded); if (hasRvfc && handle) v.cancelVideoFrameCallback(handle) }
      /** could not start: nothing was shown of the clip, the start still is untouched */
      const bail = () => {
        if (ended) return; ended = true; clear(); this.abortStep = null; this.playing = null
        v.pause(); v.playbackRate = 1; try { v.currentTime = 0 } catch { /* */ }
        resolve(false)
      }
      const end = () => {
        if (ended) return; ended = true; clear(); this.abortStep = null
        rec.endAt = performance.now()
        // the target still goes under the clip's last frame (the clip is above the stills now), then the clip fades out (a step stopped by abortTo: the landing still, over `ms`)
        const land = this.land
        v.classList.add('on'); this.show(land ? land.key : spec.to); rec.stillShownAt = performance.now()
        v.classList.add('fade'); if (land) v.style.transition = `opacity ${land.ms}ms linear`; v.style.opacity = '0'
        let done = false
        const fin = () => {
          if (done) return; done = true
          v.classList.remove('fade', 'on'); v.style.opacity = ''; v.style.transition = ''; v.pause(); v.playbackRate = 1; this.playing = null
          try { v.currentTime = 0 } catch { /* */ }
          if (this.record) this.handoffs.push(rec)
          resolve(true)
        }
        v.addEventListener('transitionend', fin, { once: true }); setTimeout(fin, (land ? land.ms : FADE_OUT_MS) + 80)
      }
      const onEnded = () => { spec.onTick(dur, last, 1); end() }
      const cb = (now: number, meta: VideoFrameCallbackMetadata) => {
        if (ended) return
        clearTimeout(wd.start); clearTimeout(wd.frame)
        if (first) {
          first = false; started = true; rec.firstFrameAt = now; rec.latencyMs = now - inputAt
          spec.onFirstFrame?.()
          // the clip's first frame is on the compositor (the clip sits below the still, playing): the start still fades out over it for 100 ms,
          // then the clip goes above the stills (where the end of the step needs it)
          const from = this.stills.get(spec.from)
          if (from) { from.classList.add('fadeout'); from.style.opacity = '0' }
          wd.flip = setTimeout(() => { v.classList.add('on'); from?.classList.remove('fadeout') }, STILL_FADE_MS + 20)
        }
        const index = Math.round(meta.mediaTime * fps), domIndex = pageIndex(meta.mediaTime, fps, last)
        const pt = pageTime(meta.mediaTime, fps, dur); spec.onTick(pt, domIndex, pt / dur)
        if (this.record) this.frames.push({ clip: name, t: now, mediaTime: meta.mediaTime, presented: meta.presentedFrames, index, domIndex })
        if (index >= last) { end(); return }
        wd.frame = setTimeout(end, FRAME_WATCHDOG_MS)
        next()
      }
      const next = () => {
        if (hasRvfc) { handle = v.requestVideoFrameCallback(cb); return }
        // no requestVideoFrameCallback: the video's clock, polled each animation frame (it moves when the picture does)
        const poll = (now: number) => { if (ended) return; if (v.currentTime !== seen) { seen = v.currentTime; cb(now, { mediaTime: seen, presentedFrames: ++polled } as VideoFrameCallbackMetadata) } else requestAnimationFrame(poll) }
        requestAnimationFrame(poll)
      }
      this.abortStep = () => { if (started) { if (!this.land) spec.onTick(dur, last, 1); end() } else bail() }
      this.playing = v
      v.playbackRate = spec.rate ?? 1
      v.addEventListener('ended', onEnded, { once: true })
      next()
      rec.playAt = performance.now()
      wd.start = setTimeout(bail, START_WATCHDOG_MS)
      let p: Promise<void>
      try { p = this.pool.play(v) } catch (e) { p = Promise.reject(e) }
      p.catch((e: unknown) => { if ((e as { name?: string })?.name === 'NotAllowedError') this.refused(); if (!started) bail() })
    })
  }

  /** the page went to the background: nothing plays there */
  suspend() { this.playing?.pause() }
  resume() { const v = this.playing; if (v) void this.pool.play(v).catch(() => undefined) }
  /** back from the bfcache (or any restore): buffers may be gone; a running step lands, the clips are attached again */
  resync() { this.abortStep?.(); this.pool.reattach(); if (this.shownKey) this.show(this.shownKey) }
  /** a running step lands on its target at once */
  finish() { this.abortStep?.() }
  /**
   * Stop the running step where it stands and go to `key` (the still of the stop it started from) over `ms` (0: at once): the clip's frame cross-fades into it.
   * A step that has not begun yet never will. Resolves when the picture is `key`'s.
   */
  async abortTo(key: string, ms: number): Promise<void> {
    this.epoch++
    await this.loadStill(key)
    this.land = { key, ms }
    try { this.abortStep?.() } finally { this.land = null }
    if (this.shownKey !== key) await this.run({ clipKey: null, clip: null, from: this.shownKey ?? key, to: key, duration: ms / 1000, fade: [0, ms / 1000], onTick: () => {} })
    else if (ms > 0) await new Promise<void>((r) => setTimeout(r, ms))
  }

  /** what is on top of what, for the tests: every layer with any opacity, bottom first */
  layers() {
    const out: { name: string; el: HTMLElement; alpha: number; z: number }[] = []
    for (const e of [...this.stills.keys().map((k) => this.stills.get(k)!), ...this.pool.els]) {
      const cs = getComputedStyle(e), alpha = Number(cs.opacity)
      if (alpha > 0) out.push({ name: e.dataset.key ?? e.tagName.toLowerCase(), el: e, alpha, z: Number(cs.zIndex) || 0 })
    }
    return out.sort((a, b) => a.z - b.z)
  }

  dispose() { this.abortStep?.(); this.box.remove() }
}

