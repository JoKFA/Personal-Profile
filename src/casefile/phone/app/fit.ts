// The stage's fit (plan §2.1, as changed by the PM on 10-12 after P1 measured 27-60% of the viewport uncovered under the old rule):
// where the master picture sits on this screen. Pure, so it is tested without a browser.
import type { Rect } from '../manifest'

export interface View { w: number; h: number }
export interface Master { w: number; h: number }
/** master px -> screen px: x * s + tx, y * s + ty */
export interface Fit { s: number; tx: number; ty: number }

/** the top bar's height (css px, before the safe-area inset) */
export const BAR = 64
/** the panel's height by case: normal; the cover's (one line of action: eyebrow + "Inside my drive: six areas →", PM 10-13); the compact one for short viewports (summary and small line hidden) */
export const PANEL = { stop: 252, cover: 80, compact: 150 } as const
export const COMPACT_BELOW = 600
/** how much of the width and of the band's height the reticle may take; and the largest scale the "fit" alone may ask for */
export const FILL_W = 0.62, FILL_H = 0.9, MAX_FIT = 1.1
/** the visible part of the reticle is framed between these margins inside the band */
export const MARK_TOP = 4, MARK_BOTTOM = 6, TOP_GAP = 8

export const panelSpec = (viewH: number, cover: boolean) => (cover ? PANEL.cover : viewH < COMPACT_BELOW ? PANEL.compact : PANEL.stop)

/** the scale at which the master just covers the viewport */
export const coverScale = (view: View, master: Master) => Math.max(view.w / master.w, view.h / master.h)

/**
 * A stop. The reticle is put in the band between the top (bar, or the cover's sheet) and the panel, centred both ways, at
 * s = max(cover, min(fit, 1.1)): the master always covers the viewport, and the reticle takes at most 62% of the width and 90% of the band
 * unless covering needs more. A reticle taller than the band is aligned to the band's top + 8. The translation is then clamped so the master
 * still covers the viewport.
 */
export function stopFit(view: View, master: Master, reticle: Rect, top: number, panelH: number): Fit {
  const band = Math.max(40, view.h - panelH - top)
  const rw = reticle.x1 - reticle.x0, rh = reticle.y1 - reticle.y0
  const fit = Math.min(view.w * FILL_W / rw, band * FILL_H / rh)
  const s = Math.max(coverScale(view, master), Math.min(fit, MAX_FIT))
  const cx = (reticle.x0 + reticle.x1) / 2, cy = (reticle.y0 + reticle.y1) / 2
  let tx = view.w / 2 - cx * s
  let ty = rh * s > band ? top + TOP_GAP - reticle.y0 * s : top + band / 2 - cy * s
  tx = Math.min(0, Math.max(view.w - master.w * s, tx))
  ty = Math.min(0, Math.max(view.h - master.h * s, ty))
  return { s, tx, ty }
}

/** The open window: the master's width is the screen's, top-aligned. */
export function windowFit(view: View, master: Master): Fit {
  return { s: view.w / master.w, tx: 0, ty: 0 }
}

export const lerpFit = (a: Fit, b: Fit, k: number): Fit => ({ s: a.s + (b.s - a.s) * k, tx: a.tx + (b.tx - a.tx) * k, ty: a.ty + (b.ty - a.ty) * k })
export const toScreen = (f: Fit, p: { x: number; y: number }) => ({ x: p.x * f.s + f.tx, y: p.y * f.s + f.ty })
export const rectOn = (f: Fit, r: Rect): Rect => ({ x0: r.x0 * f.s + f.tx, y0: r.y0 * f.s + f.ty, x1: r.x1 * f.s + f.tx, y1: r.y1 * f.s + f.ty })
/** the part of a stop's reticle that can be seen: its rect clamped to [band top + 4, panel top - 6] (the marks, the tag and the hairline frame this) */
export function visibleRect(r: Rect, view: View, top: number, panelH: number): Rect {
  const lo = top + MARK_TOP, hi = Math.max(lo + 1, view.h - panelH - MARK_BOTTOM)
  return { x0: r.x0, x1: r.x1, y0: Math.min(hi, Math.max(lo, r.y0)), y1: Math.min(hi, Math.max(lo, r.y1)) }
}
/** does the stage (the master box under this fit) cover the whole screen? false = the page background would show at an edge */
export const covers = (f: Fit, master: Master, view: View) => f.tx <= 0.5 && f.ty <= 0.5 && f.tx + master.w * f.s >= view.w - 0.5 && f.ty + master.h * f.s >= view.h - 0.5
