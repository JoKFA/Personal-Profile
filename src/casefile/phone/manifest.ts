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
  /** the profile drive's door (drive stands, cover slides, push to the die) */
  door?: Record<string, Shot>
}
