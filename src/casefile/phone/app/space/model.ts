// The interior's pure parts (P3c): what the baked per-frame data says at a (fractional) clip frame, what a chip shows and where it may sit,
// and which clips a tour, a pick and a way out are made of. No DOM, no three.js: the page layer reads these and draws them.
import { AREA_CONTENT, type Chip } from '../../../space/content'
import { RESULT_AT, STEP_AT, stepOf } from '../../../space/station'
import type { Pt, Rect, SpaceChip, SpaceManifest, SpaceStation } from '../../manifest'

export { RESULT_AT, STEP_AT, stepOf }
export const AREAS = AREA_CONTENT.length
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10) }
export const win = (p: number, a: number, b: number) => smooth((p - a) / Math.max(1e-6, b - a))

/** a per-frame table at a fractional frame position, linearly between the two frames around it (the page layer leads the picture by half a frame) */
export const at = (table: readonly number[], pos: number) => {
  const n = table.length - 1, i = clamp(Math.floor(pos), 0, n), j = Math.min(n, i + 1), f = clamp(pos - i, 0, 1)
  return table[i] + (table[j] - table[i]) * f
}
/** the station's own progress at a clip frame position */
export const pAt = (st: SpaceStation, pos: number) => at(st.p, pos)
/** where a chip's anchor is at a frame position, and whether it is in front of the camera */
export function anchorAt(c: SpaceChip, pos: number): { x: number; y: number; on: boolean } {
  const n = c.x.length - 1, i = clamp(Math.floor(pos), 0, n), j = Math.min(n, i + 1)
  return { x: at(c.x, pos), y: at(c.y, pos), on: !!(c.on[i] && c.on[j]) }
}
/** the chip's opacity at progress p (the desktop's own windows: in over 4% of p after `from`, out over 4% after `to`) */
export const chipOpacity = (c: Chip, p: number) => win(p, c.from, c.from + 0.04) * (c.to ? 1 - win(p, c.to, c.to + 0.04) : 1)

/** the station's chips that a phone shows, with the baked data that goes with each */
export const phoneChips = (st: SpaceStation) => st.chips.map((sc) => ({ sc, def: AREA_CONTENT[st.index].chips[sc.chip] }))

export interface Box { l: number; t: number; r: number; b: number }
const overlaps = (a: Box, b: Box, m = 4) => a.l < b.r + m && a.r > b.l - m && a.t < b.b + m && a.b > b.t - m
export type Side = 'up' | 'down' | 'left' | 'right'
/**
 * Where a chip's plate goes: on the side the content asks for, a leader's length away from its anchor, kept inside `region` and clear of the
 * plates already placed. Other sides and longer leaders are tried when it does not fit; the plate never leaves the region.
 */
export function placeChip(a: { x: number; y: number }, size: { w: number; h: number }, side: Side, region: Box, placed: Box[], gap = 22): { box: Box; side: Side; gap: number } {
  const { w, h } = size
  const boxFor = (sd: Side, g: number): Box => {
    let l: number, t: number
    if (sd === 'up') { l = a.x - w / 2; t = a.y - g - h }
    else if (sd === 'down') { l = a.x - w / 2; t = a.y + g }
    else if (sd === 'left') { l = a.x - g - w; t = a.y - h / 2 }
    else { l = a.x + g; t = a.y - h / 2 }
    l = clamp(l, region.l, Math.max(region.l, region.r - w)); t = clamp(t, region.t, Math.max(region.t, region.b - h))
    return { l, t, r: l + w, b: t + h }
  }
  const order: Side[] = [side, ...(['up', 'down', 'left', 'right'] as Side[]).filter((s) => s !== side)]
  let best: { box: Box; side: Side; gap: number } | null = null
  for (const sd of order) {
    for (let g = gap; g <= gap + 96; g += 16) {
      const box = boxFor(sd, g)
      // the leader must still go from the plate to the anchor: a plate that covers its own anchor is no use
      const covers = a.x > box.l - 4 && a.x < box.r + 4 && a.y > box.t - 4 && a.y < box.b + 4
      if (covers) continue
      if (!placed.some((o) => overlaps(box, o))) return { box, side: sd, gap: g }
      best ??= { box, side: sd, gap: g }
    }
  }
  return best ?? { box: boxFor(side, gap), side, gap }
}

/** the point of a plate box the leader ends on: the middle of the edge facing the anchor */
export function leaderEnd(box: Box, a: { x: number; y: number }): Pt {
  const cx = clamp(a.x, box.l + 6, box.r - 6), cy = clamp(a.y, box.t + 6, box.b - 6)
  const dx = a.x < box.l ? box.l - a.x : a.x > box.r ? a.x - box.r : 0, dy = a.y < box.t ? box.t - a.y : a.y > box.b ? a.y - box.b : 0
  return dx > dy ? { x: a.x < box.l ? box.l : box.r, y: cy } : { x: cx, y: a.y < box.t ? box.t : box.b }
}

/** keys the stage knows the interior's pictures by */
export const K = {
  door: 'sp:door', intro: 'sp:intro', exit: 'sp:exit', hub: 'sp:hub',
  st: (i: number) => `sp:st:${i}`, rest: (i: number) => `sp:rest:${i}`, fly: (i: number) => `sp:fly:${i}`,
  out: (i: number) => `sp:out:${i}`, in: (i: number) => `sp:in:${i}`,
}

export type SegKind = 'door' | 'intro' | 'station' | 'fly' | 'out' | 'in' | 'exit'
export interface Seg { kind: SegKind; key: string; i: number; clip: { frames: number; fps: number } }

/** the clips a visit plays after the door: the intro, then station i to the last with the flights between (the first visit's tour) */
export function tourSegs(S: SpaceManifest, from = 0, withIntro = true): Seg[] {
  const out: Seg[] = []
  if (withIntro) out.push({ kind: 'intro', key: K.intro, i: 0, clip: S.intro })
  for (let i = from; i < AREAS; i++) {
    out.push({ kind: 'station', key: K.st(i), i, clip: S.stations[i].clip })
    if (i < AREAS - 1) out.push({ kind: 'fly', key: K.fly(i), i, clip: S.fly[`${i}>${i + 1}`] })
  }
  return out
}
/** a pick: out of the station we are in (to the hub), into the picked one, and its own sequence */
export const pickSegs = (S: SpaceManifest, from: number | null, to: number): Seg[] => [
  ...(from === null ? [] : [{ kind: 'out' as const, key: K.out(from), i: from, clip: S.out[from] }]),
  { kind: 'in', key: K.in(to), i: to, clip: S.in[to] },
  { kind: 'station', key: K.st(to), i: to, clip: S.stations[to].clip },
]

/** the share of the screen the face still fills: the marks ride the face's corners while it is smaller than the screen, then fade */
export function marksOpacity(quad: Pt[], viewW: number, toScreen: (p: Pt) => Pt): number {
  const xs = quad.map((p) => toScreen(p).x), span = Math.max(...xs) - Math.min(...xs)
  return 1 - smooth((span - viewW * 0.85) / (viewW * 0.5))
}
/** a face's four corners at a fractional clip frame: linear between the two frames around it */
export const quadAt = (quads: Pt[][], pos: number): Pt[] => {
  const n = quads.length - 1, i = clamp(Math.floor(pos), 0, n), j = Math.min(n, i + 1), f = clamp(pos - i, 0, 1)
  return quads[i].map((p, k) => ({ x: p.x + (quads[j][k].x - p.x) * f, y: p.y + (quads[j][k].y - p.y) * f }))
}
/** the reticle's four corners: each takes the nearest free corner of the face and moves onto it by `lock` (0 = at rest, 1 = on the face) */
export function ridePoints(rest: Rect, quad: Pt[], lock: number): Pt[] {
  const c = [{ x: rest.x0, y: rest.y0 }, { x: rest.x1, y: rest.y0 }, { x: rest.x1, y: rest.y1 }, { x: rest.x0, y: rest.y1 }]
  if (!quad.length) return c
  const used = new Set<number>()
  return c.map((p) => {
    let best = 0, bd = Infinity
    quad.forEach((q, j) => { if (used.has(j)) return; const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; best = j } })
    used.add(best)
    return { x: p.x + (quad[best].x - p.x) * lock, y: p.y + (quad[best].y - p.y) * lock }
  })
}
export type { Rect }
