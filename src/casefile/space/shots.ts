// The interior's camera (spec R4). Pure functions: every pose is a function of where we are in the
// show, so they can be tested without a GPU. Three kinds of move, kept apart:
//   · the intro, which arrives from the cut (top-down on the flat die, then up and out over the hub)
//   · a station's shots, designed per domain, with a slow drift inside the sequence
//   · the flight between stations, along the bus, with a lift in the middle
import * as THREE from 'three'
import { DIE, STATION_AT, STATION_YAW } from './layout'
import { clamp01, mix, smooth } from './kit'

type V3 = [number, number, number]
export interface Pose { pos: THREE.Vector3; target: THREE.Vector3; fov: number; /** 0 = world up · 1 = screen-up is -z (a top-down shot) */ top: number }

export const clonePose = (p: Pose): Pose => ({ pos: p.pos.clone(), target: p.target.clone(), fov: p.fov, top: p.top })

/**
 * How the subject is framed: the region of the canvas the shot composes into (the rest is the file column
 * and the words). `aspect` is the region's own shape and `rh` the fraction of the canvas's height it spans:
 * a shot's `halfH` / `halfW` are half the *region's* height and width in world units, so the canvas itself
 * shows 1/rh times as much and the subject fills the region, not the screen.
 */
export interface Region { aspect: number; rh: number }

/** One keyframe of a station's camera, in the station's own frame. */
export interface Key { p: number; at: V3; yaw: number; elev: number; halfH: number; halfW?: number; fov?: number }

const ROTY = (v: THREE.Vector3, a: number) => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), a)
export const FOV = 30

/** where the camera stands for a framing: `halfH` / `halfW` are half the visible height / width in world units at the target */
export function frame(k: Omit<Key, 'p'>, region: Region): { pos: V3; target: V3; fov: number } {
  const fov = k.fov ?? FOV, t = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
  const dist = Math.max(k.halfH, (k.halfW ?? k.halfH * Math.min(1.5, region.aspect)) / region.aspect) / (t * region.rh)
  const dir = new THREE.Vector3(Math.sin(k.yaw) * Math.cos(k.elev), Math.sin(k.elev), Math.cos(k.yaw) * Math.cos(k.elev))
  return { pos: [k.at[0] + dir.x * dist, k.at[1] + dir.y * dist, k.at[2] + dir.z * dist], target: k.at, fov }
}

const mixKey = (a: Key, b: Key, k: number): Omit<Key, 'p'> => ({
  at: [mix(a.at[0], b.at[0], k), mix(a.at[1], b.at[1], k), mix(a.at[2], b.at[2], k)], yaw: mix(a.yaw, b.yaw, k), elev: mix(a.elev, b.elev, k),
  halfH: mix(a.halfH, b.halfH, k), halfW: a.halfW !== undefined && b.halfW !== undefined ? mix(a.halfW, b.halfW, k) : undefined, fov: mix(a.fov ?? FOV, b.fov ?? FOV, k),
})

/** Keyframes per station, in the station's frame (x right, z toward the viewer). Hand-composed:
 *  the subject's scale, angle, depth and focus differ with what each domain shows (spec R4). */
export const KEYS: Key[][] = [
  // network: the whole campus from the front-left, in on the laptop and the wall for the request, then the wall, the SIEM and the evidence
  [
    { p: 0, at: [-0.51, 1.72, -0.67], yaw: -0.25, elev: 0.85, halfH: 8.77 },
    { p: 0.3, at: [3.17, 2.43, 1.3], yaw: -0.3, elev: 0.8, halfH: 7.22 },
    { p: 0.58, at: [2.73, 1.26, 1.85], yaw: -0.4, elev: 0.7, halfH: 5.93 },
    { p: 0.9, at: [4.53, 1.43, 0.2], yaw: -0.3, elev: 0.78, halfH: 7.29 },
    { p: 1, at: [4.53, 1.43, 0.2], yaw: -0.3, elev: 0.78, halfH: 7.29 },
  ],
  // iam: the cloud over the column and the identity, in on the aperture while it narrows, then along the beam to the two buckets, then out
  [
    { p: 0, at: [0.94, 2.34, -0.57], yaw: -0.3, elev: 0.8, halfH: 9.34 },
    { p: 0.4, at: [-0.31, 2.27, 1.52], yaw: -0.3, elev: 0.74, halfH: 7.43 },
    { p: 0.7, at: [1.02, 1.01, 2.3], yaw: -0.5, elev: 0.62, halfH: 6.32 },
    { p: 0.9, at: [0.33, 2.82, -0.08], yaw: -0.3, elev: 0.78, halfH: 9.01 },
    { p: 1, at: [0.33, 2.82, -0.08], yaw: -0.3, elev: 0.78, halfH: 9.01 },
  ],
  // mcp: the agent and the rack, in on the rack while the gantry reads it, in on the cage over the flagged tool, then out for the connections
  [
    { p: 0, at: [0.17, 3.2, -0.3], yaw: -0.3, elev: 0.8, halfH: 8.3 },
    { p: 0.4, at: [4.13, 2.4, 0.46], yaw: -0.25, elev: 0.7, halfH: 6.49 },
    { p: 0.68, at: [5.42, 1.35, -0.17], yaw: -0.35, elev: 0.6, halfH: 4.16 },
    { p: 0.9, at: [0.07, 3.28, -0.24], yaw: -0.3, elev: 0.78, halfH: 8.37 },
    { p: 1, at: [0.07, 3.28, -0.24], yaw: -0.3, elev: 0.78, halfH: 8.37 },
  ],
  // detect: along the track with the events, in on the merge and the cache, across to the note and the pending review, then the whole line
  [
    { p: 0, at: [-0.53, 0.91, 0.77], yaw: -0.3, elev: 0.8, halfH: 8.23 },
    { p: 0.4, at: [1.3, 1.29, 1.77], yaw: -0.25, elev: 0.72, halfH: 6.63 },
    { p: 0.7, at: [3.61, 0.87, -2.27], yaw: -0.35, elev: 0.68, halfH: 6.83 },
    { p: 0.9, at: [-0.45, 0.64, 0.48], yaw: -0.3, elev: 0.78, halfH: 8.33 },
    { p: 1, at: [-0.45, 0.64, 0.48], yaw: -0.3, elev: 0.78, halfH: 8.33 },
  ],
  // mail: a low, near shot of the message on its hook, in on the lens, across to the tray, then the tray and the plate
  [
    { p: 0, at: [0.73, 6.1, 1.2], yaw: -0.25, elev: 0.35, halfH: 5.72 },
    { p: 0.4, at: [-0.78, 5.0, 1.92], yaw: -0.2, elev: 0.3, halfH: 4.78 },
    { p: 0.75, at: [3.06, 3.32, 0.95], yaw: -0.3, elev: 0.4, halfH: 5.87 },
    { p: 0.9, at: [2.86, 2.1, 2.87], yaw: -0.3, elev: 0.55, halfH: 5.28 },
    { p: 1, at: [2.86, 2.1, 2.87], yaw: -0.3, elev: 0.55, halfH: 5.28 },
  ],
  // risk: along the lane to the arch and the door, in on the arch and its checklist, the barrier and the door, then the whole scene
  [
    { p: 0, at: [0.62, 2, 0.23], yaw: -0.3, elev: 0.8, halfH: 8.63 },
    { p: 0.4, at: [-4.12, 1.06, -0.74], yaw: -0.25, elev: 0.7, halfH: 5 },
    { p: 0.62, at: [1.64, 1.01, 0.79], yaw: -0.4, elev: 0.65, halfH: 4.69 },
    { p: 0.9, at: [1.3, 2, 0.7], yaw: -0.3, elev: 0.78, halfH: 7.99 },
    { p: 1, at: [1.3, 2, 0.7], yaw: -0.3, elev: 0.78, halfH: 7.99 },
  ],
]
/** The same stations framed for a phone's window (narrow): one main object at a time, the rest left to the chips and the lines. */
export const PHONE_KEYS: Key[][] = [
  [
    { p: 0, at: [-6.14, 1.61, -0.85], yaw: -0.25, elev: 0.8, halfH: 7.18 },
    { p: 0.3, at: [2.09, 2.13, 2.38], yaw: -0.3, elev: 0.78, halfH: 6.21 },
    { p: 0.58, at: [2.63, 2.12, 2.59], yaw: -0.4, elev: 0.7, halfH: 5.82 },
    { p: 0.9, at: [5.29, 1.08, -1.38], yaw: -0.3, elev: 0.74, halfH: 6.92 },
    { p: 1, at: [5.29, 1.08, -1.38], yaw: -0.3, elev: 0.74, halfH: 6.92 },
  ],
  [
    { p: 0, at: [-1.03, 1.83, 1.15], yaw: -0.3, elev: 0.8, halfH: 11.89 },
    { p: 0.4, at: [-3.51, 2.77, 1.19], yaw: -0.3, elev: 0.74, halfH: 8.49 },
    { p: 0.7, at: [1.58, 1.62, 2.98], yaw: -0.5, elev: 0.62, halfH: 10.2 },
    { p: 0.9, at: [1.33, 1.72, 1.88], yaw: -0.3, elev: 0.78, halfH: 10.47 },
    { p: 1, at: [1.33, 1.72, 1.88], yaw: -0.3, elev: 0.78, halfH: 10.47 },
  ],
  [
    { p: 0, at: [-3.93, 1.77, -0.95], yaw: -0.3, elev: 0.8, halfH: 9.14 },
    { p: 0.4, at: [3.94, 2.38, 0.26], yaw: -0.25, elev: 0.7, halfH: 8.01 },
    { p: 0.68, at: [4.63, 1.75, -0.07], yaw: -0.35, elev: 0.6, halfH: 5.81 },
    { p: 0.9, at: [-0.07, 2.94, -0.97], yaw: -0.3, elev: 0.78, halfH: 14.2 },
    { p: 1, at: [-0.07, 2.94, -0.97], yaw: -0.3, elev: 0.78, halfH: 14.2 },
  ],
  [
    { p: 0, at: [-5.03, 2.17, 1.81], yaw: -0.3, elev: 0.8, halfH: 7.97 },
    { p: 0.4, at: [0.26, 1.68, 1.71], yaw: -0.25, elev: 0.72, halfH: 7.45 },
    { p: 0.7, at: [2.5, 1.07, -3.76], yaw: -0.35, elev: 0.68, halfH: 9.93 },
    { p: 0.9, at: [1.69, 2.64, -0.14], yaw: -0.3, elev: 0.78, halfH: 11.56 },
    { p: 1, at: [1.69, 2.64, -0.14], yaw: -0.3, elev: 0.78, halfH: 11.56 },
  ],
  [
    { p: 0, at: [-2.46, 7.1, 1.54], yaw: -0.25, elev: 0.35, halfH: 4.77 },
    { p: 0.4, at: [-0.67, 5.2, 1.88], yaw: -0.2, elev: 0.3, halfH: 6.95 },
    { p: 0.75, at: [3.04, 3.53, 0.84], yaw: -0.3, elev: 0.4, halfH: 7.71 },
    { p: 0.9, at: [2.83, 2.21, 2.77], yaw: -0.3, elev: 0.55, halfH: 7.39 },
    { p: 1, at: [2.83, 2.21, 2.77], yaw: -0.3, elev: 0.55, halfH: 7.39 },
  ],
  [
    { p: 0, at: [-2.72, 2.3, 0.54], yaw: -0.3, elev: 0.8, halfH: 10.42 },
    { p: 0.4, at: [-4.37, 1.05, -0.86], yaw: -0.25, elev: 0.7, halfH: 6.23 },
    { p: 0.62, at: [0.35, 1.23, 0.78], yaw: -0.4, elev: 0.65, halfH: 6.25 },
    { p: 0.9, at: [3.49, 1.96, 0.46], yaw: -0.3, elev: 0.78, halfH: 10.57 },
    { p: 1, at: [3.49, 1.96, 0.46], yaw: -0.3, elev: 0.78, halfH: 10.57 },
  ],
]

/** a placeholder composition for a station whose shots are not designed yet */
const DEFAULT: Key[] = [{ p: 0, at: [0, 2.6, 0], yaw: -0.4, elev: 0.5, halfH: 9.5, halfW: 11 }, { p: 1, at: [0, 2.6, 0], yaw: -0.3, elev: 0.46, halfH: 9, halfW: 10.5 }]

export function keyAt(i: number, p: number, region: Region) {
  const ks = (region.aspect < 1.05 ? PHONE_KEYS[i] : KEYS[i]) ?? DEFAULT
  let a = ks[0], b = ks[ks.length - 1]
  for (let n = 0; n < ks.length - 1; n++) if (p >= ks[n].p && p <= ks[n + 1].p) { a = ks[n]; b = ks[n + 1]; break }
  return mixKey(a, b, b.p === a.p ? 1 : smooth((p - a.p) / (b.p - a.p)))
}

/** a station's pose in the world at progress p */
export function stationPose(i: number, p: number, region: Region): Pose {
  const f = frame(keyAt(i, p, region), region), s = STATION_AT[i], yaw = STATION_YAW[i]
  const pos = ROTY(new THREE.Vector3(...f.pos), yaw).add(new THREE.Vector3(s.x, 0, s.z))
  const target = ROTY(new THREE.Vector3(...f.target), yaw).add(new THREE.Vector3(s.x, 0, s.z))
  return { pos, target, fov: f.fov, top: 0 }
}

/** the resting shot of the hub, where the intro ends (a wide look at the monolith with the bus leading away) */
export function hubPose(region: Region): Pose {
  const f = frame({ at: [10, 3.2, 0], yaw: -0.52, elev: 0.5, halfH: 17, halfW: 21 }, region)
  return { pos: new THREE.Vector3(...f.pos), target: new THREE.Vector3(...f.target), fov: f.fov, top: 0 }
}

/**
 * The intro (spec R2): the first frame is the exterior's last, seen from straight above (the flat die
 * and its etched board), then the camera tips over and climbs away as the die is extruded.
 * `fov0` and `h0` are matched to the exterior's final frame by the caller.
 */
export const INTRO = {
  /** the whole intro: the camera is at the first station's shot when it ends */
  dur: 2.6,
  /** the camera reaches the wide hub shot (and the subject has finished moving into its region) */
  hubAt: 1.6,
  /** from here it flows on towards the first station, a flight of its own, so it never rests at the hub */
  blendFrom: 1.1,
  extrudeFrom: 0.08, extrudeTo: 1.4,
}
/** how far the intro has flowed on into the first station's shot: 0 until `blendFrom`, 1 at the end */
export const introBlend = (t: number) => smooth(clamp01((t - INTRO.blendFrom) / (INTRO.dur - INTRO.blendFrom)))
/** the subject moving into its region (the lens shift that makes room for the file column): done when the camera reaches the hub */
export const introCompose = (t: number) => smooth(clamp01((t - 0.4) / (INTRO.hubAt - 0.4)))
/** `into` is the station the intro runs on into (−1: none, it ends at the hub, as the way out does) */
export function introPose(t: number, region: Region, start: { fov: number; height: number }, into = -1): Pose {
  const base = introHub(t, region, start), w = into < 0 ? 0 : introBlend(t)
  if (w <= 0) return base
  const to = stationPose(into, 0, region), lift = Math.sin(Math.PI * w) * 9   // (the same swoop as a flight between stations)
  return { pos: base.pos.lerp(to.pos, w).add(new THREE.Vector3(0, lift, 0)), target: base.target.lerp(to.target, w).add(new THREE.Vector3(0, lift * 0.4, 0)), fov: mix(base.fov, to.fov, w), top: mix(base.top, 0, w) }
}
function introHub(t: number, region: Region, start: { fov: number; height: number }): Pose {
  const hub = hubPose(region), e = smooth(clamp01(t / INTRO.hubAt))
  // the camera first rises a touch (the die is being extruded under it), then tips and swings out
  const rise = Math.sin(Math.PI * clamp01(t / INTRO.hubAt)) * 5
  const tip = smooth(clamp01((t - 0.15) / (INTRO.hubAt - 0.15)))
  const top = new THREE.Vector3(0, start.height, 0.0001)
  const pos = top.clone().lerp(hub.pos, tip).add(new THREE.Vector3(0, rise, 0))
  const target = new THREE.Vector3(0, 0, 0).lerp(hub.target, tip)
  return { pos, target, fov: mix(start.fov, hub.fov, e), top: 1 - tip }
}

/** the flight between two poses: along the bus, lifting in the middle, easing at both ends */
export function flightPose(from: Pose, to: Pose, k: number): Pose {
  const e = smooth(clamp01(k)), lift = Math.sin(Math.PI * e) * 9
  return {
    pos: from.pos.clone().lerp(to.pos, e).add(new THREE.Vector3(0, lift, 0)),
    target: from.target.clone().lerp(to.target, e).add(new THREE.Vector3(0, lift * 0.4, 0)),
    fov: mix(from.fov, to.fov, e), top: mix(from.top, to.top, e),
  }
}

export { DIE }
