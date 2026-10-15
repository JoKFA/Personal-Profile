// P2 navigation-table flows (plan 2.6) on the dev server, Chrome mobile emulation, 390x664 DPR 3.
//   node src/casefile/phone/app/dev/flows.mjs <outDir> [--base=http://127.0.0.1:5194]
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:5194')
const W = 390, H = 664
const PHQ = (process.env.PHQ ?? '&phone-expose').slice(1)   // the test hooks the build exposes (a build made with VITE_HOOKS=1: see lib.mjs)
fs.mkdirSync(OUT, { recursive: true })
const R = {}
const st = (p) => p.evaluate(() => ({ phase: window.__phone.phase, at: window.__phone.at, y: Math.round(scrollY), url: location.pathname, ret: window.__phone.dom.reticle.style.opacity, handoffs: window.__phone.stage.handoffs.map((h) => h.clip + ':' + h.via) }))
const boot = async (url = `${BASE}/?phone-app&${PHQ}`, opts) => {
  const s = await launch(W, H, opts)
  await s.p.goto(url, { waitUntil: 'load' })
  await until(s.p, () => window.__phone && window.__phone.ready)
  return s
}

// 1. return visit: the paper rises over 0.4 s; the cover decrypts when it has risen
{
  const { b, p, errs } = await boot()
  const samples = []
  for (let i = 0; i < 12; i++) { samples.push(await p.evaluate(() => { const e = window.__phone.dom.panels.get('YW-000').el; return { t: Math.round(performance.now()), op: e.style.opacity || '1', tf: e.style.transform || 'none', plain: +window.__phone.page.plainOf('YW-000').toFixed(2) } })); await p.waitForTimeout(60) }
  R.returnVisit = { samples, errs }
  await b.close()
}
// 2. ticks: 00 -> 03 is one cross-fade to that stop (not a pan per section); then back to 00
{
  const { b, p, errs } = await boot()
  await p.waitForTimeout(1200)
  const t0 = Date.now()
  // (the cover's one-line panel has no ticks: go to 01 first, then jump 01 -> 03)
  await swipe(await p.context().newCDPSession(p), W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(800)
  await p.locator('#ph-s1 .ph-tick[data-stop="3"]').tap()
  await until(p, () => window.__phone.at === 3 && window.__phone.phase === 'settled')
  await p.waitForTimeout(900)
  R.tickTo03 = { ms: Date.now() - t0, ...(await st(p)), errs }
  await p.screenshot({ path: path.join(OUT, 'tick-03.png') })
  await p.locator('#ph-s3 .ph-tick[data-stop="0"]').tap()
  await until(p, () => window.__phone.at === 0 && window.__phone.phase === 'settled'); await p.waitForTimeout(600)
  R.tickBack00 = await st(p)
  await b.close()
}
// 3. Index / Contact scroll to the placeholder; the reticle leaves with the last stop
{
  const { b, p } = await boot()
  await p.waitForTimeout(1200)
  await p.locator('.ph-nav button[data-go="index"]').tap()
  await until(p, () => Math.abs(scrollY - 5 * innerHeight) < 2); await p.waitForTimeout(1500)
  R.indexButton = await st(p)
  await p.screenshot({ path: path.join(OUT, 'index-placeholder.png') })
  await b.close()
}
// 4. browser Back while a file is open: no close clip, the end state at once; Forward opens it again
{
  const { b, p, errs } = await boot()
  await p.waitForTimeout(1000)
  await swipe((await p.context().newCDPSession(p)), W, H)
  await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(700)
  await p.locator('.ph-go[data-id="X-001"]').tap()
  await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(400)
  R.beforeBack = await st(p)
  const t0 = Date.now()
  await p.goBack()
  await until(p, () => window.__phone.phase === 'settled' && window.__phone.at === 1)
  R.afterBack = { ms: Date.now() - t0, ...(await st(p)) }
  await p.screenshot({ path: path.join(OUT, 'after-browser-back.png') })
  R.afterBackFocus = await p.evaluate(() => document.activeElement?.className)
  await p.goForward()
  await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(300)
  R.afterForward = await st(p)
  R.errs4 = errs
  await b.close()
}
// 5. the in-app "← All files": the close clip plays, history agrees (URL back to "/", Forward available)
{
  const { b, p } = await boot()
  await p.waitForTimeout(1000)
  const cdp = await p.context().newCDPSession(p)
  await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(700)
  await p.locator('.ph-go[data-id="X-001"]').tap(); await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(300)
  const len0 = await p.evaluate(() => history.length)
  await p.locator('.ph-back').tap()
  await until(p, () => window.__phone.phase === 'closing')
  R.buttonClose = { duringClose: await st(p) }
  await until(p, () => window.__phone.phase === 'settled'); await p.waitForTimeout(300)
  R.buttonClose.after = await st(p)
  R.buttonClose.historyLen = [len0, await p.evaluate(() => history.length)]
  R.buttonClose.focus = await p.evaluate(() => document.activeElement?.className + ' ' + document.activeElement?.dataset.id)
  // Escape closes too
  await p.locator('.ph-go[data-id="X-001"]').tap(); await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(300)
  await p.keyboard.press('Escape'); await until(p, () => window.__phone.phase === 'settled'); R.escapeCloses = await st(p)
  await b.close()
}
// 6. cold /projects/:slug: the stop's picture, then the open clip, then the file; no entrance, no cover first
{
  const s = await launch(W, H)
  const { b, p } = s
  const t0 = Date.now()
  await p.goto(`${BASE}/projects/mcp-security-framework?${PHQ}`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready)
  const first = await st(p)
  await p.screenshot({ path: path.join(OUT, 'cold-start-stop.png') })
  await until(p, () => window.__phone.phase === 'file')
  R.coldStart = { first, readyToFileMs: Date.now() - t0, end: await st(p), plainAtStart: await p.evaluate(() => window.__phone.page.plainOf('X-001')) }
  await p.screenshot({ path: path.join(OUT, 'cold-start-file.png') })
  // an unknown slug and a routed file with no stop yet go back to "/" (the cover)
  await p.goto(`${BASE}/projects/telus-ai-hackathon?${PHQ}`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(500)
  R.coldNoStop = await st(p)
  await b.close()
}
// 7. landscape: a notice; rotating back resumes where it was (stop 1 open or not)
{
  const { b, p } = await boot()
  await p.waitForTimeout(1000)
  const cdp = await p.context().newCDPSession(p)
  await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(800)
  await p.setViewportSize({ width: H, height: W }); await p.waitForTimeout(600)
  R.landscape = { notice: await p.evaluate(() => ({ attr: document.querySelector('.ph-root').hasAttribute('data-land'), shown: getComputedStyle(document.querySelector('.ph-land')).display, text: document.querySelector('.ph-land').textContent })), ...(await st(p)) }
  await p.screenshot({ path: path.join(OUT, 'landscape.png') })
  await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(700)
  R.rotatedBack = { attr: await p.evaluate(() => document.querySelector('.ph-root').hasAttribute('data-land')), ...(await st(p)) }
  await p.screenshot({ path: path.join(OUT, 'rotated-back.png') })
  await b.close()
}
// 8. pageshow (bfcache restore): the shell re-syncs and keeps working
{
  const { b, p } = await boot()
  await p.waitForTimeout(1000)
  const cdp = await p.context().newCDPSession(p)
  await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await p.waitForTimeout(500)
  await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled')
  R.pageshow = await st(p)
  await b.close()
}
// 9. the first touch primes the pool; a touch-scroll interrupted halfway springs back to the same stop (no pan)
{
  const { b, p } = await boot()
  await p.waitForTimeout(1200)
  const cdp = await p.context().newCDPSession(p)
  await swipe(cdp, W, H, 'down', 0.3); await p.waitForTimeout(1500)
  R.shortSwipe = await st(p)
  await b.close()
}
fs.writeFileSync(path.join(OUT, 'flows.json'), JSON.stringify(R, null, 1))
console.log(JSON.stringify(R, null, 1))
