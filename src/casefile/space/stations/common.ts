// Parts every station uses: the plinth it stands on and the evidence plate that lands on it.
import * as THREE from 'three'
import { array, clamp01, COLOR, rbox, smooth, type Kit } from '../kit'

type V3 = [number, number, number]

let pool: THREE.CanvasTexture | null = null
function poolTexture() {
  if (pool) return pool
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!, grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  grd.addColorStop(0, 'rgba(255,252,246,.85)'); grd.addColorStop(0.5, 'rgba(255,252,246,.42)'); grd.addColorStop(1, 'rgba(255,252,246,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256)
  pool = new THREE.CanvasTexture(c); pool.colorSpace = THREE.SRGBColorSpace; return pool
}
/** a soft pool of light on the floor: the station is lit, the floor around it is not */
export function lightPool(group: THREE.Group, radius: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, toneMapped: false, fog: true }))
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 0; m.name = 'light-pool'; group.add(m); return m
}

/** a champagne inlay line on a part's face (the drive's index inlay, carried onto the devices) */
export function inlay(parent: THREE.Object3D, kit: Kit, size: V3, pos: V3) { return rbox(parent, size, pos, kit.champagne, Math.min(...size) / 2.5, 'inlay') }
/** titanium fasteners, as on the drive's end caps: flat heads set into a face; axis = the face normal */
export function screws(parent: THREE.Object3D, kit: Kit, at: V3[], axis: 'x' | 'y' | 'z' = 'z', r = 0.06) {
  const geo = new THREE.CylinderGeometry(r, r, 0.04, 14)
  if (axis === 'z') geo.rotateX(Math.PI / 2); else if (axis === 'x') geo.rotateZ(Math.PI / 2)
  return array(parent, geo, kit.titanium, at, 'screws')
}

/** The station's floor: an ivory slab with a recessed ceramic panel and a champagne edge line. */
export function plinth(group: THREE.Group, kit: Kit, w: number, d: number) {
  lightPool(group, Math.max(w, d) * 1.25)
  rbox(group, [w, 0.5, d], [0, 0.25, 0], kit.ivory, 0.18, 'plinth')
  rbox(group, [w - 1.4, 0.05, d - 1.4], [0, 0.52, 0], kit.ceramic, 0.04, 'panel')
  const e = 0.07, y = 0.56
  for (const z of [-1, 1]) rbox(group, [w - 1.0, 0.03, e], [0, y, z * (d / 2 - 0.5)], kit.champagne, 0.012, 'edge')
  for (const x of [-1, 1]) rbox(group, [e, 0.03, d - 1.0], [x * (w / 2 - 0.5), y, 0], kit.champagne, 0.012, 'edge')
}

/**
 * The evidence plate (spec R11): a thin ivory tablet with a champagne index inlay. It waits above
 * its rest, comes down when the result is produced, and stays. Its identity is its station.
 */
export function evidencePlate(group: THREE.Group, kit: Kit, rest: V3, yaw = 0) {
  const g = new THREE.Group(); g.name = 'evidence-plate'; g.position.set(...rest); g.rotation.y = yaw; group.add(g)
  rbox(g, [2.7, 0.16, 1.8], [0, 0.08, 0], kit.ivory, 0.08, 'plate-body')
  rbox(g, [2.3, 0.02, 1.4], [0, 0.17, 0], kit.ceramic, 0.03, 'plate-face')
  rbox(g, [0.14, 0.03, 1.1], [1.0, 0.19, 0], kit.champagne, 0.012, 'plate-inlay')
  const bars = array(g, new THREE.BoxGeometry(1.1, 0.02, 0.07), kit.titanium, [[-0.35, 0.185, -0.4], [-0.35, 0.185, -0.15], [-0.35, 0.185, 0.1], [-0.35, 0.185, 0.35]], 'plate-lines')
  void bars
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.32, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOR.trace).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring)
  const rise = 3.4
  return {
    object: g,
    /** k = 0 waiting above (hidden), 1 landed */
    land(k: number) {
      const e = smooth(clamp01(k))
      g.visible = k > 0.001
      g.position.y = rest[1] + (1 - e) * rise
      g.rotation.z = (1 - e) * 0.18
      const pulse = k > 0.55 ? Math.max(0, 1 - (k - 0.55) / 0.4) : 0
      const m = ring.material as THREE.MeshBasicMaterial; m.opacity = 0.9 * pulse; ring.scale.setScalar(0.7 + 0.8 * (1 - pulse))
      ring.position.y = 0.05 - (1 - e) * rise
    },
  }
}

/** a small thin rectangle outline on the plinth (zone boundaries, scan floors) */
export function outline(group: THREE.Group, mat: THREE.Material, w: number, d: number, at: V3, t = 0.07) {
  const g = new THREE.Group(); g.position.set(...at); group.add(g)
  for (const z of [-1, 1]) rbox(g, [w, 0.03, t], [0, 0, z * d / 2], mat, 0.012, 'outline')
  for (const x of [-1, 1]) rbox(g, [t, 0.03, d], [x * w / 2, 0, 0], mat, 0.012, 'outline')
  return g
}
