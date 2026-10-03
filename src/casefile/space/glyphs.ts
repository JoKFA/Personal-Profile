// The glyph set: small line pictograms, drawn at a tile's own scale (a tile is 3 units across, so an
// icon lives inside ±1.1). One weight, round-ish and quiet, like the etching on the drive's face.
// Each draws into a child `Art` and returns what the scene may want to move or colour.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { arc, Art, circle, INK, INK_SOFT, PAPER, rrect, CHAMPAGNE, ALERT, OLIVE, type P2, type Stroke } from './art'

const W = 0.075, WT = 0.05
type Ink = { color?: number }
const line = (a: Art, pts: P2[], o: { w?: number; color?: number; closed?: boolean; z?: number } = {}) => a.stroke(pts, { w: o.w ?? W, color: o.color ?? INK, closed: o.closed, z: o.z ?? 0.02, opacity: 0.92 })
const box = (a: Art, cx: number, cy: number, w: number, h: number, r = 0.12, o: { fill?: number; color?: number; w?: number } = {}) => {
  const p = rrect(cx, cy, w, h, r)
  if (o.fill !== undefined) a.fill(p, { color: o.fill, z: 0.015 })
  return line(a, p, { closed: true, color: o.color, w: o.w })
}

/** the tile every node sits on: a thin ceramic slab standing a little off its plate (real light on its edge, a real soft shadow), the icon etched on top */
export function tile(parent: Art, mat: THREE.Material, u: number, v: number, o: { size?: number; z?: number; accent?: number; thick?: number } = {}) {
  const s = o.size ?? 3, z = o.z ?? 0.06, t = o.thick ?? 0.16, a = parent.child(u, v, z)
  const slab = new THREE.Mesh(new RoundedBoxGeometry(s, s, t, 3, Math.min(0.14, t / 2 - 0.01)), mat)
  slab.position.z = t / 2; slab.castShadow = true; slab.receiveShadow = true; a.group.add(slab); a.own(slab.geometry)
  a.stroke(rrect(0, 0, s - 0.28, s - 0.28, 0.4), { w: WT, color: o.accent ?? INK_SOFT, opacity: 0.55, closed: true, z: t + 0.004 })
  return a
}

export const icons = {
  site(a: Art) { box(a, 0, -0.15, 1.5, 1.1, 0.06); line(a, [[-0.95, 0.4], [0, 1.05], [0.95, 0.4]]); box(a, 0, -0.35, 0.36, 0.6, 0.04); for (const x of [-0.5, 0.5]) box(a, x, -0.05, 0.3, 0.26, 0.03, { w: WT }) },
  router(a: Art) { a.stroke(circle(0, 0, 0.82), { w: W, color: INK, closed: true, z: 0.02 }); for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { line(a, [[dx * 0.2, dy * 0.2], [dx * 0.62, dy * 0.62]], { w: WT }); line(a, [[dx * 0.62 - dy * 0.14 - dx * 0.14, dy * 0.62 + dx * 0.14 - dy * 0.14], [dx * 0.62, dy * 0.62], [dx * 0.62 + dy * 0.14 - dx * 0.14, dy * 0.62 - dx * 0.14 - dy * 0.14]], { w: WT }) } },
  coreSwitch(a: Art) { box(a, 0, 0, 2.2, 0.95, 0.1); for (let i = 0; i < 6; i++) for (const y of [0.17, -0.17]) box(a, -0.78 + i * 0.31, y, 0.2, 0.2, 0.02, { w: 0.035 }); a.dot(0.98, 0.3, 0.05, CHAMPAGNE) },
  wall(a: Art) {
    // bricks: courses of staggered courses, with a gate in the middle
    box(a, 0, 0, 2.3, 1.7, 0.08)
    for (let r = 1; r < 4; r++) line(a, [[-1.15, -0.85 + r * 0.425], [1.15, -0.85 + r * 0.425]], { w: 0.04 })
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const x = -1.15 + (c + (r % 2 ? 0.5 : 0)) * 0.575; if (x > -1.1 && x < 1.1) line(a, [[x, -0.85 + r * 0.425], [x, -0.85 + (r + 1) * 0.425]], { w: 0.04 }) }
    box(a, 0, -0.45, 0.55, 0.8, 0.05, { fill: PAPER, color: CHAMPAGNE })
  },
  server(a: Art) { for (let i = 0; i < 3; i++) { box(a, 0, 0.62 - i * 0.62, 1.7, 0.5, 0.08); a.dot(0.62, 0.62 - i * 0.62, 0.045, OLIVE); line(a, [[-0.7, 0.62 - i * 0.62], [-0.15, 0.62 - i * 0.62]], { w: WT }) } },
  siem(a: Art) { box(a, 0, 0.12, 2.0, 1.4, 0.1); for (let i = 0; i < 4; i++) line(a, [[-0.8, 0.55 - i * 0.28], [-0.8 + [1.3, 0.9, 1.5, 1.1][i], 0.55 - i * 0.28]], { w: 0.05, color: INK_SOFT }); line(a, [[0, -0.58], [0, -0.85]]); line(a, [[-0.5, -0.85], [0.5, -0.85]]) },
  laptop(a: Art) { box(a, 0, 0.15, 1.6, 1.05, 0.08); box(a, 0, 0.15, 1.35, 0.8, 0.04, { w: 0.035 }); line(a, [[-1.0, -0.5], [1.0, -0.5], [0.85, -0.7], [-0.85, -0.7]], { closed: true }) },
  cloud(a: Art) { line(a, [...arc(-0.5, -0.1, 0.5, Math.PI * 0.55, Math.PI * 1.55, 12), ...arc(-0.1, 0.25, 0.62, Math.PI * 1.0, Math.PI * 0.1, 14), ...arc(0.6, -0.1, 0.5, Math.PI * 0.55, -Math.PI * 0.5, 12)], { closed: true }) },
  bucket(a: Art) { line(a, circle(0, 0.45, 0.8, 32), { closed: true }); line(a, [[-0.8, 0.45], [-0.8, -0.55], ...arc(0, -0.55, 0.8, Math.PI, Math.PI * 2, 16).slice(1)], { w: W }); line(a, [[0.8, -0.55], [0.8, 0.45]]); line(a, [...arc(0, -0.05, 0.8, Math.PI, Math.PI * 2, 16)], { w: 0.04 }) },
  database(a: Art) {
    const ell = (cy: number): P2[] => Array.from({ length: 30 }, (_, k) => { const t = (k / 30) * Math.PI * 2; return [Math.cos(t) * 0.78, cy + Math.sin(t) * 0.3] as P2 })
    for (let i = 0; i < 3; i++) line(a, ell(0.62 - i * 0.62), { closed: true, w: 0.06 })
    line(a, [[-0.78, 0.62], [-0.78, -0.62]], { w: 0.06 }); line(a, [[0.78, 0.62], [0.78, -0.62]], { w: 0.06 })
  },
  chip(a: Art) { box(a, 0, 0, 1.3, 1.3, 0.1); box(a, 0, 0, 0.6, 0.6, 0.05, { w: 0.05, color: CHAMPAGNE }); for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { line(a, [[-0.45 + i * 0.3, s * 0.65], [-0.45 + i * 0.3, s * 0.95]], { w: 0.05 }); line(a, [[s * 0.65, -0.45 + i * 0.3], [s * 0.95, -0.45 + i * 0.3]], { w: 0.05 }) } },
  badge(a: Art) { box(a, 0, 0, 1.4, 1.95, 0.14); line(a, circle(0, 0.5, 0.28, 20), { closed: true, w: 0.06 }); line(a, [[-0.45, -0.05], [0.45, -0.05]], { w: 0.05 }); line(a, [[-0.35, -0.3], [0.2, -0.3]], { w: 0.05 }); box(a, 0, -0.68, 0.46, 0.32, 0.05, { w: 0.05, color: CHAMPAGNE }); line(a, [[-0.18, 0.9], [0.18, 0.9]], { w: 0.09 }) },
  lock(a: Art, o: Ink = {}) { const c = o.color ?? INK; box(a, 0, -0.2, 1.0, 0.8, 0.08, { color: c, fill: PAPER }); line(a, arc(0, 0.2, 0.34, 0, Math.PI), { color: c }); line(a, [[-0.34, 0.2], [-0.34, 0.2]], { color: c }); a.dot(0, -0.2, 0.08, c) },
  agent(a: Art) { line(a, circle(0, 0, 0.55, 28), { closed: true }); a.dot(0, 0, 0.16, CHAMPAGNE, { glow: true }); const e: P2[] = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2; e.push([Math.cos(t) * 1.05, Math.sin(t) * 0.38]) } const rot = (p: P2): P2 => [p[0] * Math.cos(0.5) - p[1] * Math.sin(0.5), p[0] * Math.sin(0.5) + p[1] * Math.cos(0.5)]; line(a, e.map(rot), { closed: true, w: 0.05, color: INK_SOFT }) },
  tool(a: Art) { box(a, 0, 0.1, 1.2, 1.55, 0.12); box(a, 0, 0.3, 0.9, 0.8, 0.05, { w: 0.04 }); for (const [y, w] of [[0.5, 0.6], [0.3, 0.7], [0.1, 0.5]] as const) line(a, [[-0.35, y], [-0.35 + w, y]], { w: 0.04, color: INK_SOFT }); for (const x of [-0.3, 0, 0.3]) box(a, x, -0.8, 0.12, 0.28, 0.02, { w: 0.04 }) },
  cage(a: Art, o: Ink = {}) { const c = o.color ?? INK; for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) line(a, [[sx * 1.05, sy * 0.55], [sx * 1.05, sy * 1.05], [sx * 0.55, sy * 1.05]].map(([x, y]) => [x, y] as P2), { color: c }) },
  event(a: Art) { box(a, 0, 0, 0.9, 1.3, 0.1); line(a, [[-0.3, 0.35], [0.3, 0.35]], { w: 0.1, color: ALERT }); for (const y of [0.0, -0.25, -0.5]) line(a, [[-0.3, y], [0.28, y]], { w: 0.04, color: INK_SOFT }) },
  note(a: Art) { box(a, 0, 0, 1.5, 1.7, 0.1); line(a, [[-0.5, 0.5], [0.1, 0.5]], { w: 0.09, color: CHAMPAGNE }); for (const [y, w] of [[0.2, 1.0], [-0.05, 1.0], [-0.3, 0.85], [-0.55, 0.9]] as const) line(a, [[-0.5, y], [-0.5 + w, y]], { w: 0.045, color: INK_SOFT }) },
  analyst(a: Art) { box(a, 0, -0.3, 1.8, 0.7, 0.1); line(a, circle(-0.45, -0.3, 0.2, 18), { closed: true }); line(a, circle(0.1, -0.3, 0.2, 18), { closed: true, color: INK_SOFT }); a.dot(0.65, -0.3, 0.1, CHAMPAGNE, { glow: true }); line(a, circle(0, 0.62, 0.3, 20), { closed: true }); line(a, [[-0.55, 0.0], [-0.4, 0.3], [0.4, 0.3], [0.55, 0.0]], { w: 0.06 }) },
  envelope(a: Art) { box(a, 0, 0, 1.9, 1.3, 0.1); line(a, [[-0.95, 0.65], [0, -0.05], [0.95, 0.65]]); line(a, [[-0.95, -0.65], [-0.2, -0.05]], { w: 0.05, color: INK_SOFT }); line(a, [[0.95, -0.65], [0.2, -0.05]], { w: 0.05, color: INK_SOFT }) },
  hook(a: Art) { line(a, [[0, 1.4], [0, 0.2], ...arc(0.4, 0.2, 0.4, Math.PI, Math.PI * 2.25, 14)], { w: W }) },
  lens(a: Art) { line(a, circle(0, 0.2, 0.62, 30), { closed: true, w: 0.09, color: CHAMPAGNE }); line(a, [[0.44, -0.24], [0.95, -0.82]], { w: 0.13 }) },
  tray(a: Art) { line(a, [[-1.0, 0.25], [-0.82, -0.55], [0.82, -0.55], [1.0, 0.25]], { w: W }); line(a, [[-0.82, -0.55], [-0.82, -0.8], [0.82, -0.8], [0.82, -0.55]], { w: 0.05 }); line(a, [[-1.0, 0.25], [1.0, 0.25]], { w: 0.05 }) },
  stamp(a: Art) { box(a, 0, 0.55, 0.7, 0.9, 0.2); box(a, 0, -0.2, 1.4, 0.4, 0.06); line(a, [[-0.7, -0.62], [0.7, -0.62]], { w: 0.1, color: ALERT }) },
  crate(a: Art) { // an isometric box
    const p = (x: number, y: number): P2 => [x, y]
    line(a, [p(0, 0.95), p(0.95, 0.45), p(0.95, -0.55), p(0, -1.0), p(-0.95, -0.55), p(-0.95, 0.45)], { closed: true })
    line(a, [p(0, 0.95), p(0, -0.05), p(0.95, 0.45)], { w: WT }); line(a, [p(0, -0.05), p(-0.95, 0.45)], { w: WT }); line(a, [p(0, -0.05), p(0, -1.0)], { w: WT }) },
  virus(a: Art, o: Ink = {}) { const c = o.color ?? ALERT; line(a, circle(0, 0, 0.36, 22), { closed: true, color: c, w: 0.08 }); for (let i = 0; i < 10; i++) { const t = (i / 10) * Math.PI * 2; line(a, [[Math.cos(t) * 0.42, Math.sin(t) * 0.42], [Math.cos(t) * 0.7, Math.sin(t) * 0.7]], { color: c, w: 0.07 }); a.dot(Math.cos(t) * 0.74, Math.sin(t) * 0.74, 0.07, c) } },
  checklist(a: Art) { for (let i = 0; i < 3; i++) { const y = 0.6 - i * 0.6; box(a, -0.65, y, 0.34, 0.34, 0.05, { w: 0.05 }); line(a, [[-0.3, y], [0.75, y]], { w: 0.05, color: INK_SOFT }) } },
  barrier(a: Art) { box(a, -0.8, -0.3, 0.4, 0.9, 0.05); line(a, [[-0.6, 0.0], [1.0, 0.0]], { w: 0.14 }); for (let i = 0; i < 3; i++) line(a, [[-0.2 + i * 0.4, 0.07], [0.0 + i * 0.4, -0.07]], { w: 0.06, color: ALERT }) },
  building(a: Art) { box(a, 0, 0, 1.5, 1.9, 0.06); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) box(a, -0.3 + c * 0.6, 0.55 - r * 0.45, 0.32, 0.26, 0.03, { w: 0.04 }); box(a, 0, -0.75, 0.46, 0.4, 0.04); line(a, [[-0.85, 0.95], [0.85, 0.95]], { w: 0.09 }) },
  gate(a: Art) { line(a, [[-1.0, -0.9], [-1.0, 0.9], [1.0, 0.9], [1.0, -0.9]]); line(a, [[-0.7, -0.9], [-0.7, 0.5], [0.7, 0.5], [0.7, -0.9]], { w: 0.05, color: INK_SOFT }) },
} as const
export type IconName = keyof typeof icons
export type { Stroke }
