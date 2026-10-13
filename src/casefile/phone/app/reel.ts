// The reel's scroll logic, pure: from the scroll position (in sections, 0 = the cover) and the direction of travel, which stop the
// stage should be going to. A pan starts when the next section has come 35% into view; scrolling back past the same line (from the
// other side) turns it round, so there is no dead zone and no flicker at a single threshold.

/** how far into view the next section must be before the stage starts toward it */
export const THRESHOLD = 0.35

/**
 * @param p scroll position in sections
 * @param dir +1 scrolling down (toward later sections), -1 up, 0 unknown/idle (then the nearest section wins)
 * @param count number of sections
 */
export function sectionWant(p: number, dir: number, count: number): number {
  const clamp = (v: number) => Math.max(0, Math.min(count - 1, v))
  if (dir === 0) return clamp(Math.round(p))
  const base = Math.floor(p + 1e-6), f = p - base
  if (f < 1e-3) return clamp(base)
  return clamp(dir > 0 ? (f >= THRESHOLD ? base + 1 : base) : (f <= 1 - THRESHOLD ? base : base + 1))
}
