import { describe, expect, it } from 'vitest'
import { DOOR, doorAt, doorDistance, doorSpan, FINAL_RATIO } from './door'

describe('the door', () => {
  it('starts untouched and ends with every part complete', () => {
    const a = doorAt(0), z = doorAt(DOOR.end)
    expect(a).toMatchObject({ stand: 0, dolly: 0, lens: 0, die: 0, done: false })
    expect(z).toMatchObject({ stand: 1, dolly: 1, lens: 1, die: 1, done: true })
  })
  it('only ever moves forward', () => {
    let prev = doorAt(0)
    for (let t = 0.05; t <= DOOR.end; t += 0.05) {
      const p = doorAt(t)
      for (const k of ['stand', 'dolly', 'lens', 'die'] as const) expect(p[k], `${k} at ${t}`).toBeGreaterThanOrEqual(prev[k] - 1e-12)
      prev = p
    }
  })
  it('the camera finishes at the final distance with the close lens, whatever it started with', () => {
    for (const d0 of [72, 140]) {
      const d = doorDistance(d0, 1)
      expect(d).toBeCloseTo(DOOR.finalDistance)
      expect(doorSpan(5.9, d0, d, 1) / d).toBeCloseTo(FINAL_RATIO)
    }
  })
  it('at the start the telephoto framing is unchanged', () => {
    expect(doorDistance(72, 0)).toBe(72)
    expect(doorSpan(5.9, 72, 72, 0)).toBeCloseTo(5.9)
  })
  it('the drive only ever grows on the screen (span across the frame never increases)', () => {
    let prev = Infinity
    for (let t = 0; t <= DOOR.end; t += 0.02) {
      const p = doorAt(t), d = doorDistance(72, p.dolly), span = doorSpan(6.5, 72, d, p.lens)
      expect(span, `at ${t}`).toBeLessThanOrEqual(prev + 1e-9)
      prev = span
    }
  })
  it('closes in at an even apparent speed (the distance is log-linear in the dolly)', () => {
    const half = doorDistance(72, 0.5)
    expect(half).toBeCloseTo(Math.sqrt(72 * DOOR.finalDistance), 6)
  })
})
