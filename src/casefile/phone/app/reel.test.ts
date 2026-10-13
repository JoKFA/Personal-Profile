import { describe, expect, it } from 'vitest'
import { sectionWant, THRESHOLD } from './reel'

describe('sectionWant: when the stage starts toward the next section', () => {
  it('is 35% of the next section', () => { expect(THRESHOLD).toBe(0.35) })
  it('scrolling down: stays until the next section is 35% in, then goes', () => {
    expect(sectionWant(1.0, 1, 6)).toBe(1)
    expect(sectionWant(1.34, 1, 6)).toBe(1)
    expect(sectionWant(1.36, 1, 6)).toBe(2)
    expect(sectionWant(1.9, 1, 6)).toBe(2)
  })
  it('scrolling back up: turns round when the previous section is 35% in (from the other side)', () => {
    expect(sectionWant(1.9, -1, 6)).toBe(2)
    expect(sectionWant(1.66, -1, 6)).toBe(2)
    expect(sectionWant(1.64, -1, 6)).toBe(1)
    expect(sectionWant(1.1, -1, 6)).toBe(1)
  })
  it('reverses after crossing: down to 1.4 wants 2, back up through 1.4 wants 1', () => {
    expect(sectionWant(1.4, 1, 6)).toBe(2)
    expect(sectionWant(1.4, -1, 6)).toBe(1)
  })
  it('at rest (no direction) the nearest section wins; clamped to the sections that exist', () => {
    expect(sectionWant(2.04, 0, 6)).toBe(2)
    expect(sectionWant(2.6, 0, 6)).toBe(3)
    expect(sectionWant(-0.3, -1, 6)).toBe(0)
    expect(sectionWant(5.8, 1, 6)).toBe(5)
    expect(sectionWant(9, 1, 6)).toBe(5)
  })
  it('a section boundary exactly: that section', () => {
    expect(sectionWant(3, 1, 6)).toBe(3)
    expect(sectionWant(3, -1, 6)).toBe(3)
  })
})
