// P3c flows, real taps, real time, Chrome mobile emulation: the tour, a pick, a mid-sequence pick, a step seek, pause/read/resume, replay, the exit,
// a later visit, the jump to a file.
//   node p3c-flows.mjs <outDir> [--base=http://127.0.0.1:4199] [--size=390x664] [--shots] [--screencast] [--only=tour,pick,seek,exit,jump] [--reject]
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4199'), [W, H] = flag('size', '390x664').split('x').map(Number), ONLY = flag('only', '').split(',').filter(Boolean)
const SHOTS = rest.includes('--shots'), SCREENCAST = rest.includes('--screencast'), REJECT = rest.includes('--reject'), STAGEONLY = rest.includes('--stageonly'), PIPS = rest.includes('--pips'), REDUCED = rest.includes('--reduced')
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: GPU })
// (the stage-only and pips-only runs inject a style sheet for the scans, so the page's CSP is bypassed there; every other run keeps it)
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, bypassCSP: STAGEONLY || PIPS, reducedMotion: REDUCED ? 'reduce' : 'no-preference' })
const p = await ctx.newPage(); p.setDefaultTimeout(90000)
const errs = []
p.on('pageerror', (e) => errs.push('pageerror ' + e)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console.error ' + m.text()) })
const cdp = await ctx.newCDPSession(p)
await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)) })
const shots = []
if (SCREENCAST) cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
const R = { size: [W, H], steps: [] }
const T0 = Date.now()
R.t0 = T0
const note = (name, extra = {}) => { const o = { t: +((Date.now() - T0) / 1000).toFixed(2), name, ...extra }; R.steps.push(o); console.log(JSON.stringify(o)) }
const sp = (fn, arg) => p.evaluate(fn, arg)
const state = () => sp(() => { const s = window.__phone.space; return s ? { phase: window.__phone.phase, mode: s.mode, area: s.area, ui: { step: s.state.step, playing: s.state.playing, reason: s.state.reason, count: s.state.count, result: s.state.result, live: s.state.live, tour: s.state.tour, travelling: s.state.travelling }, y: Math.round(scrollY) } : { phase: window.__phone.phase } })
const waitMode = (mode, area, ms = 60000) => p.waitForFunction(([m, a]) => { const s = window.__phone.space; return s && s.mode === m && (a === undefined || s.area === a) }, [mode, area], { timeout: ms })
const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `${OUT}/${n}.png` }) }
const should = (name) => !ONLY.length || ONLY.includes(name)
const finish = async () => {
  R.csp = await sp(() => window.__csp); R.errs = errs
  fs.writeFileSync(`${OUT}/flows.json`, JSON.stringify(R, null, 1))
  if (SCREENCAST) {
    await cdp.send('Page.stopScreencast')
    const d = `${OUT}/screencast`; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true })
    shots.forEach((s, i) => fs.writeFileSync(`${d}/s-${String(i).padStart(4, '0')}-${s.ts.toFixed(4)}.jpg`, Buffer.from(s.data, 'base64')))
  }
  console.log('errs', errs, 'csp', R.csp)
  await b.close()
  process.exit(0)
}

await p.goto(`${BASE}/?phone-app&phone-expose${REJECT ? '&phone-reject' : ''}`, { waitUntil: 'load' })
await p.evaluate(() => localStorage.setItem('yw.entry', '1')).catch(() => {})
await p.reload({ waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
await p.touchscreen.tap(W / 2, H * 0.3)   // (a first touch primes the pool, like any first touch)
if (STAGEONLY) await p.addStyleTag({ content: '.ph-reel, .ph-bar, .ph-reticle, .ph-space, .ph-sp-chips, .ph-sp-trail { opacity: 0 !important }' })
if (PIPS) await p.addStyleTag({ content: '.ph-reel, .ph-bar, .ph-reticle, .ph-space, .ph-sp-chip, .ph-sp-leader, .ph-sp-trail { opacity: 0 !important } .ph-sp-pip { opacity: 1 !important }' })
R.screencastStart = Date.now()
if (SCREENCAST) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W, maxHeight: H, everyNthFrame: 1 })

const tapAt = async (l) => { await l.scrollIntoViewIfNeeded(); const bb = await l.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }
const tapDoor = () => tapAt(p.locator('.ph-door'))
const tapNav = (i) => tapAt(p.locator('.ph-sp-nav button').nth(i))
const tapStep = (n) => tapAt(p.locator('.ph-sp-steps button').nth(n))
const tapBtn = (sel, text) => tapAt(p.locator(sel, { hasText: text }).first())
const top = () => sp(() => scrollTo(0, 0))

// 1. the first visit: the cover's panel, the door, the intro, the tour, stopping on station 6's result
note('start', await state())
await tapDoor(); note('tap door')
await waitMode('door', undefined, 10000); await p.waitForTimeout(600); await shot('01-door')
await p.waitForFunction(() => window.__phone.space.mode === 'intro', null, { timeout: 15000 }); note('intro', await state())
await waitMode('station', 0, 20000); note('station 1', await state()); await shot('02-station1')
if (should('tour')) {
  for (let i = 1; i < 6; i++) { await waitMode('fly', undefined, 30000); await waitMode('station', i, 30000); note(`station ${i + 1}`, await state()); if (i === 2) await shot('03-station3') }
  await waitMode('rest', 5, 30000); await p.waitForTimeout(500); note('tour end (rest 6)', await state()); await shot('04-tour-end')
} else if (should('pick') || should('seek') || should('exit') || should('jump')) {
  await p.waitForFunction(() => window.__phone.space.mode === 'rest', null, { timeout: 90000 })
} else await finish()

// 2. a pick from the result: out + in + station, stopping on its result; then a pick in the middle of a sequence
if (should('pick')) {
  await top(); await tapNav(1); note('pick 2 (from the result)')
  await waitMode('hub', undefined, 8000); note('hub', await state()); await shot('05-hub')
  await waitMode('station', 1, 12000); note('station 2 (picked)', await state())
  await p.waitForTimeout(1800)
  await tapNav(3); note('pick 4 (mid-sequence)', await state())
  await waitMode('hub', undefined, 8000); await waitMode('station', 3, 12000); await waitMode('rest', 3, 12000); await p.waitForTimeout(400); note('rest 4', await state())
}
// 3. a step dot seeks and holds; reading pauses; Resume goes on
if (should('seek')) {
  await top(); await tapStep(2); await p.waitForFunction(() => window.__phone.space.mode === 'held', null, { timeout: 6000 }); await p.waitForTimeout(500); note('step 3 held', await state()); await shot('06-step3')
  await tapStep(3); await p.waitForTimeout(800); note('step 4 held', await state())
  await tapBtn('.ph-sp-ctl button', 'Replay'); await p.waitForTimeout(1500); note('replay running', await state())
  await sp(() => scrollTo(0, 360)); await p.waitForTimeout(700); note('reading', await state()); await shot('07-reading')
  await top(); await p.waitForTimeout(300)
  await tapBtn('.ph-sp-ctl button', 'Resume'); await p.waitForTimeout(900); note('resumed', await state())
}
// 4. the exit: back to the cover
if (should('exit')) {
  await top(); const t0 = Date.now()
  await p.locator('.ph-back').tap(); note('back tapped', await state())
  await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 20000 }); note('cover again', { ms: Date.now() - t0, ...(await state()) })
  await p.waitForTimeout(1200); await shot('08-cover-again')
  note('cover text', await sp(() => ({ plain: +window.__phone.page.plainOf('YW-000').toFixed(2), y: scrollY, url: location.pathname, focus: document.activeElement?.className })))
}
// 5. a later visit returns to the last station and plays it in full; Open X-... leaves at 1.5x and opens the file
if (should('jump')) {
  if (await sp(() => window.__phone.phase) !== 'settled') { await top(); await p.locator('.ph-back').tap(); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 20000 }); await p.waitForTimeout(1500) }
  await tapDoor(); await waitMode('door', undefined, 8000); await waitMode('station', undefined, 40000); note('later visit', await state())
  await waitMode('rest', undefined, 20000); await p.waitForTimeout(500); note('later visit rest', await state())
  const area = await sp(() => window.__phone.space.area)
  await top(); const t1 = Date.now()
  await tapAt(p.locator('.ph-sp-result .ph-sp-go').first()); note('Open tapped', { area })
  await p.waitForFunction(() => window.__phone.phase === 'file', null, { timeout: 30000 }); note('file open', { ms: Date.now() - t1, openId: await sp(() => window.__phone.openId), url: await sp(() => location.pathname) }); await p.waitForTimeout(900); await shot('09-jump-file')
  await p.locator('.ph-back').tap(); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 20000 }); await p.waitForTimeout(1500)
  note('cover after the file', await sp(() => ({ slide: window.__phone.page.slide, plain: +window.__phone.page.plainOf('YW-000').toFixed(2), y: scrollY })))
}
await finish()
