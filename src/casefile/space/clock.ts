// The show's one clock (spec R12). Camera, actions and evidence all read this state and nothing
// else, so pausing it pauses everything and nothing can drift out of step. Pure TypeScript.
//
// Two layers of pace: the first visit's guided tour (short, one mechanism per station) and a
// visitor's own pick (the full four steps, slower, stopping on the result). A pick stops the tour.
// Reading pauses it; a hidden tab pauses it and nothing catches up afterwards; only an explicit
// resume (or a new pick) starts it again.
import { INTRO, introCompose } from './shots'
import { RESULT_AT, STEP_AT } from './station'
import { AREAS } from './layout'
import type { SpaceFrame } from './scene'

export const TOUR_SECONDS = 5.0
export const DETAIL_FACTOR = 1.65
export const FLIGHT_SECONDS = 1.8
export type Pause = '' | 'reading' | 'away' | 'user' | 'done'

export interface ClockState {
  /** seconds since the cut; the intro plays while under INTRO.dur */
  intro: number
  area: number
  p: number
  travel: { to: number; t: number; dur: number } | null
  tour: boolean
  detail: boolean
  playing: boolean
  reason: Pause
  retained: boolean[]
  /** the order evidence was produced in (an index entry per station, once) */
  order: number[]
  compose: number
  /** bumps on every change the UI should see */
  revision: number
}

const N = AREAS.length
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function createClock({ reduced = false }: { reduced?: boolean } = {}) {
  let s: ClockState = {
    intro: reduced ? INTRO.dur : 0, area: 0, p: reduced ? 1 : 0, travel: null, tour: !reduced, detail: false,
    playing: !reduced, reason: reduced ? 'done' : '', retained: Array(N).fill(false), order: [], compose: reduced ? 1 : 0, revision: 0,
  }
  const listeners = new Set<() => void>(), retainedCbs = new Set<(area: number) => void>()
  const emit = () => { s = { ...s, revision: s.revision + 1 }; listeners.forEach((f) => f()) }
  const duration = () => TOUR_SECONDS * (s.detail ? DETAIL_FACTOR : 1)
  const retain = (area: number) => {
    if (s.retained[area]) return
    const retained = [...s.retained]; retained[area] = true
    s = { ...s, retained, order: [...s.order, area] }
    retainedCbs.forEach((f) => f(area))
  }
  if (reduced) { s.retained[0] = true; s.order = [0] }
  const settleIntro = () => { if (s.intro < INTRO.dur) s = { ...s, intro: INTRO.dur, compose: 1 } }
  const flyTo = (to: number, dur = FLIGHT_SECONDS) => { s = { ...s, travel: { to, t: 0, dur } } }

  return {
    get state() { return s },
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } },
    onRetain(f: (area: number) => void) { retainedCbs.add(f); return () => { retainedCbs.delete(f) } },
    /** what the renderer draws */
    frame(): SpaceFrame {
      return { intro: s.intro, area: s.area, into: s.area, p: s.p, travel: s.travel ? { to: s.travel.to, k: clamp01(s.travel.t / s.travel.dur) } : null, retained: s.retained, compose: s.compose }
    },

    /** advance by dt seconds (callers clamp dt; a hidden tab never calls this, so nothing catches up) */
    tick(dt: number) {
      if (!s.playing) return
      if (s.intro < INTRO.dur) {
        const intro = Math.min(INTRO.dur, s.intro + dt)
        // the intro runs straight on into the first station's shot (the camera is already there when it ends)
        s = { ...s, intro, compose: introCompose(intro) }
        emit(); return
      }
      if (s.travel) {
        const t = s.travel.t + dt
        if (t >= s.travel.dur) { s = { ...s, area: s.travel.to, p: 0, travel: null } } else s = { ...s, travel: { ...s.travel, t } }
        emit(); return
      }
      const p = Math.min(1, s.p + dt / duration())
      s = { ...s, p }
      if (p >= RESULT_AT) retain(s.area)
      if (p >= 1) {
        if (s.tour && s.area < N - 1) flyTo(s.area + 1)
        else s = { ...s, playing: false, tour: false, reason: 'done' }
      }
      emit()
    },

    /** a visitor's own pick: the full sequence of that station, from its start, stopping on its result */
    select(i: number) {
      settleIntro()
      if (reduced) { retain(i); s = { ...s, area: i, p: 1, travel: null, tour: false, playing: false, reason: 'done' }; emit(); return }
      s = { ...s, tour: false, detail: true, playing: true, reason: '' }
      if (i === s.area && !s.travel) s = { ...s, p: 0 }
      else { s = { ...s, p: 0 }; flyTo(i) }
      emit()
    },
    /** go to the start of one of a station's four steps and hold there (inspecting) */
    step(n: number) {
      if (s.travel) return
      settleIntro()
      const p = Math.min(1, STEP_AT[n] + 0.002)
      s = { ...s, tour: false, detail: true, playing: false, reason: 'user', p }
      if (p >= RESULT_AT) retain(s.area)
      emit()
    },
    replay() {
      if (s.travel) return
      settleIntro()
      s = { ...s, p: 0, tour: false, detail: true, playing: !reduced, reason: reduced ? 'done' : '' }
      if (reduced) s = { ...s, p: 1 }
      emit()
    },
    /** the guided tour again, from the first station (retained results stay) */
    playAll() {
      settleIntro()
      if (reduced) return
      s = { ...s, tour: true, detail: false, playing: true, reason: '', p: 0 }
      if (s.area !== 0) flyTo(0)
      emit()
    },
    pause(reason: Pause = 'user') { if (!s.playing) return; s = { ...s, playing: false, reason }; emit() },
    /** only an explicit resume restarts: at the end of a sequence it plays it again */
    resume() {
      if (s.playing) return
      if (s.p >= 1 && !s.travel) s = { ...s, p: 0 }
      s = { ...s, playing: true, reason: '' }; emit()
    },
    /**
     * The cut has happened again (the file was opened another time): start from the interior's first
     * frame. The first visit tours; later openings return to the station last looked at and play it in
     * full. What was already retained stays.
     */
    restart(tour = true) {
      if (reduced) { s = { ...s, intro: INTRO.dur, compose: 1, travel: null, tour: false, playing: false, p: 1, reason: 'done' }; retain(s.area); emit(); return }
      s = { ...s, intro: 0, compose: 0, area: tour ? 0 : s.area, p: 0, travel: null, tour, detail: !tour, playing: true, reason: '' }; emit()
    },
  }
}
export type Clock = ReturnType<typeof createClock>
