// The interior's clip player: one clip at a time on the stage's pool, with what the stage's own step runner does not do:
//   - a clip can be HELD (frozen on its last frame, on top) so that the next one takes over without a still between them (the interior's
//     clips run into one another: intro -> station -> flight -> station ...);
//   - a held (or paused) frame can be cross-faded into the next clip's first frame (a pick in the middle of a sequence, 180 ms);
//   - a clip can be sought to a frame and held there (a step dot);
//   - it can be paused and resumed without the watchdogs landing it.
// It uses the stage's pool and stills (public) and nothing of the stage's step state, so it may only run while the stage is not running a step.
import { pageIndex } from '../clock'
import type { Stage } from '../stage/stage'

export type PlayResult = 'done' | 'aborted' | 'failed'
export interface PlayOpts {
  /** a still to fade out over the clip's first frame (the picture the clip starts from, when it is a still) */
  from?: string
  rate?: number
  /** a held or paused video is on screen: fade it out over this long once this clip's first frame is up (else it is taken away at once) */
  crossMs?: number
  /** called for every presented frame: the (fractional) page position with the half-frame lead, the media time, the frame index */
  onFrame(pos: number, mediaTime: number, index: number): void
  /** start from this clip frame instead of the first (a resume from a held step) */
  startFrame?: number
  /** called once, when the first frame is on the compositor */
  onFirst?(): void
}
const STILL_FADE_MS = 100, FADE_OUT_MS = 120, START_WATCHDOG_MS = 1500, FRAME_WATCHDOG_MS = 1500, READY_WAIT_MS = 3000

const once = (t: EventTarget, type: string, ms: number) => new Promise<void>((res) => { const f = () => { clearTimeout(h); t.removeEventListener(type, f); res() }; const h = setTimeout(f, ms); t.addEventListener(type, f) })

export class ClipPlayer {
  /** the video that is on top, frozen (its clip's last frame, a seek, or the frame a pick stopped on) */
  held: HTMLVideoElement | null = null
  private busy = new Set<HTMLVideoElement>()
  private cur: { v: HTMLVideoElement; stop(): void } | null = null
  private userPaused = false
  /** frames the clip has presented so far (for tests) */
  presented = 0

  private stage: Stage
  private urlOf: (key: string) => string | undefined
  constructor(stage: Stage, urlOf: (key: string) => string | undefined) { this.stage = stage; this.urlOf = urlOf }

  get playing() { return !!this.cur }
  get paused() { return this.userPaused }

  /** attach a clip to a pool element now so it is buffered when it is needed */
  load(key: string) {
    if (this.stage.mode !== 'clips') return null
    const u = this.urlOf(key); if (!u) return null
    const v = this.stage.pool.assign(key, u, this.busy)
    if (v) { v.style.visibility = ''; v.style.opacity = '' }
    return v
  }
  isReady(key: string) { const v = this.stage.pool.holding(key); return !!v && v.readyState >= 3 }

  /** play a clip from its first frame; resolves when its last frame has been presented (the video stays on top, held), or when it was stopped or could not start */
  async play(key: string, clip: { frames: number; fps: number }, o: PlayOpts): Promise<PlayResult> {
    const st = this.stage
    if (st.mode !== 'clips') return 'failed'
    const v = st.pool.holding(key) ?? this.load(key) ?? undefined
    if (!v) return 'failed'
    if (v.readyState < 3) await once(v, 'canplay', READY_WAIT_MS)   // (a held frame stays on screen while it waits)
    if (v.readyState < 3) return 'failed'
    const from0 = o.startFrame ? o.startFrame / clip.fps + 0.001 : 0
    if (Math.abs(v.currentTime - from0) > 0.001) { v.currentTime = from0; await once(v, 'seeked', 300) }
    v.style.visibility = ''; v.style.opacity = ''
    this.busy.add(v); st.pool.touch(v)
    v.playbackRate = o.rate ?? 1
    const last = clip.frames - 1, fps = clip.fps, hasRvfc = typeof v.requestVideoFrameCallback === 'function'
    return new Promise<PlayResult>((resolve) => {
      let first = true, ended = false, handle = 0, seen = v.currentTime, polled = 0
      const t: { start?: ReturnType<typeof setTimeout>; frame?: ReturnType<typeof setTimeout>; flip?: ReturnType<typeof setTimeout> } = {}
      const clear = () => { clearTimeout(t.start); clearTimeout(t.frame); v.removeEventListener('ended', onEnded); if (hasRvfc && handle) v.cancelVideoFrameCallback(handle) }
      const finish = (r: PlayResult) => {
        if (ended) return
        ended = true; clear(); this.cur = null
        if (r === 'done') { v.classList.add('on'); this.held = v; v.playbackRate = 1 }
        else if (r === 'aborted' && !first) { v.pause(); v.playbackRate = 1; v.classList.add('on'); this.held = v }   // frozen where it stands, visible
        else { v.pause(); v.playbackRate = 1; try { v.currentTime = 0 } catch { /* */ } this.busy.delete(v) }
        resolve(r)
      }
      const onEnded = () => { o.onFrame(last, last / fps, last); finish('done') }
      const arm = () => { clearTimeout(t.frame); t.frame = setTimeout(() => { if (this.userPaused || document.hidden) arm(); else finish('done') }, FRAME_WATCHDOG_MS) }
      const cb = (_now: number, meta: { mediaTime: number; presentedFrames: number }) => {
        if (ended) return
        clearTimeout(t.start)
        if (first) {
          first = false
          const from = o.from ? st.stills.get(o.from) : undefined
          if (from) { from.classList.add('fadeout'); from.style.opacity = '0' }
          const h = this.held
          if (h && h !== v) {
            if (o.crossMs && o.crossMs > 0) { h.style.transition = `opacity ${o.crossMs}ms linear`; h.style.opacity = '0'; setTimeout(() => this.release(h), o.crossMs + 40) }
            else { v.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => this.release(h))) }   // video to video, no crossfade: the new one goes on top now and the old one (its last frame is the new one's first) stays two frames, until the new one has been composited: a clip that is not composited yet would show whatever stale frame lies under it
            this.held = null
          }
          const delay = h && o.crossMs ? o.crossMs + 30 : STILL_FADE_MS + 20
          t.flip = setTimeout(() => { v.classList.add('on'); from?.classList.remove('fadeout') }, h && !o.crossMs ? 0 : delay)
          if (!h && !from) v.classList.add('on')
          o.onFirst?.()
        }
        this.presented++
        const index = Math.round(meta.mediaTime * fps)
        o.onFrame(pageIndex(meta.mediaTime, fps, last), meta.mediaTime, index)
        if (index >= last) { finish('done'); return }
        arm(); next()
      }
      const next = () => {
        if (hasRvfc) { handle = v.requestVideoFrameCallback((n, m) => cb(n, m)); return }
        const poll = (now: number) => { if (ended) return; if (v.currentTime !== seen) { seen = v.currentTime; cb(now, { mediaTime: seen, presentedFrames: ++polled }) } else requestAnimationFrame(poll) }
        requestAnimationFrame(poll)
      }
      this.cur = { v, stop: () => finish('aborted') }
      v.addEventListener('ended', onEnded, { once: true })
      next()
      t.start = setTimeout(() => finish('failed'), START_WATCHDOG_MS)
      let p: Promise<void>
      try { p = st.pool.play(v) } catch (e) { p = Promise.reject(e) }
      p.catch((e: unknown) => { if ((e as { name?: string })?.name === 'NotAllowedError') { st.mode = 'stills'; st.rejects++ } if (first) finish('failed') })
      this.userPaused = false
    })
  }

  /** stop what is playing and keep its frame on screen, frozen (a pick or a way out in the middle of a clip) */
  abort() { this.cur?.stop() }
  pause() { this.userPaused = true; this.cur?.v.pause() }
  resume() { this.userPaused = false; const v = this.cur?.v; if (v) void this.stage.pool.play(v).catch(() => undefined) }
  /** the page went to the background / came back (not the visitor's pause) */
  suspend() { this.cur?.v.pause() }
  wake() { if (!this.userPaused) { const v = this.cur?.v; if (v) void this.stage.pool.play(v).catch(() => undefined) } }

  /** put a clip on top, paused on frame `frame`, and hold it there (a step dot) */
  async seek(key: string, fps: number, frame: number): Promise<boolean> {
    const st = this.stage
    if (st.mode !== 'clips') return false
    const v = st.pool.holding(key) ?? this.load(key) ?? undefined
    if (!v) return false
    if (v.readyState < 3) await once(v, 'canplay', READY_WAIT_MS)
    if (v.readyState < 1) return false
    this.cur?.stop()
    v.pause(); v.playbackRate = 1; v.style.visibility = ''; v.style.opacity = ''
    this.busy.add(v); st.pool.touch(v)
    const at = (frame + 0.25) / fps
    v.currentTime = at
    await once(v, 'seeked', 1500)
    // the frame is decoded once a video frame callback (or two animation frames) has passed
    await new Promise<void>((res) => {
      if (typeof v.requestVideoFrameCallback === 'function') { v.requestVideoFrameCallback(() => res()); void st.pool.play(v).then(() => v.pause()).catch(() => res()); setTimeout(res, 400) }
      else requestAnimationFrame(() => requestAnimationFrame(() => res()))
    })
    v.pause(); v.currentTime = at
    await once(v, 'seeked', 400)
    st.stills.show('')
    const h = this.held
    if (h && h !== v) this.release(h)
    v.classList.add('on'); this.held = v
    return true
  }

  /** a still goes under the held video, which then fades out: the picture is the still's from here on */
  async land(key: string): Promise<void> {
    const st = this.stage
    await st.loadStill(key)
    st.show(key)
    const h = this.held; this.held = null
    if (!h) return
    h.classList.add('on', 'fade'); h.style.opacity = '0'
    await new Promise<void>((res) => setTimeout(res, FADE_OUT_MS + 40))
    this.release(h)
  }

  /** take a held video off the screen and give its element back to the pool */
  private release(v: HTMLVideoElement) {
    // hidden, not just taken off the top: a released element is rewound below, and for the 120 ms until the next clip is on top it must not show its first frame
    v.classList.remove('on', 'fade'); v.style.opacity = ''; v.style.transition = ''; v.style.visibility = 'hidden'
    v.pause(); this.busy.delete(v)
    try { v.currentTime = 0 } catch { /* */ }
  }
  /** nothing is held any more (the interior was left) */
  clear() { this.cur?.stop(); const h = this.held; this.held = null; if (h) this.release(h); this.busy.clear() }
}
