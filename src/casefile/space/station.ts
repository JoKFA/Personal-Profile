// What every station provides. A station is a *function of progress*: set(p) puts every part where
// it belongs at p ∈ [0, 1] of its sequence, with no hidden state, so replay, scrubbing, holding on
// the result and returning to a finished station all use the same code (spec R12). Steps begin at
// STEP_AT; the result is final from RESULT_AT, and the evidence plate lands between LAND_FROM and 1.
import type * as THREE from 'three'
import type { Kit } from './kit'

export const STEP_AT = [0, 0.26, 0.55, 0.86] as const
export const RESULT_AT = 0.86
export const LAND_FROM = 0.88
export const stepOf = (p: number) => (p < STEP_AT[1] ? 0 : p < STEP_AT[2] ? 1 : p < STEP_AT[3] ? 2 : 3)

type V3 = [number, number, number]
export interface Station {
  group: THREE.Group
  /** `appear` (0 → 1) is how much of the station has been put in place: it rises while the camera flies in, so the first shot already has its pieces */
  set(p: number, t: number, appear: number): void
  /** points (station-local) that the HTML fields hang from */
  anchors: Record<string, V3>
  /** what the evidence thumbnail frames, in station-local coordinates */
  result: { at: V3; halfH: number; yaw: number; elev: number }
  /** the evidence plate's resting place and where it comes from (local) */
  plate: THREE.Object3D
  dispose(): void
}
export type Build = (kit: Kit, quality: { transmission: boolean }) => Station
