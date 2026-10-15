// P3c modes and routes: reduced motion (stills and crossfades only), play refused (stills, with the hub), a cold /projects/profile (cover, then the door; no
// entry page), browser Back/Forward and Esc (no clip), the page going to the background, a bfcache restore.
//   node p3c-modes.mjs <outDir> [--base=http://127.0.0.1:4199]
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4199'), W = 390, H = 664
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: GPU })
const R = {}
const open = async ({ reduced = false, path = '/', query = '', seed = true } = {}) => {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)) })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  if (seed) { await p.goto(`${BASE}/?phone-app`, { waitUntil: 'load' }); await p.evaluate(() => localStorage.setItem('yw.entry', '1')) }
  await p.goto(`${BASE}${path}?phone-app&phone-expose${query}`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  await p.touchscreen.tap(W / 2, H * 0.3)
  return { ctx, p, errs }
}
const tapAt = async (p, l) => { await l.scrollIntoViewIfNeeded(); const bb = await l.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }
const mode = (p) => p.evaluate(() => ({ phase: window.__phone.phase, mode: window.__phone.space?.mode, area: window.__phone.space?.area, stage: window.__phone.stage.mode, current: window.__phone.stage.current, videosOn: [...document.querySelectorAll('video.on')].length, played: window.__phone.space?.player?.presented ?? 0 }))
const waitMode = (p, m, ms = 30000) => p.waitForFunction((m) => window.__phone.space?.mode === m, m, { timeout: ms })
const note = (k, v) => { R[k] = v; console.log(k, JSON.stringify(v)) }

// 1. reduced motion: rest stills and crossfades only
{
  const { ctx, p, errs } = await open({ reduced: true })
  await tapAt(p, p.locator('.ph-door'))
  await waitMode(p, 'rest', 15000); await p.waitForTimeout(400)
  const a = await mode(p)
  await tapAt(p, p.locator('.ph-sp-nav button').nth(3)); await p.waitForFunction(() => window.__phone.space.area === 3 && window.__phone.space.mode === 'rest', null, { timeout: 8000 }); await p.waitForTimeout(300)
  const c = await mode(p)
  await p.screenshot({ path: `${OUT}/reduced-station4.png` })
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('.ph-back').tap(); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 8000 })
  note('reduced', { afterDoor: a, afterPick: c, cover: await mode(p), errs, csp: await p.evaluate(() => window.__csp) })
  await ctx.close()
}
// 2. play refused: stills, with the hub between two stations
{
  const { ctx, p, errs } = await open({ query: '&phone-reject' })
  await tapAt(p, p.locator('.ph-door'))
  await waitMode(p, 'rest', 20000); await p.waitForTimeout(400)
  const a = await mode(p)
  const seen = []
  await tapAt(p, p.locator('.ph-sp-nav button').nth(4))
  for (let k = 0; k < 40; k++) { seen.push(await p.evaluate(() => window.__phone.space.mode)); if (seen.at(-1) === 'rest' && k > 3) break; await p.waitForTimeout(100) }
  await p.waitForFunction(() => window.__phone.space.area === 4 && window.__phone.space.mode === 'rest', null, { timeout: 8000 })
  await p.screenshot({ path: `${OUT}/stills-station5.png` })
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('.ph-back').tap(); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 8000 })
  note('stills', { afterDoor: a, pickModes: [...new Set(seen)], videoElementsOn: (await mode(p)).videosOn, cover: await mode(p), errs, csp: await p.evaluate(() => window.__csp) })
  await ctx.close()
}
// 3. a cold link to the profile: the cover first, then the door; no entry page and no entrance
{
  const { ctx, p, errs } = await open({ path: '/projects/profile', seed: false })
  const first = await p.evaluate(() => ({ phase: window.__phone.phase, gate: !!document.querySelector('.gate, [class*="gate"]'), entering: document.querySelector('.ph-root').hasAttribute('data-entering'), url: location.pathname, stage: window.__phone.stage.current }))
  await waitMode(p, 'door', 15000).catch(() => {})
  const door = await mode(p)
  await waitMode(p, 'rest', 90000)
  note('cold', { first, door, end: await mode(p), url: await p.evaluate(() => location.pathname), errs })
  // 4a. on a cold route the way out (Esc) plays and lands on the cover at "/"
  const t1 = Date.now(); await p.keyboard.press('Escape'); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 20000 })
  note('cold exit', { escMs: Date.now() - t1, url: await p.evaluate(() => location.pathname), cover: (await mode(p)).current })
  // 5. the page goes to the background while a station plays: nothing plays there; it resumes
  await tapAt(p, p.locator('.ph-door')); await waitMode(p, 'station', 40000); await p.waitForTimeout(800)
  const playingBefore = await p.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length)
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  await p.waitForTimeout(500)
  const hiddenPlaying = await p.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length)
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await p.waitForTimeout(800)
  const backPlaying = await p.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length)
  // 6. a bfcache restore: the stage is re-synced; the station on screen is its still
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await p.waitForTimeout(1200)
  const after = await mode(p)
  note('background and bfcache', { playingBefore, hiddenPlaying, backPlaying, afterBfcache: after, errs, csp: await p.evaluate(() => window.__csp) })
  await ctx.close()
}
// 4. browser Back / Forward / Esc in a session that came from the cover
{
  const { ctx, p, errs } = await open({})
  await tapAt(p, p.locator('.ph-door')); await waitMode(p, 'station', 40000); await p.waitForTimeout(600)
  const t0 = Date.now(); await p.goBack(); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 8000 })
  const back = { ms: Date.now() - t0, ...(await mode(p)), url: await p.evaluate(() => location.pathname), clipsOn: await p.evaluate(() => [...document.querySelectorAll('video.on')].length), y: await p.evaluate(() => scrollY) }
  await p.goForward(); await p.waitForFunction(() => window.__phone.phase === 'space', null, { timeout: 8000 }); await waitMode(p, 'station', 40000)
  const fwd = await mode(p)
  const t1 = Date.now(); await p.keyboard.press('Escape'); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 20000 })
  note('history', { back, forwardReenters: fwd, escMs: Date.now() - t1, escUrl: await p.evaluate(() => location.pathname), errs, csp: await p.evaluate(() => window.__csp) })
  await ctx.close()
}
// 7. the jump to X-001: pick the station whose result opens it, play it to its result, tap "Open X-001"
{
  const { ctx, p, errs } = await open({})
  await tapAt(p, p.locator('.ph-door')); await waitMode(p, 'station', 40000)
  await p.waitForFunction(() => window.__phone.space.mode === 'rest', null, { timeout: 60000 })   // the tour ends on station 6
  let target = -1
  for (let i = 0; i < 6; i++) {
    await tapAt(p, p.locator('.ph-sp-nav button').nth(i)); await p.waitForFunction((i) => window.__phone.space.area === i && window.__phone.space.mode === 'rest', i, { timeout: 40000 })
    const go = await p.locator('.ph-sp-result .ph-sp-go').first().textContent().catch(() => '')
    if (/X-001/.test(go)) { target = i; break }
  }
  const t1 = Date.now()
  await p.evaluate(() => scrollTo(0, 0)); await tapAt(p, p.locator('.ph-sp-result .ph-sp-go').first())
  await p.waitForFunction(() => window.__phone.phase === 'file', null, { timeout: 30000 })
  note('jump X-001', { fromArea: target, ms: Date.now() - t1, openId: await p.evaluate(() => window.__phone.openId), url: await p.evaluate(() => location.pathname), errs, csp: await p.evaluate(() => window.__csp) })
  await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/jump-x001.png` })
  await ctx.close()
}
fs.writeFileSync(`${OUT}/modes.json`, JSON.stringify(R, null, 1))
await b.close()
