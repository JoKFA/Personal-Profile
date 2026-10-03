// The interior's ground: the drive's circuit board at human scale. A faint grid floor that fades
// into warm haze, the etched face enlarged under the die (the patch the cut arrives on), the die
// itself as a monolith that is extruded out of the flat image, and the bus that runs out of it to
// the six stations. Light beads ride the bus.
import * as THREE from 'three'
import { etchMaterial, etchUniforms } from '../scene/drive'
import type { DriveModel } from '../scene/model'
import { DIE_ON_FACE } from '../scene/door'
import { array, bead, clamp01, COLOR, rbox, smooth, trunk, type Kit } from './kit'
import { AREAS, FACE_PX, HUB_SCALE, PX, STATION_AT } from './layout'

export interface World {
  group: THREE.Group
  /** the die: 0 = the flat image the cut arrives on, 1 = a standing monolith */
  extrude(k: number): void
  /** the enlarged face fades into the floor's own tone as the camera climbs away (0 = as on the drive) */
  settle(k: number): void
  /** the warm cast the drive's shell gave everything, as seen at the cut: 1 = as the exterior's last frame, 0 = the interior's own light */
  tint(k: number): void
  /** the cast the shell gave, as a colour to multiply by (lab: tuned against the exterior's last frame) */
  warm: THREE.Color
  /** the face's etch uniforms, synchronised with the exterior's at the cut */
  etch(glow: number, time: number): void
  tick(t: number): void
  dispose(): void
}

const mono = (c: number) => new THREE.Color(c)
const ONE = new THREE.Color(1, 1, 1)

function radialAlpha() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!, grd = g.createRadialGradient(128, 128, 20, 128, 128, 126)
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.55, '#fff'); grd.addColorStop(1, '#000')
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t
}

/** The grid: thin warm lines every 2 units, stronger every 10, anti-aliased by screen derivatives. */
function floorMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: COLOR.floor, roughness: 0.94, metalness: 0, envMapIntensity: 0.25 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLine = { value: mono(0x9a8e7a) }
    sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'varying vec3 vW; uniform vec3 uLine;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 a = vW.xz / 2.0, b = vW.xz / 10.0;
      vec2 da = abs(fract(a - 0.5) - 0.5) / max(fwidth(a), vec2(1e-4)), db = abs(fract(b - 0.5) - 0.5) / max(fwidth(b), vec2(1e-4));
      float minor = 1.0 - min(min(da.x, da.y), 1.0), major = 1.0 - min(min(db.x, db.y), 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, uLine, clamp(minor * 0.16 + major * 0.3, 0.0, 0.5));`)
  }
  m.customProgramCacheKey = () => 'space-floor'
  return m
}

/** the parts of the drive's own assembly that stand on its board: the secure element, its guard ring, the engraving, the fasteners */
const ASSEMBLY = ['Ceramic', 'Champagne', 'Engraving', 'Titanium'] as const

export function createWorld(kit: Kit, model: DriveModel): World {
  const group = new THREE.Group(); group.name = 'world'
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [kit.trace]

  // ── the floor ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 900), floorMaterial()); floor.rotation.x = -Math.PI / 2; floor.position.set(560, 0, 0); floor.receiveShadow = true; floor.name = 'floor'
  group.add(floor); geos.push(floor.geometry); mats.push(floor.material as THREE.Material)

  // ── the face, enlarged: the same texture, the same etch material as the drive's face ──
  const face = etchMaterial({ part: 'face' })
  face.transparent = true; face.alphaMap = radialAlpha(); face.depthWrite = false
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(FACE_PX.w * PX, FACE_PX.h * PX), face)
  decal.geometry.rotateX(-Math.PI / 2)
  decal.position.set(-(FACE_PX.dieCx - FACE_PX.w / 2) * PX, 0.02, (FACE_PX.h / 2 - FACE_PX.dieCy) * PX); decal.receiveShadow = true; decal.renderOrder = 1; decal.name = 'face-decal'
  group.add(decal); geos.push(decal.geometry); mats.push(face)
  const tan = mono(0xb9aa96), floorTone = mono(COLOR.floor)

  // ── the drive's own assembly, enlarged to the board's scale: the same parts the camera was looking at through the shell ──
  // Scaled uniformly it is the exterior's last frame seen from further off (similar triangles); its relief is then
  // stretched upwards, so the flat picture of the face becomes a standing structure (spec R2).
  const assembly = new THREE.Group(); assembly.name = 'assembly'; assembly.rotation.x = -Math.PI / 2; group.add(assembly)
  const parts: { m: THREE.MeshStandardMaterial; base: THREE.Color }[] = []
  for (const k of ASSEMBLY) {
    const g = model[k]; if (!g) continue
    const mat = g.material.clone()           // the drive's own materials are shared with its meshes: tint a copy
    parts.push({ m: mat, base: mat.color.clone() }); mats.push(mat)
    const m = new THREE.Mesh(g.geometry, mat); m.castShadow = true; m.receiveShadow = true; m.name = k; assembly.add(m)
  }
  let relief = 1
  const place = () => {
    assembly.scale.set(HUB_SCALE, HUB_SCALE, HUB_SCALE * relief)
    // keep the board plane (z = 0.11 in the drive's frame) on the floor and the die's centre at the origin
    assembly.position.set(-DIE_ON_FACE.x * HUB_SCALE, 0.03 - 0.11 * HUB_SCALE * relief, DIE_ON_FACE.y * HUB_SCALE)
  }
  place()

  // ── the bus: three parallel runs out of the die, branching to each station's plinth ──
  const runs: THREE.CurvePath<THREE.Vector3>[] = []
  const lane = (z: number, x0: number, x1: number) => trunk(group, [[x0, 0.07, z], [x1, 0.07, z]], 0.13, kit.champagne, 'bus')
  const endX = STATION_AT[STATION_AT.length - 1].x + 24
  for (const z of [-1.1, 0, 1.1]) runs.push(lane(z, 46, endX).curve as THREE.CurvePath<THREE.Vector3>)
  const vias: [number, number, number][] = []
  STATION_AT.forEach((s, i) => {
    const x0 = s.x - 26, x1 = s.x - 10.5
    for (const dz of [-1.1, 0, 1.1]) {
      const z0 = dz, z1 = s.z + dz, dz2 = z1 - z0, a = Math.abs(dz2)
      const pts: [number, number, number][] = [[x0, 0.07, z0], [x0 + 3, 0.07, z0], [x0 + 3 + a, 0.07, z1], [x1, 0.07, z1]]
      runs.push(trunk(group, pts, 0.1, kit.champagne, `branch-${AREAS[i]}`).curve as THREE.CurvePath<THREE.Vector3>)
      vias.push([x1 + 0.2, 0.08, z1])
    }
  })
  const viaGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20); geos.push(viaGeo)
  array(group, viaGeo, kit.champagne, vias, 'vias')
  // the bus's far end stops in a terminator
  rbox(group, [1.2, 0.12, 4.2], [endX + 0.6, 0.06, 0], kit.titanium, 0.05, 'bus-end')

  // ── light beads riding the bus (the drive's traces, alive) ──
  const beads: { m: THREE.Mesh; curve: THREE.CurvePath<THREE.Vector3>; speed: number; off: number }[] = []
  for (let i = 0; i < 9; i++) {
    const curve = runs[i % 3], b = bead(group, kit.trace, 0.2); b.visible = true
    beads.push({ m: b, curve, speed: 0.045 + (i % 4) * 0.012, off: i / 9 })
  }
  geos.push(...beads.map((b) => b.m.geometry))

  const w: World = {
    group,
    extrude(k) { relief = 1 + 2.4 * smooth(clamp01(k)); place() },
    warm: new THREE.Color(0.98, 0.82, 0.66),
    tint(k) { const w = clamp01(k); for (const p of parts) p.m.color.copy(p.base).multiply(this.warm.clone().lerp(ONE, 1 - w)) },
    settle(k) {
      const e = clamp01(k)
      face.color.copy(tan).lerp(floorTone, e * 0.82); face.opacity = 1 - 0.55 * e
    },
    etch(glow, time) { const u = etchUniforms(face); u.uGlow.value = glow; u.uTime.value = time },
    tick(t) {
      for (const b of beads) { const s = (t * b.speed + b.off) % 1; b.m.position.copy(b.curve.getPointAt(s)); b.m.position.y = 0.2 }
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) },
  }
  return w
}
