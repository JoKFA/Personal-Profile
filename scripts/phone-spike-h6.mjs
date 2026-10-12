// P0.3 item 5 (H6): frame times of the existing profile interior on a phone viewport, at 1x and 4x CPU throttling.
// node scripts/phone-spike-h6.mjs <outDir> [--base=...]
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const [OUT, ...rest] = process.argv.slice(2)
const BASE = (rest.find((x) => x.startsWith('--base=')) || '--base=http://127.0.0.1:5194').split('=')[1]
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, avgMs: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(1), p95Ms: +s[Math.floor(s.length * 0.95)].toFixed(1), maxMs: +s[s.length - 1].toFixed(1), over33: s.filter((x) => x > 33.4).length, over50: s.filter((x) => x > 50).length, fps: +(1000 / (s.reduce((x, y) => x + y, 0) / s.length)).toFixed(1) } }
const results = []
for (const cfg of [{ name: '1x', rate: 1, when: 'none' }, { name: '4x-from-load', rate: 4, when: 'load' }, { name: '4x-before-click', rate: 4, when: 'click' }]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
  await ctx.addInitScript(() => {
    try { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') } catch { /* */ }
    window.__rec = false; window.__iv = []; let last = 0
    const t = (now) => { requestAnimationFrame(t); if (window.__rec && last) window.__iv.push(now - last); last = now }
    requestAnimationFrame(t)
  })
  const p = await ctx.newPage(); p.setDefaultTimeout(180000)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  const cdp = await ctx.newCDPSession(p)
  if (cfg.when === 'load') await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.rate })
  const t0 = Date.now()
  await p.goto(`${BASE}/`, { waitUntil: 'load' })
  await p.waitForFunction(() => window.__cf && window.__cf.getSnapshot().mode === 'archive')
  await p.waitForSelector('.brief-inside', { state: 'visible' })
  const homeMs = Date.now() - t0
  await p.waitForTimeout(1500)
  if (cfg.when === 'click') await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.rate })
  const tierBefore = await p.evaluate(() => window.__cf.getSnapshot().quality)
  // the home itself, 3 s, as a reference
  await p.evaluate(() => { window.__iv = []; window.__rec = true }); await p.waitForTimeout(3000)
  const home = await p.evaluate(() => { window.__rec = false; return window.__iv.slice() })
  await p.evaluate(() => { window.__iv = []; window.__rec = true })
  const tc = Date.now()
  await p.click('.brief-inside')
  await p.waitForSelector('.space.live', { timeout: 120000 }).catch(() => {})
  const doorMs = Date.now() - tc
  const door = await p.evaluate(() => { window.__rec = false; return window.__iv.slice() })
  await p.evaluate(() => { window.__iv = []; window.__rec = true })
  await p.waitForTimeout(8000)
  const tour = await p.evaluate(() => { window.__rec = false; return window.__iv.slice() })
  const tierAfter = await p.evaluate(() => window.__cf.getSnapshot().quality)
  await p.screenshot({ path: path.join(OUT, `h6-${cfg.name}-tour.png`) })
  const area = await p.evaluate(() => document.querySelector('.space')?.getAttribute('data-area') ?? null)
  results.push({ cfg: cfg.name, rate: cfg.rate, throttleApplied: cfg.when, homeReadyMs: homeMs, tierBeforeOpen: tierBefore, tierAfterTour: tierAfter, interiorLive: !!area, area, openToLiveMs: doorMs, home3s: stats(home), openingToLive: door.length ? stats(door) : null, tour8s: stats(tour), errors: errs.slice(0, 5) })
  console.log(JSON.stringify(results.at(-1)))
  await ctx.close()
}
await b.close()
fs.writeFileSync(path.join(OUT, 'h6.json'), JSON.stringify(results, null, 1))
