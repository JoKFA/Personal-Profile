// Quality tiers (spec §8). Start high on desktop, medium on touch devices; step down once if the
// frame time stays high. `?quality=high|medium|low` forces a tier.
export interface Quality { name: 'high' | 'medium' | 'low'; dpr: number; shadows: number; ao: boolean; transmission: boolean }

export const TIERS: Record<Quality['name'], Quality> = {
  high: { name: 'high', dpr: 1.75, shadows: 2048, ao: true, transmission: true },
  medium: { name: 'medium', dpr: 1.5, shadows: 1024, ao: false, transmission: true },
  low: { name: 'low', dpr: 1, shadows: 0, ao: false, transmission: false },
}

export function initialQuality(search = location.search, coarse = matchMedia('(pointer: coarse)').matches): Quality {
  const forced = new URLSearchParams(search).get('quality') as Quality['name'] | null
  if (forced && TIERS[forced]) return TIERS[forced]
  return coarse ? TIERS.medium : TIERS.high
}

/** Watches frame times; asks for one step down after 2 s with p95 over 20 ms. */
export class FrameBudget {
  private times: number[] = []
  private since = 0
  sample(dtMs: number, now: number) {
    this.times.push(dtMs); if (this.times.length > 120) this.times.shift()
    if (!this.since) this.since = now
    if (now - this.since < 2000 || this.times.length < 60) return false
    const sorted = [...this.times].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    if (p95 > 20) { this.times = []; this.since = now; return true }
    return false
  }
}
export const lower = (q: Quality): Quality => (q.name === 'high' ? TIERS.medium : TIERS.low)
