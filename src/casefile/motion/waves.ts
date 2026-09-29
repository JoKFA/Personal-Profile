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
}

/** The whole archive's height at (row, lane): one continuous surface. */
export function field(row: number, lane: number, s: FieldState) {
  let pulse = 0
  for (const p of s.pulses) pulse += selectionWave(pulseDistance(row - p.row, lane - p.lane), s.time - p.time)
  return (
    settlingWave(row - s.shoulder) * columnStrength(lane, s.laneFocus) +
    idleWave(row, lane, s.time) * s.idleGain +
    clamp(pulse, -PULSE_CLAMP, PULSE_CLAMP) * s.pulseGain
  )
}

/** Cards tilt with the local slope of the field. */
export const TILT = 0.024
export const slope = (row: number, lane: number, s: FieldState) => field(row + 0.5, lane, s) - field(row - 0.5, lane, s)
