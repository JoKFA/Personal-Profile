// P3c runtime review fixes, measured: (1) a control that starts motion brings the picture into view first, (2) the result block's reserve and its own height
// (the grid moves once, on a spring), (4) `Open X-…` from a result: out-i at 1.5x, a 180 ms crossfade to the target's stop picture, then its open clip.
//   node p3c-fixes.mjs <outDir> [--base=http://127.0.0.1:4199] [--only=scroll,hole,jump] [--size=390x664]
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4199'), ONLY = flag('only', 'scroll,hole,jump').split(',')
const [W0, H0] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const R = {}
const note = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)) }
const open = async (W, H) => {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)) })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`${BASE}/?phone-app`, { waitUntil: 'load' }); await p.evaluate(() => localStorage.setItem('yw.entry', '1'))
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  await p.touchscreen.tap(W / 2, H * 0.3)
  const bb = await p.locator('.ph-door').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await p.waitForFunction(() => window.__phone.space?.mode === 'station', null, { timeout: 40000 })
  return { ctx, p, errs }
}
// a click that does not scroll the page first (the page's own scroll is what is measured)
const press = (p, sel, n = 0) => p.locator(sel).nth(n).evaluate((e) => e.click())
const sampleScroll = (p, ms) => p.evaluate((ms) => new Promise((res) => { const t0 = performance.now(), out = []; const f = () => { out.push([Math.round(performance.now() - t0), Math.round(scrollY), window.__phone.space.mode]); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out) }; f() }), ms)
const toGrid = (p, y = 420) => p.evaluate((y) => { scrollTo(0, y) }, y)

if (ONLY.includes('scroll')) {
  const { ctx, p, errs } = await open(W0, H0)
  const cases = [
    ['pick', async () => { await press(p, '.ph-sp-nav button', 3) }],
    ['step', async () => { await press(p, '.ph-sp-steps button', 2) }],
    ['replay', async () => { await press(p, '.ph-sp-ctl button', 1) }],
    ['resume', async () => { await press(p, '.ph-sp-ctl button', 0) }],
  ]
  const rows = []
  for (const [name, act] of cases) {
    if (name === 'resume') { await press(p, '.ph-sp-ctl button', 0); await p.waitForTimeout(300) }   // pause first (a Pause), then read, then Resume
    await p.waitForTimeout(600)
    await toGrid(p); await p.waitForTimeout(250)
    const y0 = await p.evaluate(() => scrollY), mode0 = await p.evaluate(() => window.__phone.space.mode), playing0 = await p.evaluate(() => window.__phone.space.state.playing)
    const t = Date.now(); await act()
    const s = await sampleScroll(p, 900)
    const to0 = s.find((r) => r[1] <= 1)
    const state = await p.evaluate(() => ({ mode: window.__phone.space.mode, ...window.__phone.space.state }))
    rows.push({ name, y0, modeBefore: mode0, playingBefore: playing0, reachedTopMs: to0 ? to0[0] : null, scrollAt150: (s.find((r) => r[0] >= 150) ?? [0, null])[1], scrollAt300: (s.find((r) => r[0] >= 300) ?? [0, null])[1], monotone: s.every((r, i) => i === 0 || r[1] <= s[i - 1][1] + 1), reading: state.reason === 'reading', after: { mode: state.mode, playing: state.playing, reason: state.reason } })
    if (name === 'pick') await p.screenshot({ path: `${OUT}/scroll-pick-after.png` })
    if (name === 'pick') await p.waitForFunction(() => window.__phone.space.mode === 'rest' || window.__phone.space.mode === 'station', null, { timeout: 40000 })
  }
  // already in view (>= 90%): no scroll at all
  await toGrid(p, 20); await p.waitForTimeout(200)
  const y1 = await p.evaluate(() => scrollY); await press(p, '.ph-sp-ctl button', 1); const s2 = await sampleScroll(p, 400)
  rows.push({ name: 'skip when in view', y0: y1, scrollAfter: s2.at(-1)[1], unchanged: s2.every((r) => Math.abs(r[1] - y1) <= 1) })
  note('scroll', { size: `${W0}x${H0}`, rows, errs, csp: await p.evaluate(() => window.__csp) })
  await ctx.close()
}

if (ONLY.includes('hole')) {
  for (const [W, H] of [[390, 664], [375, 548]]) {
    const { ctx, p, errs } = await open(W, H)
    const heights = []
    for (let i = 0; i < 6; i++) {
      await p.evaluate((i) => window.__phone.space.showFrame(i, 62), i); await p.waitForFunction(() => window.__phone.space.mode === 'held', null, { timeout: 8000 }); await p.waitForTimeout(250)
      const before = await p.evaluate(() => ({ res: document.querySelector('.ph-sp-result').getBoundingClientRect().height, gap: document.querySelector('.ph-sp-nav').getBoundingClientRect().top - document.querySelector('.ph-sp-cap').getBoundingClientRect().bottom }))
      if (i === 0 || i === 2) await p.screenshot({ path: `${OUT}/hole-${W}x${H}-st${i + 1}-f62.png` })
      await p.evaluate((i) => window.__phone.space.showFrame(i, 124), i); await p.waitForTimeout(700)
      const after = await p.evaluate(() => ({ res: document.querySelector('.ph-sp-result').getBoundingClientRect().height, navTop: Math.round(document.querySelector('.ph-sp-nav').getBoundingClientRect().top) }))
      if (i === 0) await p.screenshot({ path: `${OUT}/hole-${W}x${H}-st1-f124.png` })
      heights.push({ area: i + 1, reserve: Math.round(before.res), blankBetweenCapAndGrid: Math.round(before.gap), resultBlock: Math.round(after.res) })
    }
    note(`hole ${W}x${H}`, { heights, tallestResultBlock: Math.max(...heights.map((h) => h.resultBlock)), errs })
    await ctx.close()
  }
}

if (ONLY.includes('jump')) {
  // three jumps from three results (a pick during the tour is the quick way to a result): tap `Open X-...` to the open clip finishing
  const rows = []
  for (const area of [1, 2, 4]) {
    const { ctx, p, errs } = await open(W0, H0)
    await press(p, '.ph-sp-nav button', area)
    await p.waitForFunction((a) => window.__phone.space.area === a && window.__phone.space.mode === 'rest', area, { timeout: 60000 })
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500)
    const go = (await p.locator('.ph-sp-result .ph-sp-go').first().textContent()).trim()
    const t0 = Date.now()
    await p.evaluate(() => document.querySelector('.ph-sp-result .ph-sp-go').click())
    await p.waitForFunction(() => window.__phone.phase === 'file', null, { timeout: 30000 })
    rows.push({ area, link: go, ms: Date.now() - t0, openId: await p.evaluate(() => window.__phone.openId), url: await p.evaluate(() => location.pathname), errs, csp: await p.evaluate(() => window.__csp) })
    await ctx.close()
  }
  note('jump', { rows, maxMs: Math.max(...rows.map((r) => r.ms)) })
}
fs.writeFileSync(`${OUT}/fixes.json`, JSON.stringify(R, null, 1))
await b.close()
