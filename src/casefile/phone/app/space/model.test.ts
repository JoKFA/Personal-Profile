import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AREA_CONTENT } from '../../../space/content'
import type { SpaceManifest } from '../../manifest'
import { AREAS, K, anchorAt, at, chipOpacity, leaderEnd, marksOpacity, pAt, phoneChips, pickSegs, placeChip, quadAt, ridePoints, tourSegs, type Box } from './model'

// the real baked data (the newest space-<hash>.json in public/phone): the tests read what the runtime reads
const dir = join(__dirname, '../../../../../public/phone')
const file = readdirSync(dir).filter((f) => /^space-[0-9a-f]+\.json$/.test(f)).sort()[0]
const S = JSON.parse(readFileSync(join(dir, file), 'utf8')) as SpaceManifest

describe('the baked interior (what the runtime reads)', () => {
  it('has six stations whose chips are exactly the content\'s phone chips', () => {
    expect(S.stations.length).toBe(AREAS)
    S.stations.forEach((st, i) => {
      const phone = AREA_CONTENT[i].chips.map((c, n) => (c.phone ? n : -1)).filter((n) => n >= 0)
      expect(st.chips.map((c) => c.chip), `station ${i}`).toEqual(phone)
      for (const c of st.chips) { expect(c.x.length).toBe(st.clip.frames); expect(c.y.length).toBe(st.clip.frames); expect(c.on.length).toBe(st.clip.frames) }
      expect(st.p.length).toBe(st.clip.frames)
      expect(st.resultFrame).toBeGreaterThan(0); expect(st.resultFrame).toBeLessThan(st.clip.frames)
      expect(st.stepFrames.length).toBe(4)
    })
  })
  it('has a way out and a way in for every station and a flight between neighbours', () => {
    for (let i = 0; i < AREAS; i++) { expect(S.out[i]).toBeTruthy(); expect(S.in[i]).toBeTruthy() }
    for (let i = 0; i < AREAS - 1; i++) expect(S.fly[`${i}>${i + 1}`]).toBeTruthy()
  })
  it('has finite anchors for every frame (an anchor may leave the picture; its plate is kept inside the region)', () => {
    for (const st of S.stations) for (const c of st.chips) for (let f = 0; f < c.x.length; f++) { expect(Number.isFinite(c.x[f]) && Number.isFinite(c.y[f])).toBe(true) }
  })
})

describe('frames in between', () => {
  it('interpolates a table linearly and clamps at both ends', () => {
    expect(at([0, 10, 20], 0.5)).toBe(5); expect(at([0, 10, 20], 1.25)).toBe(12.5); expect(at([0, 10, 20], 9)).toBe(20); expect(at([0, 10, 20], -3)).toBe(0)
  })
  it('puts a chip anchor between the two frames around the position, and on only when both frames have it on', () => {
    const c = { chip: 0, at: 'a', x: [0, 10, 20], y: [0, 0, 0], on: [true, true, false] }
    expect(anchorAt(c, 0.5)).toEqual({ x: 5, y: 0, on: true })
    expect(anchorAt(c, 1.5).on).toBe(false)
  })
  it('reads the station\'s progress from its per-frame table', () => {
    const st = S.stations[0]
    expect(pAt(st, 0)).toBe(0); expect(pAt(st, st.clip.frames - 1)).toBeGreaterThan(0.98)
    expect(pAt(st, st.resultFrame)).toBeGreaterThanOrEqual(0.86)
  })
  it('moves the face corners between frames and rides the reticle onto them', () => {
    const q = [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }]]
    expect(quadAt(q, 0.5)[0]).toEqual({ x: 5, y: 0 })
    const rest = { x0: -1, y0: -1, x1: 11, y1: 11 }
    expect(ridePoints(rest, [], 1)[0]).toEqual({ x: -1, y: -1 })
    const on = ridePoints(rest, q[0], 1)
    expect(on.map((p) => `${p.x},${p.y}`).sort()).toEqual(['0,0', '0,10', '10,0', '10,10'])
    expect(ridePoints(rest, q[0], 0)[0]).toEqual({ x: -1, y: -1 })
  })
  it('fades the marks as the face outgrows the screen', () => {
    const id = (p: { x: number; y: number }) => p
    const small = [{ x: 100, y: 0 }, { x: 250, y: 0 }, { x: 250, y: 300 }, { x: 100, y: 300 }]
    const huge = [{ x: -500, y: 0 }, { x: 540, y: 0 }, { x: 540, y: 600 }, { x: -500, y: 600 }]
    expect(marksOpacity(small, 390, id)).toBe(1); expect(marksOpacity(huge, 390, id)).toBe(0)
  })
})

describe('chips', () => {
  it('has opacity windows from the desktop content', () => {
    const c = AREA_CONTENT[0].chips[0]
    expect(chipOpacity(c, 0)).toBe(0); expect(chipOpacity(c, 0.5)).toBe(1)
    const t = AREA_CONTENT[2].chips[1]   // has a `to`
    expect(chipOpacity(t, 0.5)).toBe(1); expect(chipOpacity(t, 0.9)).toBe(0)
  })
  it('only the chips marked phone are drawn', () => {
    for (const st of S.stations) expect(phoneChips(st).every(({ def }) => def.phone === true)).toBe(true)
  })
  const region: Box = { l: 8, t: 70, r: 382, b: 430 }
  const inside = (b: Box) => b.l >= region.l && b.t >= region.t && b.r <= region.r && b.b <= region.b
  it('keeps a plate inside the region wherever its anchor is, and clear of the plates already there', () => {
    const placed: Box[] = []
    for (const a of [{ x: 10, y: 80 }, { x: 380, y: 425 }, { x: 190, y: 250 }, { x: 200, y: 260 }, { x: 60, y: 420 }, { x: 330, y: 90 }]) {
      const r = placeChip(a, { w: 200, h: 46 }, 'up', region, placed)
      expect(inside(r.box), JSON.stringify(a)).toBe(true)
      expect(r.box.l < a.x && a.x < r.box.r && r.box.t < a.y && a.y < r.box.b, 'the plate does not sit on its own anchor').toBe(false)
      placed.push(r.box)
    }
  })
  it('ends the leader on the edge of the plate that faces the anchor', () => {
    const box: Box = { l: 100, t: 100, r: 200, b: 140 }
    expect(leaderEnd(box, { x: 150, y: 300 })).toEqual({ x: 150, y: 140 })
    expect(leaderEnd(box, { x: 20, y: 120 })).toEqual({ x: 100, y: 120 })
  })
})

describe('what plays when', () => {
  it('a tour is the intro, then every station with a flight between each two', () => {
    const t = tourSegs(S)
    expect(t.map((s) => s.kind).join(',')).toBe('intro,' + Array.from({ length: AREAS }, (_, i) => (i < AREAS - 1 ? 'station,fly' : 'station')).join(','))
    expect(t.every((s) => s.clip.frames > 0)).toBe(true)
  })
  it('a pick is out of the station we are in, in to the picked one, and its sequence; from the hub there is no out', () => {
    expect(pickSegs(S, 1, 4).map((s) => s.key)).toEqual([K.out(1), K.in(4), K.st(4)])
    expect(pickSegs(S, null, 4).map((s) => s.key)).toEqual([K.in(4), K.st(4)])
  })
})
