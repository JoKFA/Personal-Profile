// UEBA on the visitor, shown only to the visitor. Nothing leaves the browser.
// Behaviour in, alerts out; the UI decides how to present them.

export interface Alert { what: string; action: string; add: number; throttle?: number }

export const UEBA = {
  burst: { count: 7, window: 1.4, add: 20, throttle: 1.5 },
  enumerate: { count: 3, window: 25, add: 26 },
  sweep: { count: 22, window: 1.6, add: 16 },
  deny: 6, capture: 48, cooldown: 5, decay: 1.4, floor: 4,
} as const

export class Ueba {
  risk: number = UEBA.floor
  throttledUntil = -1
  private keys: number[] = []
  private denials: number[] = []
  private seen = new Map<string, number>()
  private cool = 0

  private raise(now: number, a: Alert): Alert | null {
    if (now < this.cool) return null
    this.cool = now + UEBA.cooldown
    this.risk = Math.min(100, this.risk + a.add)
    if (a.throttle) this.throttledUntil = now + a.throttle
    return a
  }
  select(now: number) {
    this.keys = [...this.keys.filter((t) => now - t < UEBA.burst.window), now]
    if (this.keys.length < UEBA.burst.count) return null
    return this.raise(now, { what: `burst · ${this.keys.length} record requests in ${UEBA.burst.window} s`, action: `navigation throttled ${UEBA.burst.throttle} s`, add: UEBA.burst.add, throttle: UEBA.burst.throttle })
  }
  deny(now: number) {
    this.risk = Math.min(100, this.risk + UEBA.deny)
    this.denials = [...this.denials.filter((t) => now - t < UEBA.enumerate.window), now]
    if (this.denials.length < UEBA.enumerate.count) return null
    return this.raise(now, { what: `T1083 enumeration · ${this.denials.length} sealed drives probed`, action: 'flagged to SOC', add: UEBA.enumerate.add })
  }
  hover(key: string, now: number) {
    this.seen.set(key, now)
    for (const [k, t] of this.seen) if (now - t > UEBA.sweep.window) this.seen.delete(k)
    if (this.seen.size < UEBA.sweep.count) return null
    const n = this.seen.size; this.seen.clear()
    return this.raise(now, { what: `T1083 discovery · ${n} drives touched in ${UEBA.sweep.window} s`, action: 'rate-limited', add: UEBA.sweep.add })
  }
  captured() { this.risk = Math.min(100, this.risk + UEBA.capture) }
  tick(dt: number) { this.risk = Math.max(UEBA.floor, this.risk - dt * UEBA.decay) }
  get level() { const r = Math.round(this.risk); return r > 60 ? 'high' : r > 25 ? 'elevated' : 'baseline' }
}
