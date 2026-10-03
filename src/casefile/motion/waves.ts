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
 * The entrance, after the Rhine Lab PV (27.6–31.8 s, frame by frame; spec §26.3): one continuous
 * shot, no cuts. The camera arrives fast down the selected file's drawer and slows to a stop on it;
 * the drives ripple in slanted crests that run the same way, the main swell riding with the camera;
 * as it slows, the ripples die away and the last swell piles up in the file's own drawer as a long
 * ramp whose top is the file. Rows and lanes are relative to the file; `age` is seconds since the
 * archive appeared. One easing curve drives both the camera and the swell, so they stay together.
 */
export const ENTRANCE = { travel: 3.4, reach: 26, morph: 1.6, settle: 3.2, settleFor: 1.0 } as const
export const ENTRANCE_END = ENTRANCE.settle + ENTRANCE.settleFor
const easeOut = (t: number) => 1 - (1 - t) ** 3
/** How far behind the file the camera (and the main swell) is, in rows: fast at first, then slowing to 0. */
export const crestRow = (age: number) => -ENTRANCE.reach * (1 - easeOut(clamp(age / ENTRANCE.travel)))
/**
 * How far the search has turned into the archive's resting shape (0 → 1). The swell does not pile
 * up and then fall: as it slows onto the file it becomes, continuously, the resting field itself
 * (the shoulders round the selected file), so the entrance ends exactly where the archive rests.
 */
export const entryMorph = (age: number) => (age <= 0 ? 1 : smooth((age - (ENTRANCE.travel - ENTRANCE.morph)) / ENTRANCE.morph))
/** the crests run at a slant across the drawers, the way the PV's do */
const SLANT = 1.3
/** The travelling part of the entrance: ripples and the main swell, handing over to the resting field. */
export function searchWave(row: number, lane: number, age: number) {
  if (age <= 0 || age >= ENTRANCE.travel) return 0
  const on = smooth(age / 0.35)
  const morph = entryMorph(age)
  // The slanted front straightens into the subject's drawer as the camera comes to rest.
  const along = row + lane * SLANT * (1 - morph), front = along - crestRow(age)
  // A single readable crest with a quieter trailing wake, rather than a full-screen sine field.
  const wake = 0.3 * Math.sin(front * 0.86) * bell(front + 6, 6) * Math.exp(-age * 0.55)
  const swell = 1.85 * bell(front, 3.4)
  return on * (wake + swell) * (1 - morph)
}

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
    // the resting shape grows out of the search as it arrives (entryMorph), never after it
    settlingWave(row - s.shoulder) * columnStrength(lane, s.laneFocus) * entryMorph(s.entry ?? 0) +
    idleWave(row, lane, s.time) * s.idleGain +
    clamp(pulse, -PULSE_CLAMP, PULSE_CLAMP) * s.pulseGain +
    searchWave(row - s.shoulder, lane - s.laneFocus, s.entry ?? 0)
  )
}

/** Cards tilt with the local slope of the field. */
export const TILT = 0.024
export const slope = (row: number, lane: number, s: FieldState) => field(row + 0.5, lane, s) - field(row - 0.5, lane, s)
