// Critically damped spring, ported from RhineLabUI src/motion.ts `damp`
// (MIT, Copyright (c) 2026 LBEILC). Exact solution per step: no overshoot at any dt.

export interface Spring { value: number; velocity: number }

export const spring = (value = 0): Spring => ({ value, velocity: 0 })

export function damp(s: Spring, target: number, rate: number, dt: number) {
  const delta = s.value - target
  const impulse = s.velocity + rate * delta
  const decay = Math.exp(-rate * dt)
  s.value = target + (delta + impulse * dt) * decay
  s.velocity = (s.velocity - rate * impulse * dt) * decay
}

/** Frame-rate independent exponential approach. */
export const approach = (value: number, target: number, rate: number, dt: number) =>
  value + (target - value) * (1 - Math.exp(-rate * dt))

/** Rates from the reference; `reduced` makes every spring near-instant. */
export const RATES = {
  shoulder: 5,
  laneFocus: 4,
  track: 3.7,
  lift: 4.2,
  /** opening: the drive snaps out of its slot; closing: it lands without dawdling */
  eject: 7.5,
  land: 10.5,
  outgoing: 4.5,
  detail: 2.8,
  detailOpen: 4.2,
  camera: 5,
  hover: 14,
  pulseGain: 8,
} as const
export const REDUCED_FACTOR = 10

export const LIFT = { rest: 0.4, open: 4.6 } as const
