import { describe, expect, it } from 'vitest'
import { createClock, DETAIL_FACTOR, FLIGHT_SECONDS, TOUR_SECONDS } from './clock'
import { INTRO } from './shots'

/** run the clock for `seconds` in 1/30 s steps */
function run(c: ReturnType<typeof createClock>, seconds: number) { for (let t = 0; t < seconds; t += 1 / 30) c.tick(1 / 30) }

describe('the show clock', () => {
  it('runs the intro on into the first station (no flight of its own) and plays the tour through all six, in order', () => {
    const c = createClock()
    run(c, INTRO.dur / 2)
    expect(c.frame().into).toBe(0)
    expect(c.state.p).toBe(0)
    run(c, INTRO.dur / 2 + 0.2)
    expect(c.state.compose).toBe(1)
    expect(c.state.travel).toBeNull()
    expect(c.state.area).toBe(0)
    expect(c.state.p).toBeGreaterThan(0)
    run(c, 6 * TOUR_SECONDS + 5 * FLIGHT_SECONDS + 1)
    expect(c.state.order).toEqual([0, 1, 2, 3, 4, 5])
    expect(c.state.area).toBe(5)
    expect(c.state.playing).toBe(false)
    expect(c.state.reason).toBe('done')
    expect(c.state.p).toBe(1)
  })

  it('a pick stops the tour and plays that station at the slower pace, then holds its result', () => {
    const c = createClock()
    run(c, INTRO.dur + 1)
    c.select(3)
    expect(c.state.tour).toBe(false)
    run(c, FLIGHT_SECONDS + 0.1)
    expect(c.state.area).toBe(3)
    run(c, TOUR_SECONDS * DETAIL_FACTOR + 0.5)
    expect(c.state.area).toBe(3)
    expect(c.state.playing).toBe(false)
    expect(c.state.p).toBe(1)
    expect(c.state.retained[3]).toBe(true)
  })

  it('reading pauses everything and nothing catches up; only an explicit resume restarts', () => {
    const c = createClock()
    run(c, INTRO.dur + 1)
    const p = c.state.p
    c.pause('reading')
    run(c, 10)
    expect(c.state.p).toBe(p)
    expect(c.state.playing).toBe(false)
    c.resume()
    run(c, 0.5)
    expect(c.state.p).toBeGreaterThan(p)
  })

  it('resuming at the end of a sequence plays it again, and keeps what was already retained', () => {
    const c = createClock()
    c.select(0); run(c, FLIGHT_SECONDS * 2 + TOUR_SECONDS * DETAIL_FACTOR + 1)
    expect(c.state.retained[0]).toBe(true)
    c.resume()
    expect(c.state.p).toBe(0)
    expect(c.state.retained[0]).toBe(true)
    c.replay(); run(c, 1)
    expect(c.state.retained[0]).toBe(true)
    expect(c.state.order).toEqual([0])
  })

  it('a step control holds inspecting at the start of that step; the last one produces the result', () => {
    const c = createClock()
    c.select(1); run(c, FLIGHT_SECONDS + 1.0)
    c.step(2)
    expect(c.state.playing).toBe(false)
    expect(c.state.retained[1]).toBe(false)
    c.step(3)
    expect(c.state.retained[1]).toBe(true)
  })

  it('selecting during a flight redirects it; step controls cannot interrupt a flight', () => {
    const c = createClock()
    c.select(2)
    expect(c.state.travel?.to).toBe(2)
    c.step(1)
    expect(c.state.playing).toBe(true)
    c.select(4)
    expect(c.state.travel?.to).toBe(4)
  })

  it('reduced motion starts inside, composed, paused on the first result', () => {
    const c = createClock({ reduced: true })
    expect(c.state.intro).toBeGreaterThanOrEqual(INTRO.dur)
    expect(c.state.compose).toBe(1)
    expect(c.state.playing).toBe(false)
    expect(c.state.p).toBe(1)
    c.select(3)
    expect(c.state.area).toBe(3)
    expect(c.state.travel).toBeNull()
    expect(c.state.retained[3]).toBe(true)
  })

  it('evidence appears once per station, in the order it was produced', () => {
    const c = createClock(), seen: number[] = []
    c.onRetain((a) => seen.push(a))
    c.select(4); run(c, FLIGHT_SECONDS + TOUR_SECONDS * DETAIL_FACTOR + 1)
    c.select(1); run(c, FLIGHT_SECONDS + TOUR_SECONDS * DETAIL_FACTOR + 1)
    c.select(4); run(c, FLIGHT_SECONDS + TOUR_SECONDS * DETAIL_FACTOR + 1)
    expect(seen).toEqual([4, 1])
    expect(c.state.order).toEqual([4, 1])
  })
})
