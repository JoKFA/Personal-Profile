// The look, in one place. "Clear": a sharp subject, a calm background, light only where it means
// something. Every number the light is tuned by lives here, so a later pass changes it in one spot.
export const LOOK = {
  exposure: 0.96,
  /** screen focus: blur radius × focusMax, sharp region × focusRadius */
  focusMax: 0.5, focusRadius: 1.45,
  /** the always-on bloom stays off; while a drive is read, its trace light blooms (threshold falls from haloThreshold to 1 as the strength rises) */
  haloRadius: 0.5, haloThreshold: 1.4, readBloom: 0.1,
  /** records' inner light; home: light on the four selected drives, their shells clear, the circuit etched bright */
  lamp: 0.55, briefLamp: 1.6, slot: 0.4, briefEtch: 0.75,
  /** display grade: per-channel gain, contrast, vignette, a light unsharp mask */
  gain: [1, 0.997, 0.988], contrast: 1.07, vignette: 0.05, sharpen: 0.3,
  ivoryMin: 0.9, fogNear: -2, fogFar: -12,
  /** material and light balance */
  trans: 0.26, shellRough: 0.2, keyMul: 1.2, hemiMul: 0.85, sideMul: 0.8, fillMul: 1.1, ao: 1.0, motionBlur: 0.3,
} as const

/**
 * Home: the four selected files each stand straight up out of their own slot, and nothing else moves.
 * `lift` is how far they rise (drive units); `zoom`, `shiftX`, `shiftY` frame them (how much wider than the
 * archive's lens, and where they sit as fractions of the frame); `flat` is how still the field lies on home
 * (1 = no swell round the selection); `quiet` is how far the other records' light drops (1 = dark).
 */
export const SHELF_K = { lift: 1.8, zoom: 0.62, shiftX: 0.30, shiftY: -0.09, flat: 1, quiet: 0.85 } as const
