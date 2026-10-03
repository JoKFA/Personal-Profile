// The interior's plan (spec docs/subject-space-spec.md §2, §4). The interior is the inside of the
// drive: its floor is the drive's own circuit board seen at human scale, the die is a monolith at
// the origin, and the six stations stand along the bus that runs out of it, far apart.
export const AREAS = ['network', 'iam', 'mcp', 'detect', 'mail', 'risk'] as const
export type AreaKey = (typeof AREAS)[number]

/** distance between neighbouring stations: no settled shot may see another station (spec R3) */
export const SPACING = 230
/**
 * The haze follows the shot: the subject (at `dist` from the camera) stays clear, and everything beyond a
 * station's reach of it is lost. A station is "not visible" once its nearest point is beyond the far end.
 */
export const fogFor = (dist: number) => ({ near: dist + 18, far: dist + 62 })
/** a station's bounding radius: everything it builds lies within this of its centre */
export const STATION_RADIUS = 13

/** station centres on the floor (x along the bus), with a small sideways drift so the bus bends */
const DRIFT = [-14, 18, -22, 16, -18, 14]
export const STATION_AT = AREAS.map((_, i) => ({ x: SPACING * (i + 1), z: DRIFT[i] }))
/** each station is turned a little so no two shots look along the same line */
export const STATION_YAW = [0.0, 0.34, -0.26, 0.5, -0.38, 0.22]

/** the hub: the die, where the cut arrives; its footprint in world units (the face's die is 216 × 168 px) */
export const DIE = { w: 24, d: 18.7, h: 8.4 }
/** world units per pixel of the etched face texture (1024 × 760): the hub patch is the face itself, enlarged */
export const PX = DIE.w / 216
/** how much larger than the drive its assembly stands on the board: the face plane is 4.38 units wide for 1024 px */
export const HUB_SCALE = (1024 * PX) / 4.38
export const FACE_PX = { w: 1024, h: 760, dieCx: 708, dieCy: 348 }
