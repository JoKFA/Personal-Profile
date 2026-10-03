import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { AREAS, fogFor, STATION_AT, STATION_RADIUS } from './layout'
import { flightPose, hubPose, introBlend, introPose, INTRO, stationPose } from './shots'

/** the region the subject is framed in: a desktop's left window at three window shapes, and a phone's window */
const REGIONS = [{ aspect: 1.33, rh: 0.66 }, { aspect: 1.6, rh: 0.66 }, { aspect: 1.78, rh: 0.66 }, { aspect: 0.8, rh: 0.66 }]
const PS = [0, 0.1, 0.26, 0.4, 0.55, 0.7, 0.86, 1]

describe('the interior camera', () => {
  it('in every settled shot, every other station is lost in the haze (spec R3)', () => {
    for (let i = 0; i < AREAS.length; i++) for (const r of REGIONS) for (const p of PS) {
      const pose = stationPose(i, p, r)
      AREAS.forEach((_, j) => {
        if (j === i) return
        const d = pose.pos.distanceTo(new THREE.Vector3(STATION_AT[j].x, 3, STATION_AT[j].z)) - STATION_RADIUS
        expect(d, `station ${i} p ${p} aspect ${r.aspect} sees station ${j}`).toBeGreaterThan(fogFor(pose.pos.distanceTo(pose.target)).far)
      })
    }
  })

  it('every station is framed on its own centre, close enough that it fills the region', () => {
    for (let i = 0; i < AREAS.length; i++) for (const r of REGIONS.filter((x) => x.aspect >= 1.3)) for (const p of PS) {
      const pose = stationPose(i, p, r), dist = pose.pos.distanceTo(pose.target)
      const c = new THREE.Vector3(STATION_AT[i].x, 0, STATION_AT[i].z)
      expect(Math.hypot(pose.target.x - c.x, pose.target.z - c.z)).toBeLessThan(STATION_RADIUS)
      expect(dist, `station ${i} p ${p}`).toBeLessThan(96)       // never pulled far back to fit
    }
  })

  it('the six stations are shot from genuinely different directions', () => {
    const dirs = AREAS.map((_, i) => { const p = stationPose(i, 0, REGIONS[0]); return p.pos.clone().sub(p.target).normalize().toArray().map((x) => x.toFixed(2)).join(',') })
    expect(new Set(dirs).size).toBe(AREAS.length)
  })

  it('shots move within a station (the camera is not parked)', () => {
    for (let i = 0; i < AREAS.length; i++) {
      const a = stationPose(i, 0, REGIONS[0]), b = stationPose(i, 0.6, REGIONS[0])
      expect(a.pos.distanceTo(b.pos) + a.target.distanceTo(b.target), `station ${i}`).toBeGreaterThan(1.5)
    }
  })

  it('the intro starts looking straight down at the die and ends at the hub shot', () => {
    const r = { aspect: 1.6, rh: 1 }, start = introPose(0, r, { fov: 24.5, height: 50 }), end = introPose(INTRO.dur, r, { fov: 24.5, height: 50 })
    expect(start.top).toBe(1)
    expect(start.pos.x).toBeCloseTo(0); expect(start.pos.y).toBeCloseTo(50)
    expect(start.target.length()).toBeCloseTo(0)
    expect(end.top).toBeCloseTo(0)
    expect(end.pos.distanceTo(hubPose(r).pos)).toBeLessThan(1e-6)
  })

  it('run on into a station, the intro is unchanged until the blend begins and ends on the first shot of that station', () => {
    const r = { aspect: 1.6, rh: 1 }, s = { fov: 24.5, height: 50 }
    for (const into of [0, 3, 5]) {
      const early = INTRO.blendFrom * 0.9
      expect(introPose(early, r, s, into).pos.distanceTo(introPose(early, r, s).pos)).toBeLessThan(1e-9)
      const end = introPose(INTRO.dur, r, s, into), first = stationPose(into, 0, r)
      expect(end.pos.distanceTo(first.pos)).toBeLessThan(1e-6)
      expect(end.target.distanceTo(first.target)).toBeLessThan(1e-6)
      expect(end.top).toBeCloseTo(0)
    }
    expect(introBlend(0)).toBe(0); expect(introBlend(INTRO.dur)).toBe(1)
  })

  it('the intro run on into a station never jumps and never stops before it arrives', () => {
    const r = { aspect: 1.6, rh: 1 }, s = { fov: 24.5, height: 50 }
    let prev = introPose(0, r, s, 4); const steps: number[] = []
    for (let t = 0.02; t <= INTRO.dur; t += 0.02) { const p = introPose(t, r, s, 4); steps.push(p.pos.distanceTo(prev.pos)); prev = p }
    // no frame moves more than a fifth of the whole way, and from the blend on the camera is always moving until the last few frames
    const whole = introPose(INTRO.dur, r, s, 4).pos.distanceTo(introPose(0, r, s, 4).pos)
    expect(Math.max(...steps)).toBeLessThan(whole / 5)
    const from = Math.floor(INTRO.blendFrom / 0.02) + 1, to = steps.length - 6
    for (let i = from; i < to; i++) expect(steps[i], `step ${i}`).toBeGreaterThan(0.05)
  })

  it('a flight starts on its first pose, ends on its last, and rises between', () => {
    const r = REGIONS[0], a = hubPose(r), b = stationPose(0, 0, r)
    expect(flightPose(a, b, 0).pos.distanceTo(a.pos)).toBeLessThan(1e-6)
    expect(flightPose(a, b, 1).pos.distanceTo(b.pos)).toBeLessThan(1e-6)
    const mid = flightPose(a, b, 0.5), line = a.pos.clone().lerp(b.pos, 0.5)
    expect(mid.pos.y).toBeGreaterThan(line.y + 3)
  })
})
