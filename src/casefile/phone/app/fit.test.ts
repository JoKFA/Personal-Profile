import { describe, expect, it } from 'vitest'
import { BAR, coverScale, covers, lerpFit, panelSpec, rectOn, stopFit, visibleRect, windowFit } from './fit'

const master = { w: 480, h: 960 }
const ret = { x0: 110, y0: 330, x1: 360, y1: 650 }     // a 250 x 320 reticle in the 480 x 960 master
const SIZES: [number, number][] = [[375, 548], [390, 664], [390, 750], [430, 740], [360, 640], [412, 780], [412, 860]]

describe('stopFit (plan 2.1, PM rule of 10-12)', () => {
  it('the master always covers the viewport, at every test size and for the cover and the stops', () => {
    for (const [w, h] of SIZES) for (const cover of [false, true]) {
      const view = { w, h }, panel = panelSpec(h, cover), f = stopFit(view, master, ret, BAR, panel)
      expect(covers(f, master, view)).toBe(true)
      expect(f.s).toBeGreaterThanOrEqual(coverScale(view, master) - 1e-9)
    }
  })
  it('s = max(cover, min(fit, 1.1))', () => {
    const view = { w: 390, h: 750 }, panel = 252, band = 750 - panel - BAR
    const fit = Math.min(390 * 0.62 / 250, band * 0.9 / 320)
    const f = stopFit(view, master, ret, BAR, panel)
    expect(f.s).toBeCloseTo(Math.max(coverScale(view, master), Math.min(fit, 1.1)), 9)
    // a huge screen asks for more than 1.1: the fit part is capped (cover wins only if it is larger)
    const big = stopFit({ w: 1000, h: 2000 }, { w: 480, h: 960 }, ret, BAR, 252)
    expect(big.s).toBeCloseTo(Math.max(coverScale({ w: 1000, h: 2000 }, { w: 480, h: 960 }), 1.1), 9)
  })
  it('puts the reticle in the middle of the band when the clamp does not interfere', () => {
    const view = { w: 390, h: 860 }, panel = 252, f = stopFit(view, { w: 480, h: 1400 }, ret, BAR, panel), r = rectOn(f, ret)
    expect((r.x0 + r.x1) / 2).toBeCloseTo(195, 4)
    expect((r.y0 + r.y1) / 2).toBeCloseTo(BAR + (860 - panel - BAR) / 2, 4)
  })
  it('a reticle taller than the band has its face centred in the band (not its top aligned to band top + 8)', () => {
    const tall = { x0: 100, y0: 260, x1: 380, y1: 730 }, view = { w: 390, h: 664 }, panel = 252, f = stopFit(view, { w: 480, h: 1400 }, tall, BAR, panel), r = rectOn(f, tall)   // (a tall master: the clamp does not interfere)
    const band = view.h - panel - BAR
    expect(r.y1 - r.y0).toBeGreaterThan(band)                       // it is taller than the band here
    expect((r.y0 + r.y1) / 2).toBeCloseTo(BAR + band / 2, 4)        // and sits centred: the old rule gave r.y0 = BAR + 8
    expect(r.y0).toBeLessThan(BAR + 8 - 1)
  })
  it('the real X-001 reticle (master y 395, 250 x 453) on 390 x 664: the face (335 px) is inside the band (348 px)', () => {
    const x001 = { x0: 127, y0: 168.5, x1: 377, y1: 621.5 }, view = { w: 390, h: 664 }, f = stopFit(view, master, x001, BAR, 252)
    const faceH = (453 - 24) / 1.1, mid = (x001.y0 + x001.y1) / 2, a = (mid - faceH / 2) * f.s + f.ty, b = (mid + faceH / 2) * f.s + f.ty
    expect(a).toBeGreaterThanOrEqual(BAR - 0.5)
    expect(b).toBeLessThanOrEqual(664 - 252 + 0.5)
  })
  it('the cover: a face taller than the band sits on the panel and overflows at the top only', () => {
    const cover = { x0: 127, y0: 348.5, x1: 377, y1: 801.5 }, view = { w: 375, h: 548 }, panel = panelSpec(548, true), top = 190
    const f = stopFit(view, master, cover, top, panel), faceH = (453 - 24) / 1.1, mid = (cover.y0 + cover.y1) / 2
    const bottom = (mid + faceH / 2) * f.s + f.ty
    expect(faceH * f.s).toBeGreaterThan(548 - panel - top)         // it does not fit
    expect(bottom).toBeCloseTo(548 - panel, 4)                      // so it sits on the panel's top: nothing behind the panel
    // and when it fits it is centred
    const roomy = stopFit({ w: 412, h: 860 }, master, cover, 250, 80), rr = rectOn(roomy, cover)
    expect((rr.y0 + rr.y1) / 2).toBeCloseTo(250 + (860 - 80 - 250) / 2, 3)
  })
  it('the translation is clamped so the master covers: tx in [W - mw*s, 0], ty in [H - mh*s, 0]', () => {
    for (const [w, h] of SIZES) {
      const view = { w, h }, f = stopFit(view, master, { x0: 0, y0: 0, x1: 120, y1: 160 }, BAR, panelSpec(h, false))
      expect(f.tx).toBeLessThanOrEqual(0); expect(f.tx).toBeGreaterThanOrEqual(w - master.w * f.s - 1e-9)
      expect(f.ty).toBeLessThanOrEqual(0); expect(f.ty).toBeGreaterThanOrEqual(h - master.h * f.s - 1e-9)
    }
  })
  it('panel spec: 252 normally, 80 on the cover (one line), 150 (compact) for a stop when the viewport is under 600 tall', () => {
    expect(panelSpec(664, false)).toBe(252)
    expect(panelSpec(664, true)).toBe(80)
    expect(panelSpec(548, false)).toBe(150)
    expect(panelSpec(599, true)).toBe(64)          // the cover's one-line panel on a short viewport: the title line only
    expect(panelSpec(600, true)).toBe(80)
    expect(panelSpec(600, false)).toBe(252)
  })
})

describe('the visible reticle, the window, interpolation', () => {
  it('the marks frame the visible part: clamped to [band top + 4, panel top - 6]', () => {
    const view = { w: 390, h: 664 }, r = visibleRect({ x0: 100, y0: 20, x1: 300, y1: 600 }, view, 64, 252)
    expect(r.y0).toBe(68)
    expect(r.y1).toBe(664 - 252 - 6)
    const inside = visibleRect({ x0: 100, y0: 120, x1: 300, y1: 300 }, view, 64, 252)
    expect(inside).toEqual({ x0: 100, y0: 120, x1: 300, y1: 300 })
  })
  it('window: the master width is the screen width, top aligned; the shot interpolates between the two', () => {
    const view = { w: 390, h: 664 }, w = windowFit(view, master), s = stopFit(view, master, ret, BAR, 252)
    expect(w.s).toBeCloseTo(390 / 480, 6)
    expect(w.tx).toBe(0)
    expect(w.ty).toBe(0)
    expect(lerpFit(s, w, 0)).toEqual(s)
    expect(lerpFit(s, w, 1)).toEqual(w)
    expect(lerpFit(s, w, 0.5).s).toBeCloseTo((s.s + w.s) / 2, 9)
  })
})
