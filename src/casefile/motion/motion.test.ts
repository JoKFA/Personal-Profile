import { describe, expect, it } from 'vitest'
import { columnStrength, ENTRANCE, ENTRANCE_END, SKIP_ENTRANCE, entranceCamera, entranceSlide, field, idleWave, PULSE_LIFE, selectionWave, settlingWave, smooth, type FieldState } from './waves'
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

describe('entrance: the swell becomes the resting archive', () => {
  // the archive at the selected file (row 0, lane 0) and around it, with nothing else moving
  const at = (row: number, lane: number, entry: number) => field(row, lane, { shoulder: 0, laneFocus: 0, idleGain: 0, pulseGain: 0, pulses: [], time: 0, entry })
  const rest = (row: number, lane: number) => at(row, lane, 0)
  it('ends exactly in the resting shape', () => {
    for (const [r, l] of [[0, 0], [3, 0], [-3, 0], [8, 0], [0, 1], [5, 2]]) expect(at(r, l, ENTRANCE_END + 0.01)).toBeCloseTo(rest(r, l), 6)
  })
  it('once it hands over, never piles up above the resting shape and then drops back to it', () => {
    for (let r = -10; r <= 10; r++) {
      for (let a = ENTRANCE.handover + ENTRANCE.handoverFor; a <= ENTRANCE_END + 3; a += 1 / 60) {
        expect(at(r, 0, a), `row ${r} at ${a.toFixed(2)} s`).toBeLessThanOrEqual(Math.max(rest(r, 0), 0) + 0.15)
      }
    }
  })
  it('moves smoothly frame to frame (the crest is fast, as in the PV, but never jumps)', () => {
    for (let r = -10; r <= 10; r += 2) {
      for (let a = 0.02; a < ENTRANCE_END; a += 1 / 60) expect(Math.abs(at(r, 0, a + 1 / 60) - at(r, 0, a)), `row ${r} at ${a.toFixed(2)} s`).toBeLessThan(0.25)
    }
  })
  it('sweeps the rows once out and once back before it settles', () => {
    // the first crest passes the file early, the returning one just before the hand-over
    const peakAt = (from: number, to: number) => { let best = -Infinity, when = from; for (let a = from; a < to; a += 0.01) { const v = at(0, 0, a); if (v > best) { best = v; when = a } } return when }
    expect(peakAt(0.2, 1.2)).toBeGreaterThan(0.3)
    expect(peakAt(0.2, 1.2)).toBeLessThan(0.7)
    expect(peakAt(2.6, 3.4)).toBeGreaterThan(2.9)
  })
  it('slides the archive in, decelerating, and holds it in place after', () => {
    expect(entranceSlide(0)).toBeLessThan(-15)
    expect(Math.abs(entranceSlide(ENTRANCE.slide))).toBeLessThan(0.1)
    expect(Math.abs(entranceSlide(2))).toBe(0)
    const v = (a: number) => entranceSlide(a + 0.01) - entranceSlide(a)
    expect(v(0.1)).toBeGreaterThan(v(0.5))
  })
  it('a skipped entry plays only the last stretch: the archive is already in place and the camera still has to settle', () => {
    const from = ENTRANCE_END - SKIP_ENTRANCE
    expect(SKIP_ENTRANCE).toBeGreaterThan(0)
    expect(from).toBeGreaterThan(ENTRANCE.slide)
    expect(Math.abs(entranceSlide(from))).toBe(0)
    expect(entranceCamera(from).settle).toBeLessThan(1)
    expect(entranceCamera(from).settle).toBeGreaterThan(0)
  })
  it("ends the camera on the archive's own view", () => {
    const c = entranceCamera(ENTRANCE_END)
    expect(c.yaw).toBeCloseTo(59, 6); expect(c.elevation).toBeCloseTo(19, 6)
    expect(c.span).toBeCloseTo(1, 6); expect(c.distance).toBeCloseTo(140, 6)
    expect(c.aimY).toBeCloseTo(0, 6); expect(c.aimZ).toBeCloseTo(0, 6)
    // and starts low and side-on, close in
    const s = entranceCamera(0)
    expect(s.elevation).toBeLessThan(6); expect(s.yaw).toBeGreaterThan(85); expect(s.distance).toBeLessThan(30)
  })
})
