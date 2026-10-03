// The interior's frame loop. It owns time: it advances the clock, asks the scene to draw what the
// clock says, hands the frame to whoever draws words over it (the HTML layer), and captures evidence
// thumbnails from the live scene the moment a result exists. It also owns the way out: the intro
// played backwards, so the archive resumes from exactly the frame the cut started on.
import type { Clock } from './clock'
import type { Handoff, Space, SpaceFrame, SpaceLayout } from './scene'
import { INTRO, introCompose } from './shots'

const OUT_FLIGHT = 0.55, OUT_INTRO = 0.5
const kept = new WeakMap<Space, Record<number, string>>()

export interface Runtime {
  readonly clock: Clock
  /** the latest thumbnail per station (data URLs), once its result exists */
  thumbs(): Record<number, string>
  /** called after every drawn frame, with the frame that was drawn */
  onFrame(cb: (f: SpaceFrame) => void): () => void
  /** a new layout (the window changed, or a phone scrolled): the next frame uses it */
  setLayout(l: SpaceLayout): void
  /** play the way out; resolves on the frame the archive resumes from */
  exit(): Promise<void>
  stop(): void
}

export function startRuntime(space: Space, clock: Clock, opts: { handoff: Handoff; layout: SpaceLayout; reduced: boolean }): Runtime {
  space.handoff(opts.handoff)
  space.resize(opts.layout)
  // thumbnails belong to the space, not to one visit: a result kept from an earlier opening still has its picture
  const thumbs = kept.get(space) ?? {}; kept.set(space, thumbs)
  const cbs = new Set<(f: SpaceFrame) => void>(), pending: number[] = []
  clock.state.retained.forEach((r, i) => { if (r && !thumbs[i]) pending.push(i) })
  let raf = 0, last = 0, time = 0, layoutNext: SpaceLayout | null = null, dead = false, firstShot = false
  let out: null | { phase: 'fly' | 'intro'; t: number; from: number; into: number; done: () => void } = null

  const offRetain = clock.onRetain((a) => { if (!thumbs[a]) pending.push(a) })
  const visibility = () => { if (document.hidden) { clock.pause('away'); last = 0 } }
  document.addEventListener('visibilitychange', visibility)

  const frameOf = (): SpaceFrame => {
    const base = clock.frame()
    if (!out) return base
    if (out.phase === 'fly') return { ...base, intro: INTRO.dur, into: -1, compose: 1, travel: { to: -1, k: Math.min(1, out.t / OUT_FLIGHT) } }
    // the intro played backwards, composing the way the intro itself does (and, if it was left mid-way, out of the same shot)
    const intro = out.from * (1 - Math.min(1, out.t / OUT_INTRO))
    return { ...base, intro, into: out.into, compose: introCompose(intro), travel: null }
  }

  const loop = (now: number) => {
    if (dead) return
    raf = requestAnimationFrame(loop)
    if (document.hidden) { last = 0; return }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now
    time += dt
    if (layoutNext) { space.resize(layoutNext); layoutNext = null }
    if (out) {
      out.t += dt
      // (having flown back to the hub, the way out starts the intro backwards from there, not from its end)
      if (out.phase === 'fly' && (out.t >= OUT_FLIGHT || opts.reduced)) { out.phase = 'intro'; out.t = 0; out.from = INTRO.hubAt }
      else if (out.phase === 'intro' && (out.t >= OUT_INTRO || opts.reduced)) { const done = out.done; out = null; dead = true; cancelAnimationFrame(raf); done(); return }
    } else clock.tick(dt)
    const f = frameOf()
    space.update(f, dt, time); space.render()
    // evidence: the thumbnail is the result's own framing of the live scene, drawn once, the frame after it exists
    if (pending.length && !out) {
      for (const a of pending.splice(0)) thumbs[a] = space.thumbnail(a)
      space.update(f, 0, time); space.render()   // thumbnailing drew another view into the canvas: put this frame back
    }
    if (!firstShot) { firstShot = true; const w = window as unknown as { __cfCaptureCut?: boolean; __cutInterior?: string }; if (w.__cfCaptureCut) w.__cutInterior = space.canvas.toDataURL('image/png') }
    cbs.forEach((cb) => cb(f))
  }
  raf = requestAnimationFrame(loop)

  return {
    clock,
    thumbs: () => thumbs,
    onFrame(cb) { cbs.add(cb); return () => { cbs.delete(cb) } },
    setLayout(l) { layoutNext = l },
    exit() {
      return new Promise<void>((done) => { const from = Math.min(INTRO.dur, clock.state.intro); out = { phase: from < INTRO.dur ? 'intro' : 'fly', t: 0, from, into: from < INTRO.dur ? clock.state.area : -1, done } })
    },
    stop() { dead = true; cancelAnimationFrame(raf); offRetain(); document.removeEventListener('visibilitychange', visibility) },
  }
}

/** the canvas and the region the subject is composed into: the space left of the file column on a desktop, the top of the sheet on a phone */
export function defaultLayout(): SpaceLayout {
  const width = innerWidth, height = innerHeight
  return width < 900 ? { width, height, cx: 0.5, cy: 0.3, rw: 1, rh: 0.58 } : { width, height, cx: 0.29, cy: 0.5, rw: 0.58, rh: 0.66 }
}
