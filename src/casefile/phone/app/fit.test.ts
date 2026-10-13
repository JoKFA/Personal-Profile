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
  it('a reticle taller than the band is aligned to band top + 8', () => {
    const tall = { x0: 100, y0: 100, x1: 380, y1: 900 }, view = { w: 390, h: 664 }, f = stopFit(view, master, tall, BAR, 252), r = rectOn(f, tall)
    expect(r.y0).toBeCloseTo(BAR + 8, 4)
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
    expect(panelSpec(599, true)).toBe(80)
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
