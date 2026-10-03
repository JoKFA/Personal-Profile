// Building blocks for the drawn stations: a node (an icon on a floating tile), an edge (a hairline
// with light that can run along it), and a packet. They all pop in and draw on as a function of progress.
import * as THREE from 'three'
import { Art, CHAMPAGNE, INK_SOFT, type P2, type Stroke } from '../art'
import { icons, tile, type IconName } from '../glyphs'
import { clamp01, smooth, type Kit } from '../kit'

export const FLOOR_Y = 0.58
/** a station-local position for a point (u, v) of a flat drawing at height z above the plate */
export const at = (u: number, v: number, z = 0): [number, number, number] => [u, FLOOR_Y + z, -v]

export interface Node { art: Art; u: number; v: number; z: number; icon: Art; pop(k: number): void }
export function node(parent: Art, kit: Kit, u: number, v: number, icon: IconName, o: { size?: number; z?: number; accent?: number } = {}): Node {
  const z = o.z ?? 0.06, size = o.size ?? 3.4, t = tile(parent, kit.ceramic, u, v, { size, z, accent: o.accent }), ic = t.child(0, 0, 0.17, size / 3)
  icons[icon](ic)
  return {
    art: t, u, v, z, icon: ic,
    pop(k) { const e = smooth(clamp01(k)); t.group.visible = k > 0.001; t.group.scale.setScalar(0.7 + 0.3 * e); t.group.position.z = z + (1 - e) * 1.1 },
  }
}

export function edge(parent: Art, pts: P2[], o: { color?: number; w?: number; glow?: boolean; opacity?: number; z?: number } = {}): Stroke {
  return parent.stroke(pts, { w: o.w ?? 0.07, color: o.color ?? INK_SOFT, opacity: o.opacity ?? 0.85, glow: o.glow, z: o.z ?? 0.03 })
}
/** a travelling light: a small bright disc that rides a stroke */
export function packet(parent: Art, color = CHAMPAGNE, r = 0.17) {
  const d = parent.dot(0, 0, r, color, { glow: true, z: 0.12 }); d.visible = false
  return { mesh: d, ride(s: Stroke, k: number, on = true) { d.visible = on; if (on) { s.at(k, d.position); d.position.z = 0.12 } } }
}
/** the position of s (0 → 1) along a path of points, without a stroke */
export function along(pts: P2[], s: number): P2 {
  const seg: number[] = [0]
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const t = clamp01(s) * seg[seg.length - 1]; let i = 1
  while (i < pts.length - 1 && seg[i] < t) i++
  const f = (t - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1)
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]
}
export { THREE }

/**
 * Faint etched traces round a plate's edge, in the drive face's own manner (orthogonal runs, 45° doglegs,
 * a via at each end), so the plate reads as a piece of the board and its margins are not empty.
 */
export function etch(A: Art, w: number, d: number, seed: number) {
  let s = seed * 7919 + 13
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  const hw = w / 2 - 0.85, hd = d / 2 - 0.85
  for (let i = 0; i < 12; i++) {
    const side = Math.floor(r() * 4), t = (r() * 2 - 1) * 0.9, depth = 0.5 + r() * 1.3, run = 1.4 + r() * 3.4, dir = r() < 0.5 ? -1 : 1
    const pts: P2[] = []
    if (side < 2) { const x = t * hw, y0 = side ? hd : -hd, sy = side ? -1 : 1; pts.push([x, y0], [x, y0 + sy * depth], [x + dir * 0.5, y0 + sy * (depth + 0.5)], [x + dir * (0.5 + run), y0 + sy * (depth + 0.5)]) }
    else { const y = t * hd, x0 = side === 3 ? hw : -hw, sx = side === 3 ? -1 : 1; pts.push([x0, y], [x0 + sx * depth, y], [x0 + sx * (depth + 0.5), y + dir * 0.5], [x0 + sx * (depth + 0.5), y + dir * (0.5 + run)]) }
    A.stroke(pts, { w: 0.035, color: CHAMPAGNE, opacity: 0.42, z: 0.012 })
    const e = pts[pts.length - 1]; A.dot(e[0], e[1], 0.11, CHAMPAGNE, { opacity: 0.5, z: 0.012 })
  }
}
