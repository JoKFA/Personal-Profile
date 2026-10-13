// shared by the P2 verification scripts (Playwright, Chrome channel, mobile emulation)
import { chromium } from '@playwright/test'
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

export async function launch(W, H, { dsf = 3 } = {}) {
  const b = await chromium.launch({ channel: 'chrome', args: GPU })
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true })
  const p = await ctx.newPage(); p.setDefaultTimeout(90000)
  const errs = []
  p.on('pageerror', (e) => errs.push('pageerror ' + e)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error ' + m.text()) })
  const cdp = await ctx.newCDPSession(p)
  return { b, ctx, p, cdp, errs }
}
/** a real touch drag (CDP touch events), 60% of the screen up (down = toward later sections), 25 px per 12 ms */
export const swipe = async (cdp, W, H, dir = 'down', frac = 0.62) => {
  const t = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: W / 2, y }] })
  const y0 = dir === 'down' ? H * 0.82 : H * 0.2, dy = (dir === 'down' ? -1 : 1) * H * frac
  await t('touchStart', y0)
  const n = Math.round(Math.abs(dy) / 25)
  for (let i = 1; i <= n; i++) { await t('touchMove', y0 + dy * i / n); await new Promise((r) => setTimeout(r, 12)) }
  await t('touchEnd')
}
export const state = (p) => p.evaluate(() => ({ phase: window.__phone.phase, at: window.__phone.at, busy: window.__phone.busy, mode: window.__phone.mode, y: Math.round(scrollY), url: location.pathname }))
export const until = (p, fn, arg, ms = 90000) => p.waitForFunction(fn, arg, { timeout: ms })

/** layout checks at a rest state (scrolled to section i) */
export const checks = (p, i) => p.evaluate((i) => {
  const ph = window.__phone, H = innerHeight, W = innerWidth
  const out = { i, view: [W, H], overflowX: document.documentElement.scrollWidth - W, issues: [] }
  const panels = [...ph.dom.panels.values()]
  const pan = panels[i]
  if (pan) {
    const r = pan.el.getBoundingClientRect(), sec = pan.section.getBoundingClientRect()
    out.panelTop = Math.round(r.top - sec.top + sec.top), out.panelH = Math.round(r.height)
    out.panelNatural = pan.el.scrollHeight
    // the reticle on screen
    const m = ph.marks(); const ys = m.map((q) => q.y), xs = m.map((q) => q.x)
    out.reticle = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
    out.reticleW = Math.round(out.reticle.x1 - out.reticle.x0); out.reticleH = Math.round(out.reticle.y1 - out.reticle.y0)
    out.overlapPanel = Math.round(Math.max(0, out.reticle.y1 - r.top) * 10) / 10
    const top = i === 0 ? ph.dom.sheet.getBoundingClientRect().bottom : ph.dom.bar.getBoundingClientRect().bottom
    out.overlapTop = Math.round(Math.max(0, top - out.reticle.y0) * 10) / 10
    out.bandTop = Math.round(top)
    // clipped or overflowing text inside the panel, and anything past the screen edges
    for (const e of pan.el.querySelectorAll('p, h2, button, span.ph-ticks')) {
      const b = e.getBoundingClientRect(); if (!b.width) continue
      if (b.right > W + 0.5 || b.left < -0.5) out.issues.push(`${e.className || e.tagName} outside width ${Math.round(b.left)}..${Math.round(b.right)}`)
      if (b.bottom > r.bottom + 0.5 && getComputedStyle(e).position !== 'absolute') out.issues.push(`${e.className || e.tagName} below panel bottom by ${Math.round(b.bottom - r.bottom)}`)
    }
    if (pan.el.scrollHeight > pan.el.clientHeight + 1) out.issues.push(`panel scrollHeight ${pan.el.scrollHeight} > clientHeight ${pan.el.clientHeight}`)
    const fs = new Set(); for (const e of pan.el.querySelectorAll('p, h2, button, small, div')) { if (e.childElementCount === 0 || e.tagName === 'P' || e.tagName === 'H2') fs.add(parseFloat(getComputedStyle(e).fontSize)) }
    out.minFontPx = Math.min(...fs)
  }
  if (i === 0) {
    const sh = ph.dom.sheet; for (const e of sh.querySelectorAll('p')) { const b = e.getBoundingClientRect(); if (b.right > W + 0.5) out.issues.push('sheet text outside width') }
    out.sheetBottom = Math.round(sh.getBoundingClientRect().bottom)
  }
  // the stage box vs the screen: does the master picture cover everything? (the dev master has no bleed, so it will not)
  const f = ph.fits[i], mw = ph.manifest.master
  out.fit = { s: +f.s.toFixed(3), tx: +f.tx.toFixed(1), ty: +f.ty.toFixed(1) }
  out.stageCovers = f.tx <= 0.5 && f.ty <= 0.5 && f.tx + mw.w * f.s >= W - 0.5 && f.ty + mw.h * f.s >= H - 0.5
  out.layout = { ...ph.layout }
  return out
}, i)

