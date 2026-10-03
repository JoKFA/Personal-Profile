// Materials and small builders shared by every station. One set of materials means one light: the
// ivory ceramic, frosted neutral glass, titanium, graphite and champagne of the site, and nothing
// else. Olive and red appear only as state (allowed, threat).
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const COLOR = {
  bg: 0xe7e4dd, haze: 0xe8e4dc, floor: 0xd6d1c8,
  ivory: 0xf0eadf, ceramic: 0xf5f0e6, titanium: 0xc9c6bf, graphite: 0x3b4044, ink: 0x23262a,
  champagne: 0xb89a6a, trace: 0xe6c98f, olive: 0x9bb03a, alert: 0xd9431c,
} as const

export interface Kit {
  ivory: THREE.MeshPhysicalMaterial; ceramic: THREE.MeshPhysicalMaterial; frost: THREE.MeshPhysicalMaterial; glass: THREE.MeshPhysicalMaterial
  titanium: THREE.MeshStandardMaterial; graphite: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; champagne: THREE.MeshStandardMaterial
  trace: THREE.MeshBasicMaterial; alert: THREE.MeshBasicMaterial; alertSolid: THREE.MeshStandardMaterial; olive: THREE.MeshBasicMaterial
  /** thin translucent light layers (scans, access ranges): normal blending, so they stay visible on ivory */
  sheet: (color: number, opacity: number) => THREE.MeshBasicMaterial
  all: THREE.Material[]
}

export function createKit(transmission: boolean): Kit {
  const all: THREE.Material[] = []
  const keep = <T extends THREE.Material>(m: T) => { all.push(m); return m }
  const ivory = keep(new THREE.MeshPhysicalMaterial({ color: COLOR.ivory, roughness: 0.42, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.4, sheen: 0.15, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.7 }))
  const ceramic = keep(new THREE.MeshPhysicalMaterial({ color: COLOR.ceramic, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.8 }))
  // frosted neutral glass: no yellow tint (the site's drive shell is warm; the interior's glass is neutral)
  const frost = keep(new THREE.MeshPhysicalMaterial({ color: 0xf4f2ee, roughness: 0.34, transmission: transmission ? 0.7 : 0, thickness: 0.35, ior: 1.4, attenuationColor: new THREE.Color(0xdedad2), attenuationDistance: 1.4, clearcoat: 0.3, clearcoatRoughness: 0.3, transparent: !transmission, opacity: transmission ? 1 : 0.55, envMapIntensity: 0.7 }))
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.06, transmission: transmission ? 0.92 : 0, thickness: 0.2, ior: 1.45, transparent: !transmission, opacity: transmission ? 1 : 0.28, envMapIntensity: 1 }))
  const titanium = keep(new THREE.MeshStandardMaterial({ color: COLOR.titanium, roughness: 0.34, metalness: 0.7, envMapIntensity: 1 }))
  const graphite = keep(new THREE.MeshStandardMaterial({ color: COLOR.graphite, roughness: 0.5, metalness: 0.25, envMapIntensity: 0.6 }))
  const dark = keep(new THREE.MeshStandardMaterial({ color: COLOR.ink, roughness: 0.7, metalness: 0.1 }))
  const champagne = keep(new THREE.MeshStandardMaterial({ color: COLOR.champagne, roughness: 0.32, metalness: 0.62, envMapIntensity: 1 }))
  const trace = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOR.trace).multiplyScalar(1.5), toneMapped: false }))
  const alert = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOR.alert).multiplyScalar(1.25), toneMapped: false }))
  const alertSolid = keep(new THREE.MeshStandardMaterial({ color: COLOR.alert, roughness: 0.45, metalness: 0.1, emissive: COLOR.alert, emissiveIntensity: 0.35 }))
  const olive = keep(new THREE.MeshBasicMaterial({ color: COLOR.olive, toneMapped: false }))
  const sheet = (color: number, opacity: number) => keep(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
  return { ivory, ceramic, frost, glass, titanium, graphite, dark, champagne, trace, alert, alertSolid, olive, sheet, all }
}

type V3 = [number, number, number]
const shadowed = <T extends THREE.Mesh>(m: T, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m }

/** A bevelled box: the basic unit of every device (edge thickness reads as a real, moulded part). */
export function rbox(parent: THREE.Object3D, size: V3, pos: V3, mat: THREE.Material, r = 0.06, name = 'part') {
  const rr = Math.min(r, Math.min(...size) / 2 - 1e-3)
  const m = shadowed(new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 3, rr), mat))
  m.position.set(...pos); m.name = name; parent.add(m); return m
}
export function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3 = [0, 0, 0], cast = true, name = 'part') {
  const m = shadowed(new THREE.Mesh(geo, mat), cast); m.position.set(...pos); m.name = name; parent.add(m); return m
}

/** A polyline made of straight runs with chamfered corners: the face's circuit-board look (orthogonal buses, 45° doglegs). */
export function trunk(parent: THREE.Object3D, pts: V3[], r: number, mat: THREE.Material, name = 'trace') {
  const path = new THREE.CurvePath<THREE.Vector3>(), v = pts.map((p) => new THREE.Vector3(...p))
  for (let i = 0; i < v.length - 1; i++) path.add(new THREE.LineCurve3(v[i], v[i + 1]))
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, v.length * 20, r, 6, false), mat); m.name = name; m.castShadow = false; parent.add(m)
  return { mesh: m, curve: path }
}

/** An array of identical small parts (ports, vents, bays): one draw call. */
export function array(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, at: V3[], name = 'array', cast = false) {
  const im = new THREE.InstancedMesh(geo, mat, at.length), d = new THREE.Object3D()
  at.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); im.setMatrixAt(i, d.matrix) })
  im.castShadow = cast; im.receiveShadow = true; im.name = name; parent.add(im); return im
}

/** A moving light: a small hot bead (a packet, a pulse) that rides a curve. */
export function bead(parent: THREE.Object3D, mat: THREE.Material, r = 0.16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.castShadow = false; m.visible = false; parent.add(m); return m
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (x: number) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10) }
/** ease a window of progress: 0 before a, 1 after b, smooth between */
export const win = (p: number, a: number, b: number) => smooth((p - a) / Math.max(1e-6, b - a))
export const mix = (a: number, b: number, k: number) => a + (b - a) * k
