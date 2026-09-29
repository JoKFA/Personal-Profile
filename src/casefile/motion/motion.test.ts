import { describe, expect, it } from 'vitest'
import { columnStrength, field, idleWave, PULSE_LIFE, selectionWave, settlingWave, smooth, type FieldState } from './waves'
import { damp, spring } from './spring'
import { nearest, nearestCell, wrap } from './grid'

const base: FieldState = { shoulder: 12, laneFocus: 2, idleGain: 0, pulseGain: 1, pulses: [], time: 10 }

describe('smooth', () => {
  it('clamps and hits its end points with zero slope', () => {
    expect(smooth(-1)).toBe(0)
    expect(smooth(2)).toBe(1)
    expect(smooth(0.5)).toBeCloseTo(0.5)
    expect(smooth(0.01)).toBeLessThan(0.001)
  })
})

describe('settlingWave', () => {
  it('peaks at the selected row and falls off with distance', () => {
    const at = settlingWave(0), near = settlingWave(3), far = settlingWave(20)
    expect(at).toBeGreaterThan(2)
    expect(near).toBeLessThan(at)
    expect(far).toBeLessThan(near)
    expect(far).toBeGreaterThanOrEqual(-0.42 * 1.2)
  })
  it('is symmetric about the selection', () => {
    expect(settlingWave(-4)).toBeCloseTo(settlingWave(4))
  })
})

describe('selectionWave', () => {
  it('is silent before it starts and after it dies', () => {
    expect(selectionWave(0, -0.01)).toBe(0)
    expect(selectionWave(5, PULSE_LIFE + 0.01)).toBe(0)
  })
  it('travels outward at 8 rows per second', () => {
    const crest = (age: number) => {
      let best = 0, at = 0
      for (let d = 0; d < 30; d += 0.05) { const v = selectionWave(d, age); if (v > best) { best = v; at = d } }
      return at
    }
    expect(crest(1.5) - crest(0.5)).toBeCloseTo(8, 0)
  })
  it('decays over its life', () => {
    expect(Math.abs(selectionWave(16, 2))).toBeLessThan(selectionWave(4, 0.5))
  })
})

describe('field', () => {
  it('clamps the sum of many pulses to ±0.6', () => {
    const pulses = Array.from({ length: 6 }, () => ({ row: 12, lane: 2, time: 9.6 }))
    const loud = field(12, 2, { ...base, pulses }) - field(12, 2, base)
    expect(Math.abs(loud)).toBeLessThanOrEqual(0.6 + 1e-9)
  })
  it('pulse gain 0 removes the ripple (file open)', () => {
    const pulses = [{ row: 12, lane: 2, time: 9.8 }]
    expect(field(13, 2, { ...base, pulses, pulseGain: 0 })).toBeCloseTo(field(13, 2, base))
  })
  it('idle breathing stays under 3% of a card', () => {
    let max = 0
    for (let t = 0; t < 30; t += 0.1) max = Math.max(max, Math.abs(idleWave(3, 1, t)))
    expect(max).toBeLessThan(0.103)
    expect(max).toBeGreaterThan(0.05)
  })
  it('the selected lane rises most', () => {
    expect(columnStrength(2, 2)).toBe(1)
    expect(columnStrength(4, 2)).toBeCloseTo(0.25, 1)
  })
})

describe('damp', () => {
  it('converges without overshoot', () => {
    const s = spring(0)
    let peak = 0
    for (let i = 0; i < 120; i++) { damp(s, 1, 5, 1 / 60); peak = Math.max(peak, s.value) }
    expect(s.value).toBeGreaterThan(0.999)
    expect(peak).toBeLessThanOrEqual(1 + 1e-9)
  })
  it('is frame-rate independent', () => {
    const a = spring(0), b = spring(0)
    for (let i = 0; i < 60; i++) damp(a, 1, 4, 1 / 60)
    for (let i = 0; i < 30; i++) damp(b, 1, 4, 1 / 30)
    expect(a.value).toBeCloseTo(b.value, 3)
  })
})

describe('grid', () => {
  it('wraps negatives and picks the nearest copy', () => {
    expect(wrap(-1, 9)).toBe(8)
    expect(nearest(0, 30, 32)).toBe(32)
    expect(nearestCell({ lane: 5, row: 12 }, { lane: 0, row: 12 })).toEqual({ lane: -1, row: 12 })
  })
})
