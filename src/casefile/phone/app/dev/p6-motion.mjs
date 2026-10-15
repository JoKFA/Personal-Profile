// P6b: long tasks during motion. The whole motion path of the phone shell at 4x CPU throttle (hooks build for the state it reads; the code is the production build's):
//   entrance (seal -> cover, the paper rise) -> four pans -> three opens and closes (tap -> window settled, and back) -> the Index slide, an open from it and its return, Contact
//   -> the door -> the interior (intro, a station, a flight, a pick) -> the exit.
// Every task over 50 ms is listed with the step it fell in. A step is "motion" while anything on screen animates (from the action to 300 ms after the state settles), "rest" otherwise.
//   Budget: motion 50 ms, rest 100 ms (the first script evaluation before the entry page is excluded and reported on its own).
//   node p6-motion.mjs <outFile.json> [--hooks=http://127.0.0.1:4196] [--rate=4] [--size=390x664]
import fs from 'node:fs'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const HOOKS = flag('hooks', 'http://127.0.0.1:4196'), RATE = Number(flag('rate', 4)), [W, H] = flag('size', '390x664').split('x').map(Number)
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const { b, p, cdp, errs } = await launch(W, H, { gate: true })
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
await p.addInitScript(() => {
  const P = window.__m = { long: [], frames: [], steps: [], cur: null, state: [] }
  new PerformanceObserver((l) => { for (const e of l.getEntries()) P.long.push({ at: e.startTime, ms: e.duration, step: null }) }).observe({ type: 'longtask', buffered: true })
  let last = 0
  const f = (t) => {
    if (last && t - last > 50) P.frames.push({ at: Math.round(t), dt: Math.round(t - last), step: P.cur?.name })
    last = t
    const ph = window.__phone
    if (ph && P.state.length < 40000) P.state.push([Math.round(t), ph.phase, ph.busy ? 1 : 0, ph.space?.mode ?? ''])
    requestAnimationFrame(f)
  }
  requestAnimationFrame(f)
  window.__step = (name, motion) => { const t = performance.now(); if (P.cur) P.cur.end = t; P.cur = { name, motion, start: t, end: null }; P.steps.push(P.cur) }
})
const step = (name, motion) => p.evaluate(([n, m]) => window.__step(n, m), [name, motion])
const settle = (ms = 300) => p.waitForTimeout(ms)
const mode = (m, ms = 90000) => p.waitForFunction((m) => { const s = window.__phone.space; return s && m.includes(s.mode) }, m, { timeout: ms })
const tapAt = async (l) => { await l.scrollIntoViewIfNeeded(); const bb = await l.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }

await p.goto(`${HOOKS}/?phone-app&phone-expose`, { waitUntil: 'load' })
await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1500)
const gateReady = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const L = window.__m.long.filter((x) => x.at < performance.now()).map((x) => [Math.round(x.at), Math.round(x.ms)]); return { gateReadyAt: Math.round(performance.now() - 1500), domContentLoaded: Math.round(n.domContentLoadedEventEnd), loadEnd: Math.round(n.loadEventEnd), longBeforeGate: L } })
await step('gate rest', false)
const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
await touch(cdp, 'touchStart', px + pw / 2, py + ph / 2)
await step('entry: hold (read, profile, seal)', true)
await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0)
await step('entrance: seal -> cover, the paper rise', true); await touch(cdp, 'touchEnd')
await until(p, () => window.__phone.entry.coverAt > 0, undefined, 120000); await settle(1500)
await step('cover rest', false); await settle(2500)
for (let i = 1; i <= 4; i++) {
  await step(`pan to stop 0${i}`, true); await swipe(cdp, W, H); await until(p, (n) => window.__phone.at === n && window.__phone.phase === 'settled', i, 120000); await settle(400)
  await step(`rest at stop 0${i}`, false); await settle(2500)
}
const opens = ['X-004', 'SR-01', 'ED-02']
for (const id of opens) {
  await step(`open ${id}: tap -> window settled`, true)
  await p.evaluate((id) => window.__phone.openEntry(id), id); await until(p, () => window.__phone.phase === 'file', undefined, 120000); await settle(300)
  await step(`file ${id}: window rest`, false); await settle(1500)
  await step(`file ${id}: read (scroll)`, true)
  const total = await p.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y + H < total; y += Math.round(H * 0.5)) { await p.evaluate((y) => scrollTo(0, y), y); await settle(500) }
  await p.evaluate(() => scrollTo(0, 0)); await settle(300)
  await step(`close ${id}: back -> stop`, true)
  await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 120000); await settle(300)
  await step(`rest after ${id}`, false); await settle(2000)
}
// the Index
await step('Index: slide in', true); await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H, 60000); await settle(500)
await step('Index: rest', false); await settle(1500)
await step('Index: open a row -> window settled', true)
await p.evaluate(() => { const r = document.querySelector('.ph-ix[data-id="X-005"]'); r.click() }); await until(p, () => window.__phone.phase === 'file', undefined, 120000); await settle(300)
await step('Index file: window rest', false); await settle(1500)
await step('Index file: back -> sheet slides in', true)
await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 120000); await settle(600)
await step('Index: rest 2', false); await settle(1500)
await step('Contact: slide', true); await p.locator('.ph-navb[data-go="contact"]').tap(); await settle(1800)
await step('contact rest', false); await settle(800)
// the door and the interior
await step('back to the cover', true); await p.evaluate(() => window.__phone.goTo(0)); await until(p, () => window.__phone.at === 0 && window.__phone.phase === 'settled'); await settle(1200)
await step('cover rest 2', false); await settle(1500)
await step('door: tap -> intro', true); await tapAt(p.locator('.ph-door')); await mode(['door'], 15000); await mode(['intro'], 60000)
await step('interior: intro -> station 1', true); await mode(['station', 'rest'], 120000); await settle(600)
await step('interior: station 1 -> flight -> station 2', true); await mode(['fly'], 120000); await mode(['station'], 120000); await settle(800)
await step('interior: rest (a result)', false); await mode(['rest'], 120000); await settle(1500)
await step('interior: a pick (hub -> station)', true)
await p.evaluate(() => scrollTo({ top: 420, behavior: 'instant' })); await settle(300)
await tapAt(p.locator('.ph-sp-nav button').nth(3)); await mode(['hub'], 15000); await mode(['station'], 60000); await mode(['rest'], 60000); await settle(500)
await step('interior: rest after the pick', false); await settle(1500)
await step('interior: exit to the cover', true); await p.evaluate(() => scrollTo(0, 0)); await p.locator('.ph-back').tap()
await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 60000 }); await settle(800)
await step('end', false)
const R = await p.evaluate(() => { const P = window.__m; if (P.cur) P.cur.end = performance.now(); return { long: P.long, steps: P.steps, frames: P.frames } })
// assign each long task to the step it started in; a task is judged on its own duration
const stepAt = (t) => R.steps.find((s) => t >= s.start && (s.end == null || t < s.end))
const long = R.long.filter((x) => x.at > gateReady.gateReadyAt).map((x) => { const s = stepAt(x.at); return { at: Math.round(x.at), ms: Math.round(x.ms), step: s?.name ?? '?', motion: !!s?.motion } })
const table = R.steps.map((s) => { const L = long.filter((x) => x.step === s.name); return { step: s.name, motion: !!s.motion, ms: Math.round((s.end ?? s.start) - s.start), tasks: L.length, maxMs: L.reduce((a, x) => Math.max(a, x.ms), 0), list: L.map((x) => x.ms) } })
const over = (m) => long.filter((x) => (m ? x.motion && x.ms > 50 : !x.motion && x.ms > 100))
const rep = { rate: RATE, size: `${W}x${H}`, gateReady, motionBudgetMs: 50, restBudgetMs: 100, motionTasksOver50: over(true).length, restTasksOver100: over(false).length, motionMax: Math.max(0, ...long.filter((x) => x.motion).map((x) => x.ms)), restMax: Math.max(0, ...long.filter((x) => !x.motion).map((x) => x.ms)), table, long, slowFrames: R.frames.filter((f) => f.step).length, errs }
fs.writeFileSync(OUT, JSON.stringify(rep, null, 1))
console.log(`gate interactive at ${gateReady.gateReadyAt} ms (DCL ${gateReady.domContentLoaded}, load ${gateReady.loadEnd}); long before gate: ${JSON.stringify(gateReady.longBeforeGate)}`)
for (const t of table) console.log(`${t.motion ? 'M' : 'R'} ${t.step.padEnd(52)} ${String(t.ms).padStart(6)} ms  tasks>50: ${String(t.tasks).padStart(2)}  max ${String(t.maxMs).padStart(4)}  ${t.list.join(',')}`)
console.log(`motion: ${rep.motionTasksOver50} tasks over 50 ms (max ${rep.motionMax}); rest: ${rep.restTasksOver100} over 100 ms (max ${rep.restMax}); frames over 50 ms in steps: ${rep.slowFrames}; errors ${errs.length}`)
await b.close()
