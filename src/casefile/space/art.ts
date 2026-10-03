// The interior's drawing kit (2.5D). Each domain is drawn the way the drive's own face is: fine etched
// lines and small flat glyphs on an ivory plate, a few layers of frosted glass standing a little above
// it, champagne light running along the lines that matter, and colour only where something is allowed
// (olive) or stopped (red). Everything is vector geometry, so it stays sharp at any distance the
// camera comes to; nothing is a texture and nothing is a modelled object.
//
// Authoring is in a 2D frame: u to the right, v up the page (away from the viewer on a flat plate),
// z for the layer's height above its plane. A `flat` art lies on the plate; a `stand` art stands on it.
import * as THREE from 'three'

export type P2 = [number, number]
export const INK = 0x4a4e51, INK_SOFT = 0x8d9194, PAPER = 0xf6f2ea, PLATE = 0xe9e4da, CHAMPAGNE = 0xb89a6a, TRACE = 0xe6c98f, OLIVE = 0x8fa534, ALERT = 0xd9431c

interface Pulse { x: number; w: number }
export interface Stroke {
  mesh: THREE.Mesh
  /** total length in drawing units */
  length: number
  /** how much of it is drawn (0 → 1, from its start) */
  draw(k: number): void
  /** a light running along it: positions in 0 → 1, or null for none */
  pulse(a: Pulse | null, b?: Pulse | null): void
  /** the point `s` (0 → 1) along it, in the art's own frame */
  at(s: number, out?: THREE.Vector3): THREE.Vector3
  color(c: number): void
  opacity(o: number): void
}
export interface StrokeOpts { w?: number; color?: number; opacity?: number; closed?: boolean; z?: number; glow?: boolean; order?: number }
export interface FillOpts { color?: number; opacity?: number; z?: number; order?: number; lit?: boolean }

const HOT = new THREE.Color(TRACE).multiplyScalar(1.7)

/** a rounded rectangle as a closed polyline (counter-clockwise) */
export function rrect(cx: number, cy: number, w: number, h: number, r = 0.25, seg = 5): P2[] {
  const out: P2[] = [], rr = Math.min(r, w / 2, h / 2)
  const corner = (ox: number, oy: number, a0: number) => { for (let i = 0; i <= seg; i++) { const a = a0 + (Math.PI / 2) * (i / seg); out.push([ox + Math.cos(a) * rr, oy + Math.sin(a) * rr]) } }
  corner(cx + w / 2 - rr, cy + h / 2 - rr, 0); corner(cx - w / 2 + rr, cy + h / 2 - rr, Math.PI / 2)
  corner(cx - w / 2 + rr, cy - h / 2 + rr, Math.PI); corner(cx + w / 2 - rr, cy - h / 2 + rr, Math.PI * 1.5)
  return out
}
export function circle(cx: number, cy: number, r: number, seg = 40): P2[] { return Array.from({ length: seg }, (_, i) => { const a = (i / seg) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as P2 }) }
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, seg = 24): P2[] { return Array.from({ length: seg + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / seg); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as P2 }) }
/** a smooth curve through points, as a polyline */
export function smoothPath(pts: P2[], seg = 14): P2[] {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], 0)), false, 'catmullrom', 0.25)
  return c.getPoints(Math.max(8, (pts.length - 1) * seg)).map((v) => [v.x, v.y] as P2)
}

const strokeMaterial = (color: number, opacity: number, glow: boolean) => {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: !glow, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  const u = { uDraw: { value: 1 }, uPulse: { value: new THREE.Vector4(-9, 0.01, -9, 0.01) }, uHot: { value: HOT.clone() } }
  m.userData.u = u
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = 'attribute float aS; varying float vS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = aS;')
    sh.fragmentShader = 'varying float vS; uniform float uDraw; uniform vec4 uPulse; uniform vec3 uHot;\n' + sh.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
      float pr = clamp(exp(-pow((vS - uPulse.x) / uPulse.y, 2.0)) + exp(-pow((vS - uPulse.z) / uPulse.w, 2.0)), 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, uHot, pr);
      diffuseColor.a = mix(diffuseColor.a, 1.0, pr * 0.9) * (1.0 - smoothstep(uDraw - 0.004, uDraw + 0.004, vS));`)
  }
  m.customProgramCacheKey = () => (glow ? 'art-stroke-glow' : 'art-stroke')
  return m
}

/**
 * One 2D drawing: a group in the 2D frame, mounted flat on a plate or standing on it. Glyphs are
 * built as children (each its own `Art`) so they can be moved, scaled and turned as one.
 */
export class Art {
  readonly group = new THREE.Group()
  private all: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []
  private children: Art[] = []
  readonly mode: 'flat' | 'stand'
  private base = 1
  constructor(parent: THREE.Object3D, mode: 'flat' | 'stand', at: [number, number, number] = [0, 0, 0], yaw = 0, scale = 1) {
    this.mode = mode; this.base = scale
    if (mode === 'flat') { this.group.rotation.x = -Math.PI / 2; this.group.rotation.z = yaw } else this.group.rotation.y = yaw
    this.group.position.set(...at); this.group.scale.setScalar(scale); parent.add(this.group)
  }
  /** a child drawing in this one's frame, at (u, v) and height z, turned by `turn` (radians in the drawing's plane) */
  child(u: number, v: number, z = 0, scale = 1, turn = 0) {
    const c = new Art(this.group, 'stand', [u, v, z], 0, scale); c.group.rotation.set(0, 0, turn)
    this.children.push(c); return c
  }

  stroke(pts: P2[], o: StrokeOpts = {}): Stroke {
    const w = (o.w ?? 0.07) / this.base, z = o.z ?? 0, closed = o.closed ?? false
    const p = closed ? [...pts, pts[0]] : pts
    const n = p.length, pos = new Float32Array(n * 2 * 3), aS = new Float32Array(n * 2), idx: number[] = []
    const cum = [0]
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]))
    const length = cum[n - 1] || 1
    for (let i = 0; i < n; i++) {
      // the normal at a vertex is the average of its two segments' normals (a mitre, limited so sharp corners do not spike)
      const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(n - 1, i + 1)]
      let tx = c[0] - a[0], ty = c[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
      const s0x = b[0] - a[0], s0y = b[1] - a[1], s1x = c[0] - b[0], s1y = c[1] - b[1]
      const l0 = Math.hypot(s0x, s0y) || 1, l1 = Math.hypot(s1x, s1y) || 1
      let nx = -(s0y / l0 + s1y / l1) / 2, ny = (s0x / l0 + s1x / l1) / 2
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl
      const dot = Math.max(0.55, Math.abs(nx * -ty + ny * tx))   // mitre limit
      const k = (w / 2) / dot
      pos.set([b[0] + nx * k, b[1] + ny * k, z], i * 6); pos.set([b[0] - nx * k, b[1] - ny * k, z], i * 6 + 3)
      aS[i * 2] = aS[i * 2 + 1] = cum[i] / length
      if (i < n - 1) { const q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2) }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); geo.setIndex(idx)
    const mat = strokeMaterial(o.color ?? INK, o.opacity ?? 0.9, o.glow ?? false)
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = o.order ?? 2; mesh.frustumCulled = false; this.group.add(mesh); this.all.push({ geo, mat })
    const u = mat.userData.u as { uDraw: { value: number }; uPulse: { value: THREE.Vector4 } }
    return {
      mesh, length,
      draw: (k) => { u.uDraw.value = k; mesh.visible = k > 0.001 },
      pulse: (a, b) => { u.uPulse.value.set(a ? a.x : -9, a ? a.w : 0.01, b ? b.x : -9, b ? b.w : 0.01) },
      at: (s, out = new THREE.Vector3()) => {
        const t = Math.min(1, Math.max(0, s)) * length; let i = 1
        while (i < n - 1 && cum[i] < t) i++
        const f = (t - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1)
        return out.set(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f, z)
      },
      color: (c) => (mat as THREE.MeshBasicMaterial).color.set(c),
      opacity: (op) => { (mat as THREE.MeshBasicMaterial).opacity = op },
    }
  }

  fill(pts: P2[], o: FillOpts = {}) {
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])))
    const geo = new THREE.ShapeGeometry(shape)
    const mat = o.lit
      ? new THREE.MeshStandardMaterial({ color: o.color ?? PAPER, roughness: 0.6, metalness: 0, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: o.color ?? PAPER, transparent: true, opacity: o.opacity ?? 1, depthWrite: false, side: THREE.DoubleSide, toneMapped: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    const mesh = new THREE.Mesh(geo, mat); mesh.position.z = o.z ?? 0; mesh.renderOrder = o.order ?? 1; this.group.add(mesh); this.all.push({ geo, mat })
    return mesh
  }
  /** a small flat disc (a packet, a node, a via) */
  dot(u: number, v: number, r: number, color = TRACE, o: { z?: number; glow?: boolean; opacity?: number } = {}) {
    const geo = new THREE.CircleGeometry(r, 24)
    const mat = new THREE.MeshBasicMaterial({ color: o.glow ? new THREE.Color(color).multiplyScalar(1.6) : color, transparent: true, opacity: o.opacity ?? 1, depthWrite: false, toneMapped: !o.glow, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(u, v, o.z ?? 0.01); mesh.renderOrder = 4; this.group.add(mesh); this.all.push({ geo, mat })
    return mesh
  }
  /** hand over a geometry this drawing should dispose with itself */
  own(geo: THREE.BufferGeometry) { this.all.push({ geo, mat: new THREE.MeshBasicMaterial() }) }
  dispose() { for (const a of this.all) { a.geo.dispose(); a.mat.dispose() } for (const c of this.children) c.dispose() }
}

/** a frosted glass pane standing up: translucent, with a hairline edge; it never casts a hard shadow */
export function pane(art: Art, w: number, h: number, o: { x?: number; y?: number; z?: number; edge?: number; opacity?: number; r?: number } = {}) {
  const x = o.x ?? 0, y = o.y ?? 0, z = o.z ?? 0, ring = rrect(x, y + h / 2, w, h, o.r ?? 0.35)
  art.fill(ring, { color: 0xffffff, opacity: o.opacity ?? 0.34, z, order: 1 })
  const edge = art.stroke(ring, { w: 0.05, color: o.edge ?? INK_SOFT, opacity: 0.8, closed: true, z: z + 0.002 })
  return { edge, ring }
}
