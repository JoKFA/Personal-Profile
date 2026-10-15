// Back during an open: the time from the Esc key (or the bar's Back) to the stop being on screen, over several runs, and a screencast of one for the 0.04 s strip.
// Runs against a production build (no hooks needed: the page is watched with its own listeners).
//   node p7-back.mjs <outDir> [--base=http://127.0.0.1:4209] [--runs=5] [--at=500]  (ms of the open clip played before Esc)
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4209'), RUNS = Number(flag('runs', 5)), AT = Number(flag('at', 500))
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const rows = []
for (let run = 0; run < RUNS; run++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* */ } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(BASE + '/')
  await p.getByRole('button', { name: /Open the profile/ }).waitFor({ timeout: 60000 })
  await p.locator('html:not(.ph-entry)').waitFor(); await p.waitForTimeout(800)
  await p.mouse.move(195, 400); await p.mouse.wheel(0, 500); await p.waitForTimeout(800); await p.waitForFunction(() => !document.querySelector('.ph-stage video.on'), null, { timeout: 15000 })   // (the pan clip has played out)
  const cdp = await ctx.newCDPSession(p); const shots = []
  cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
  if (run === 0) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 })
  await p.evaluate(() => {
    const w = window; w.__b = { t0: 0, seen: null, stillAt: null }
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.__b.t0) w.__b.t0 = e.timeStamp }, true)
    const tick = () => {
      const x = w.__b
      if (x.t0 && x.seen === null) {
        const still = document.querySelector('.ph-stage img[data-key="stop:X-001"]')
        const clips = [...document.querySelectorAll('.ph-stage video.on')].filter((v) => Number(getComputedStyle(v).opacity) > 0.02)
        const so = still ? Number(getComputedStyle(still).opacity) : 0
        if (so >= 0.99 && x.stillAt === null) x.stillAt = performance.now()   // the still is opaque under the clip
        if (so >= 0.99 && !clips.length) x.seen = performance.now()            // and the clip is gone
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await p.getByRole('button', { name: 'Open MCP Security Framework', exact: true }).click()
  // the open clip is playing, AT ms in (waiting for the file's view to be built first)
  await p.waitForFunction((at) => [...document.querySelectorAll('.ph-stage video.on')].some((v) => !v.paused && v.currentTime * 1000 > at), AT, { timeout: 30000, polling: 16 })
  await p.keyboard.press('Escape')
  await p.waitForFunction(() => window.__b.seen !== null, null, { timeout: 5000 })
  const r = await p.evaluate(() => ({ t0: window.__b.t0, still: window.__b.stillAt - window.__b.t0, gone: window.__b.seen - window.__b.t0, epoch: performance.timeOrigin + window.__b.t0, url: location.pathname, y: Math.round(scrollY) }))
  const closeClip = await p.evaluate(() => [...document.querySelectorAll('video')].some((v) => /close-/.test(v.getAttribute('src') ?? '') && (!v.paused || v.currentTime > 0)))
  rows.push({ run, stillOpaqueMs: +r.still.toFixed(0), clipGoneMs: +r.gone.toFixed(0), url: r.url, y: r.y, closeClip })
  console.log(JSON.stringify(rows.at(-1)))
  if (run === 0) {
    await p.waitForTimeout(600); await cdp.send('Page.stopScreencast')
    fs.rmSync(`${OUT}/screencast`, { recursive: true, force: true }); fs.mkdirSync(`${OUT}/screencast`, { recursive: true })
    shots.forEach((x, i) => fs.writeFileSync(`${OUT}/screencast/s-${String(i).padStart(4, '0')}-${x.ts.toFixed(4)}.jpg`, Buffer.from(x.data, 'base64')))
    fs.writeFileSync(`${OUT}/esc.json`, JSON.stringify({ epochMs: r.epoch }))
  }
  await ctx.close()
}
fs.writeFileSync(`${OUT}/back-timing.json`, JSON.stringify(rows, null, 1))
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
console.log('median: still opaque', med(rows.map((r) => r.stillOpaqueMs)), 'ms; clip gone', med(rows.map((r) => r.clipGoneMs)), 'ms; worst', Math.max(...rows.map((r) => r.clipGoneMs)))
await b.close()
