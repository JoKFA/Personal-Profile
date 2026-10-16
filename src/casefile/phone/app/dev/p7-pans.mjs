// Every pan of the reel plays as a clip: both directions of all four hops, in order and in random order (fast back-and-forth swipes included), and none falls back to the cross-fade
// (a fallback shows the two stops double-exposed for 1.15 s). Needs a build with the test hooks (the stage's records): node scripts/e2e-hooks-server.mjs 4210 dist-hooks
//   node p7-pans.mjs <outDir> [--base=http://127.0.0.1:4210] [--pans=40] [--seed=1]
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4210'), PANS = Number(flag('pans', 40)); let seed = Number(flag('seed', 1))
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* */ } })
const p = await ctx.newPage(); p.setDefaultTimeout(60000)
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(BASE + '/?phone-expose')
await p.waitForFunction(() => window.__phone && window.__phone.ready, null, { timeout: 60000 })
await p.getByRole('button', { name: /Open the profile/ }).waitFor({ timeout: 60000 })
await p.locator('html:not(.ph-entry)').waitFor(); await p.waitForTimeout(1500)
await p.mouse.move(195, 300)
const state = () => p.evaluate(() => ({ at: window.__phone.at, want: window.__phone.want, phase: window.__phone.phase }))
const wheel = async (dir) => { await p.mouse.wheel(0, dir * 500) }
const settle = () => p.waitForFunction(() => window.__phone.phase === 'settled' && !window.__phone.busy && window.__phone.at === window.__phone.want, null, { timeout: 20000 })
// 1. the sweep: 0 -> 4 and back, twice, each pan allowed to finish
for (let rep = 0; rep < 2; rep++) {
  for (let k = 0; k < 4; k++) { await wheel(1); await settle(); await p.waitForTimeout(250) }
  for (let k = 0; k < 4; k++) { await wheel(-1); await settle(); await p.waitForTimeout(250) }
}
const afterSweep = await p.evaluate(() => window.__phone.stage.handoffs.length)
// 2. the random walk: one hop at a time (so that every hop is an adjacent pan), waits from 120 ms (a fast reversal, while the pan is still playing) to 1.6 s
let at = 0, hops = 0
while (hops < PANS) {
  const dir = at === 0 ? 1 : at === 4 ? -1 : (rnd() < 0.5 ? -1 : 1)
  await wheel(dir); at += dir; hops++
  await p.waitForTimeout(rnd() < 0.4 ? 120 + rnd() * 200 : 500 + rnd() * 1100)
  const s = await state(); at = Math.max(0, Math.min(4, s.want))
}
await settle()
const out = await p.evaluate(() => ({
  handoffs: window.__phone.stage.handoffs.map((h) => ({ clip: h.clip, via: h.via, ms: Math.round(h.endAt - h.playAt), lat: Math.round(h.latencyMs) })),
  fades: window.__phone.stage.fades, rejects: window.__phone.stage.rejects,
}))
const pans = out.handoffs.filter((h) => /^pan:/.test(h.clip))
const fallbacks = pans.filter((h) => h.via === 'fade')
const keys = [...new Set(pans.filter((h) => h.via === 'clip').map((h) => h.clip))].sort()
const lat = pans.filter((h) => h.via === 'clip').map((h) => h.lat).sort((x, y) => x - y)
const res = { latencyMsMedianP90: [lat[Math.floor(lat.length / 2)], lat[Math.floor(lat.length * 0.9)]], sweepHandoffs: afterSweep, panHandoffs: pans.length, playedAsClips: pans.length - fallbacks.length, fadeFallbacks: fallbacks.map((h) => h.clip), distinctPanClipsPlayed: keys.length, keys, nonPanFades: out.handoffs.filter((h) => h.via === 'fade' && !/^pan:/.test(h.clip)).length, errs }
console.log(JSON.stringify(res, null, 1))
fs.writeFileSync(`${OUT}/pans-${PANS}.json`, JSON.stringify(res, null, 1))
await b.close()
