// Lab hooks: how the phone's bake (src/casefile/phone/bake) drives the real archive frame by frame.
// They exist only in dev and in a `vite build --mode bake`: LAB is a compile-time constant, so every
// `if (LAB)` / `LAB ? … : …` below it is gone from a production bundle (`npm run phone:check` greps for the names).
import type { Archive } from './archive'

/** true in the dev server and in `--mode bake`; false in the production build */
export const LAB: boolean = import.meta.env.DEV || import.meta.env.MODE === 'bake'

/**
 * Test and measuring hooks (window.__cf, __space, __phone, the frame counter; the test-only query flags in flags.ts): true in the dev server, in `--mode bake` and in a build made with
 * VITE_HOOKS=1 (the e2e's desktop build and the phone's dev tools); false in the production build, which compiles every one of them out.
 */
export const HOOKS: boolean = LAB || import.meta.env.VITE_HOOKS === '1'

/** what the director may override, frame by frame (window.__lab) */
export interface LabHooks {
  lift?: number; clear?: number; tilt?: number; face?: number; sharp?: boolean; slot?: number; quiet?: number; blur?: number
  clearCells?: Map<string, number>
  drop?: (dRow: number, dLane: number) => number
  pose?: { c: number[]; yaw: number; tilt: number; roll: number }
  fog?: number[]
  light?: { reveal: number; glow: number; die: number }
  /** hold the field's idle "breathing" at 0: the baked pixels are still when nothing moves (art decision, plan §3.1) */
  idle0?: boolean
  /** the camera's aim follows `to` (world) by weight k (0 = the engine's own aim, 1 = `to`): the door keeps the drive in the middle of the frame */
  aim?: { to: number[]; k: number }
  /** the enclosure's cover slid off the board (0 → 1), as the door does it */
  cover?: number
}
/** window.__camOv: the camera, overridden */
export interface CamOverride { yaw: number; elev: number; span: number; dist?: number; aim?: number[] | 'sel'; dy?: number }
export type PhoneDirectorHook = (t: number, dt: number, a: Archive) => void

declare global {
  interface Window {
    __lab?: LabHooks
    __camOv?: CamOverride
    __phoneDirector?: PhoneDirectorHook
  }
}
