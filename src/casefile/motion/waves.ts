// Motion model ported from RhineLabUI src/motion.ts
// (MIT, Copyright (c) 2026 LBEILC, github.com/LBEILC/RhineLabUI). Parameters unchanged.
// Every function is pure: rows and lanes in, height out.

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

/** Quintic smootherstep on [0, 1]. Rhine's `smooth` and its camera `ease` are the same curve. */
export const smooth = (t: number) => {
  t = clamp(t)
  return t * t * t * (10 + t * (-15 + 6 * t))
}

export const bell = (x: number, width: number) => Math.exp(-0.5 * (x / width) ** 2)

/** Two moving shoulders around the selected row, settled at the reference frame time 26.56. */
export function settlingWave(distance: number, time = 26.56) {
  const age = time - 25.05 - Math.abs(distance) * 0.065
  const envelope = Math.max(-0.42, 2.15 - 0.17 * (Math.sqrt(distance * distance + 1) - 1))
  const rise = smooth(age / 0.62)
  const ring = age > 0 ? Math.sin(age * 5.1) * Math.exp(-age * 1.3) : 0
  return envelope * (rise + 0.18 * ring * smooth(age / 0.16))
}

/** The ripple a selection sends outward. Crest speed: 8 rows per second. Lives 3.2 s. */
export const PULSE_LIFE = 3.2
export const PULSE_SPEED = 8
export function selectionWave(distance: number, age: number) {
  if (age < 0 || age > PULSE_LIFE) return 0
  const front = distance - age * PULSE_SPEED
  return 0.8 * smooth(age / 0.2) * Math.exp(-age * 1.15) * Math.cos(front * 0.58) * bell(front, 3.4)
}

/** The selected lane rises fully; neighbours carry a quarter of the wave. */
export const columnStrength = (lane: number, focus: number) => 0.25 + 0.75 * bell(lane - focus, 0.55)

/** Quiet idle drift, neighbours slightly out of phase. Peak displacement 0.102 (< 3% of a card). */
export const idleWave = (row: number, lane: number, t: number) =>
  0.075 * Math.sin((t * Math.PI * 2) / 8 + row * 0.3 - lane * 0.45) +
  0.027 * Math.sin((t * Math.PI * 2) / 13 - row * 0.17 + lane * 0.3)

/**
 * The entrance (spec §29), after the Rhine Lab PV 26.9–31.6 s, watched at 25 fps. The wave and the
 * camera follow RhineLabUI's frame-by-frame reconstruction of that shot (src/motion.ts `archiveWave`,
 * `cinematicField`; src/scene.ts, the cinematic camera; MIT, Copyright (c) 2026 LBEILC). The archive
 * slides into a white field seen side-on, the drives standing as slats; the camera whips up and turns
 * while one tall crest sweeps the rows with its front slanted across the drawers; a faster crest runs
 * back; as it reaches the file the swell hands over to the archive's resting shape, a long ramp whose
 * top is the file, and the camera pulls back into the archive's telephoto view. Rows and lanes are
 * relative to the file; `age` is seconds since the archive appeared.
 */
export const ENTRANCE = {
  /** the archive slides in from the left, decelerating */
  slide: 0.75, slideFrom: -23,
  /** the swell hands over to the resting shape */
  handover: 2.95, handoverFor: 0.45,
  /** the other drawers quieten to a quarter */
  focus: 3.4, focusFor: 0.95,
  /** the camera has the file: its number types in */
  found: 3.3,
  /** the camera settles into the archive's own view */
  settle: 2.33, settleFor: 2.25,
} as const
export const ENTRANCE_END = ENTRANCE.settle + ENTRANCE.settleFor
/** reference time of the PV reconstruction at age 0 (its wave starts at 22, its slide at 21.92) */
const SHOT0 = 22
/** z offset of the whole archive while it slides in */
export const entranceSlide = (age: number) => ENTRANCE.slideFrom * (1 - clamp((age + 0.08) / ENTRANCE.slide)) ** 2
/** one crest with a trough behind it: neighbours describe one surface, not staggered tweens */
const packet = (d: number) => 2.3 * bell(d, 3.8) - 0.53 * bell(d - 6, 3.5)
/** the slant of the crest's front across the drawers, in rows per lane */
const SLANT = 0.65
/** The travelling part: the first crest out, the faster one back. */
export function entranceWave(row: number, lane: number, age: number) {
  if (age <= 0 || age >= ENTRANCE.handover + ENTRANCE.handoverFor) return 0
  const phase = row + lane * SLANT
  const first = -9 + age * 19, back = 20 - (age - 2.3) * 24
  return smooth(age / 0.32) * (
    packet(phase - first) * (1 - smooth((age - 2.15) / 0.65)) +
    packet(phase - back) * smooth((age - 2.17) / 0.32) * (1 - smooth((age - 3.5) / 0.85))
  ) * (1 - smooth((age - ENTRANCE.handover) / ENTRANCE.handoverFor))
}
/** How far the drawers have quietened to the file's (0 → 1). */
export const entryFocus = (age: number) => (age <= 0 ? 1 : smooth((age - ENTRANCE.focus) / ENTRANCE.focusFor))
/**
 * The resting shape grows out from the file as the swell hands over: the shoulders rise from the
 * file outward, a row a little later than the one before. Only rising (spec §26.8): the swell never
 * piles up above the resting shape and falls back to it.
 */
export const grown = (row: number, age: number) => (age <= 0 ? 1 : smooth((SHOT0 + age - 25.05 - Math.abs(row) * 0.065) / 0.62))

/** The entrance's camera, in degrees and world units; at the end it is the archive's own view. */
export function entranceCamera(age: number) {
  const shot = SHOT0 - 0.08 + Math.max(0, age)
  const orbit = smooth((shot - 22.6) / 1.6), settle = smooth((age - ENTRANCE.settle) / ENTRANCE.settleFor)
  return {
    yaw: 89 - 22 * orbit - 8 * settle,
    elevation: 3 + 40 * smooth((shot - 21.96) / 0.22) - 8 * orbit - 16 * settle,
    /** vertical extent of the view at the aim, as a multiple of the archive's own */
    span: lerp(lerp(10.8, 10.3, orbit) / 7.33, 1, settle),
    distance: lerp(28 + 7 * orbit, 140, settle),
    /** the aim's offset from the archive's own aim */
    aimY: lerp(-2.55 + 0.4 * orbit, -0.045, settle) + 0.045,
    aimZ: lerp(2.48, 0.481, settle) - 0.481,
    settle,
  }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Lane distance counts 2.2× a row: lanes are further apart than rows. */
export const pulseDistance = (dRow: number, dLane: number) => Math.hypot(dRow, dLane * 2.2)

export interface Pulse { row: number; lane: number; time: number }
export const PULSE_CLAMP = 0.6

export interface FieldState {
  shoulder: number
  laneFocus: number
  idleGain: number
  pulseGain: number
  pulses: readonly Pulse[]
  time: number
  /** seconds since the archive appeared (the entrance's search wave); 0 when not entering */
  entry?: number
}

/** The whole archive's height at (row, lane): one continuous surface. */
export function field(row: number, lane: number, s: FieldState) {
  let pulse = 0
  for (const p of s.pulses) pulse += selectionWave(pulseDistance(row - p.row, lane - p.lane), s.time - p.time)
  return (
    // the resting shape grows out from the file as the swell hands over to it, never after it
    settlingWave(row - s.shoulder) * grown(row - s.shoulder, s.entry ?? 0) * (1 + (columnStrength(lane, s.laneFocus) - 1) * entryFocus(s.entry ?? 0)) +
    idleWave(row, lane, s.time) * s.idleGain +
    clamp(pulse, -PULSE_CLAMP, PULSE_CLAMP) * s.pulseGain +
    entranceWave(row - s.shoulder, lane - s.laneFocus, s.entry ?? 0)
  )
}

/** Cards tilt with the local slope of the field. */
export const TILT = 0.024
export const slope = (row: number, lane: number, s: FieldState) => field(row + 0.5, lane, s) - field(row - 0.5, lane, s)
