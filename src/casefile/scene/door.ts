// The door (docs/subject-space-spec.md §3): the subject drive, already open and decrypted, stands to
// face the reader, the camera comes round to its front and closes in until the die on its circuit board
// fills the view, and there the interior takes over. Pure functions of the door's clock `t` (seconds),
// so the exterior's camera can be tested without a GPU. The camera is described the way the archive's
// own is: a span (world units across the frame's height at the aim) at a distance; the lens (fov) follows.
import * as THREE from 'three'

export const DOOR = {
  /** the drive stands, the camera comes round to its front and centres it */
  stand: 1.1,
  /** the cut */
  end: 3.0,
  /** the dolly starts well before the stand ends, so the move never stops in the middle */
  dollyFrom: 0.5,
  /** the aim leaves the face's centre for the die */
  dieFrom: 1.8,
  /** the way out runs the door backwards this much faster than it came (seconds of door per second) */
  backSpeed: 2.7,
  /** the extra height the drive rises to clear the field in front of it */
  lift: 3.0,
  /** the camera's last distance from the drive's front, and its lens there (the die fills the frame) */
  finalDistance: 2.0,
  finalFov: 24.5,
} as const

// (cubic: the move spends less of its short life standing still at either end than the quintic does)
const smooth = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
/** span ÷ distance at the end: 2·tan(fov/2) */
export const FINAL_RATIO = 2 * Math.tan(THREE.MathUtils.degToRad(DOOR.finalFov) / 2)

export interface DoorPhase {
  /** 0 → 1: yaw and elevation to dead ahead, the drive upright and risen, the aim on its face */
  stand: number
  /** 0 → 1: how far the dolly has gone (on a log scale: constant apparent speed) */
  dolly: number
  /** 0 → 1: the lens widening from the archive's telephoto to the close lens */
  lens: number
  /** 0 → 1: the aim travelling from the face's centre to the die */
  die: number
  done: boolean
}
export function doorAt(t: number): DoorPhase {
  return {
    stand: smooth(t / DOOR.stand),
    dolly: smooth((t - DOOR.dollyFrom) / (DOOR.end - DOOR.dollyFrom)),
    // the lens follows the dolly (slower than it), so the drive only ever grows on the screen: a lens that widens on its own clock shrinks it
    lens: Math.pow(smooth((t - DOOR.dollyFrom) / (DOOR.end - DOOR.dollyFrom)), 2.2),
    die: smooth((t - DOOR.dieFrom) / (DOOR.end - DOOR.dieFrom)),
    done: t >= DOOR.end,
  }
}
/** distance from a start distance to the final one, log-interpolated */
export const doorDistance = (d0: number, dolly: number) => d0 * Math.pow(DOOR.finalDistance / d0, dolly)
/** span for a distance, easing the span/distance ratio from the start's to the close lens's */
export const doorSpan = (span0: number, d0: number, distance: number, lens: number) => distance * (span0 / d0 + (FINAL_RATIO - span0 / d0) * lens)

/** where the die is on the drive's face, in the drive's own frame (x right, y up from its base), from the etched texture */
export const DIE_ON_FACE = { x: 0.838, y: 1.989, halfW: 0.462 }
