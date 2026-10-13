// The contract between the bake (src/casefile/phone/bake, `npm run phone:bake`) and the phone runtime.
// The bake writes public/phone/manifest.json in this shape; the runtime reads only this file to find
// every picture. All coordinates are in master CSS px (MASTER.w × MASTER.h); the runtime multiplies
// them by its stage scale. File names are content-hashed and live under /phone/.

/** the bake's viewport: the stop framing sits in the middle with bleed all round (plan §2.1) */
export const MASTER = { w: 480, h: 960 } as const
/** the five stops of the reel, in order (cover first) */
export const REEL = ['YW-000', 'X-001', 'SR-01', 'SR-02', 'X-009'] as const

export interface Pt { x: number; y: number }
export interface Rect { x0: number; y0: number; x1: number; y1: number }

interface Asset {
  /** hashed file name, relative to /phone/ */
  file: string
  bytes: number
  /** pixel size of the file */
  w: number; h: number
}
export interface Still extends Asset { dpr: number }
export interface Clip extends Asset {
  frames: number
  fps: number
}
/** A clip the page layer rides frame by frame (open, close, door). Index i = clip frame i. */
export interface Shot extends Clip {
  /** the drive's face corners each frame (faceQuad with a 0.5 inset: tl, tr, br, bl as projected) */
  quads: Pt[][]
  /** the camera's progress each frame, 0 = the stop's framing, 1 = the window's (the face filling the width) */
  cam: number[]
}

export interface Stop {
  id: string
  still: Still
  /** the reader's box around the drive at rest */
  reticle: Rect
  /** the face corners at rest (faceQuad 0) */
  quad: Pt[]
}

export interface OpenShot extends Shot {
  /** the last frame, at the still's resolution: the face filling the master width */
  window: Still
  /** the secure element's centre in the window frame (measured on the pixels) */
  die: Pt
  /** the face's inner rect in the window frame (where the demo goes) */
  face: Rect
}

export interface PhoneManifest {
  version: 1
  /** hash of entries.ts, the director and the engine files the pictures depend on (verify fails when stale) */
  inputHash: string
  master: { w: number; h: number }
  reel: string[]
  /** the archive's entrance (the wave), continuing into the push onto the cover's drive */
  entrance: Clip & { endsOn: string }
  /** every entry that is listed in the Index has a stop */
  stops: Record<string, Stop>
  /** neighbours on the reel, both ways: key `${from}>${to}` */
  pans: Record<string, Clip>
  open: Record<string, OpenShot>
  close: Record<string, Shot>
  /** the profile drive's door (drive stands, cover slides, push to the die): the engine's own door on the master, from the cover stop to the cut */
  door?: Record<string, Shot>
  /**
   * the profile drive's interior (P3c): its pictures are described by a hashed JSON of its own (SpaceManifest), fetched when YW-000 is entered.
   * YW-000 has no open / close / window shot: it goes through the door.
   */
  space?: { file: string; bytes: number }
}

// ───────────────────────── the interior (P3c, plan "P3c · YW-000 的门和内景") ─────────────────────────
// Everything below is what `public/phone/space-<hash>.json` holds. The interior is baked through the real door, interior and runtime code
// (the clock, the camera, the stations): nothing here is a pose of ours. Coordinates are master px (MASTER.w × MASTER.h, the canvas the interior
// was drawn on). The stage places it by the window rule (s = screen width / 480, top aligned); below SPACE_REGION.rect is the page's paper.

/** the canvas and the subject's region in it, as the interior's own layout (SpaceLayout) and as a master-px rect */
export interface SpaceRegion {
  width: number; height: number
  /** the region's centre and size as fractions of the canvas */
  cx: number; cy: number; rw: number; rh: number
  rect: Rect
}
/** a chip's anchor, per clip frame: where on the picture the chip's hairline hangs from, and whether it is in front of the camera */
export interface SpaceChip {
  /** index in AREA_CONTENT[station].chips (space/content.ts) */
  chip: number
  /** the anchor's name on the station */
  at: string
  x: number[]; y: number[]
  on: boolean[]
}
export interface SpaceStation {
  index: number
  /** AREA_CONTENT[index].key, and the file it opens */
  key: string
  entry: string
  /** p 0 → 1: the station's own sequence at the tour's pace (5.0 s); frame i is clip frame i */
  clip: Clip
  /** the clock's p at each clip frame */
  p: number[]
  /** the first clip frame with p >= RESULT_AT (0.86): the result exists from here */
  resultFrame: number
  /** the first clip frame of each of the four steps (STEP_AT) */
  stepFrames: number[]
  /** the chips marked `phone: true` in space/content.ts, one entry each */
  chips: SpaceChip[]
  /** the evidence plate's screen point at the result frame and on the clip's last frame */
  plate: { result: Pt; end: Pt }
  /** the station at p = 1 (reduced motion, rejected playback, a held result) */
  rest: Still
  /** the evidence thumbnail (the desktop's own framing and size) */
  thumb: Still
}
/** a clip whose frames the page layer rides (the exit lands the reticle back on the cover) */
export interface SpaceExit extends Clip {
  /** the drive face's corners per frame (faceQuad(0.5)); [] while the interior is on screen */
  quads: Pt[][]
  /** the door's progress per frame (0 = the cover's framing) */
  cam: number[]
  /** the first clip frame the exterior is on screen again (the door running backwards) */
  doorFrame: number
}
export interface SpaceManifest {
  version: 1
  inputHash: string
  fps: number
  region: SpaceRegion
  /** what the exterior handed over at the cut (Handoff in space/scene.ts), so a re-bake can be checked against the door */
  handoff: { glow: number; fov: number; dieFrac: number }
  /** the first frame after the cut → station 0 at p = 0 */
  intro: Clip
  /** six stations, in tour order */
  stations: SpaceStation[]
  /** the tour's flights: key `${i}>${i + 1}`, station i's result → station i + 1 at p = 0 */
  fly: Record<string, Clip>
  /** station i's result → the hub (the desktop's own way out, runtime.exit()); key = i */
  out: Record<string, Clip>
  /** the hub → station i at p = 0 (a pick is out + in); key = i */
  in: Record<string, Clip>
  /** the hub, still */
  hub: Still
  /** the hub → the intro played backwards → the door running backwards → the cover stop */
  exit: SpaceExit
}
