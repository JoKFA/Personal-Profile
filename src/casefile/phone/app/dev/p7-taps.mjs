// Two taps that must be answered at once, measured on a production build (no hooks: the page is watched by its own listeners).
//   pan:  Open tapped while the pan clip to that stop is still playing: tap -> the open clip's first frame (the pan is taken: 120 ms cross-fade to the stop, then the open)
//   back: the bar's `← All files` after the open tap: how soon it is there and tappable, that it never overlaps the tag, the name, the links or the label, and the Back tap taking the mid-open path
//   node p7-taps.mjs <pan|back> <outDir> [--base=http://127.0.0.1:4209] [--runs=5] [--size=390x664]
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const [MODE, OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4209'), RUNS = Number(flag('runs', 5)), [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const rows = []

for (let run = 0; run < RUNS; run++) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* */ } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(BASE + '/')
  await p.getByRole('button', { name: /Open the profile/ }).waitFor({ timeout: 60000 })
  await p.locator('html:not(.ph-entry)').waitFor(); await p.waitForTimeout(800)
  const cdp = await ctx.newCDPSession(p); const shots = []
  cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
  await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, 500)
  if (MODE === 'pan') {
    // the pan clip to stop 1 is playing; tap Open on that stop now (the scroll has snapped, the pan has not finished)
    await p.waitForFunction(() => [...document.querySelectorAll('.ph-stage video')].some((v) => /pan-/.test(v.getAttribute('src') ?? '') && !v.paused && v.currentTime > 0.5), null, { timeout: 15000, polling: 16 })
  } else {
    await p.waitForTimeout(800); await p.waitForFunction(() => !document.querySelector('.ph-stage video.on'), null, { timeout: 15000 })
  }
  const panClip = await p.evaluate(() => [...document.querySelectorAll('.ph-stage video')].filter((v) => /pan-/.test(v.getAttribute('src') ?? '') && !v.paused).length)
  await p.evaluate(() => {
    const w = window; w.__t = { tap: 0, back: [], openFrame: null, overlaps: [], backSeen: null, backHalf: null, urlAt: null, stillAt: null }
    const t = w.__t
    addEventListener('click', (e) => { if (!t.tap && e.target instanceof Element && e.target.closest('.ph-go')) t.tap = e.timeStamp }, true)
    const inter = (a, c) => a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top
    const tick = () => {
      if (t.tap) {
        const now = performance.now(), el = (s) => document.querySelector(s)
        const back = el('.ph-back'), cs = getComputedStyle(back), op = Number(cs.opacity), vis = cs.visibility === 'visible'
        if (t.urlAt === null && location.pathname.startsWith('/projects/')) t.urlAt = now
        if (t.backSeen === null && vis && op > 0.02) t.backSeen = now
        if (t.backHalf === null && vis && op >= 0.5) t.backHalf = now
        if (t.openFrame === null && location.pathname.startsWith('/projects/') && [...document.querySelectorAll('.ph-stage video')].some((v) => /open-/.test(v.getAttribute('src') ?? '') && !v.paused && v.currentTime > 0.001)) t.openFrame = now
        if (vis && op > 0.05) {
          const r = back.getBoundingClientRect()
          for (const [name, s] of [['tag', '.ph-tag'], ['brand', '.ph-brand'], ['nav', '.ph-nav'], ['label', '.ph-barfile']]) {
            const o = el(s); if (!o) continue
            const c = getComputedStyle(o); if (c.visibility === 'hidden' || Number(c.opacity) < 0.1) continue
            const rr = o.getBoundingClientRect(); if (rr.width && inter(r, rr)) t.overlaps.push([Math.round(now - t.tap), name, +Number(c.opacity).toFixed(2), +op.toFixed(2)])
          }
        }
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  if (run === 0) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  const open = p.getByRole('button', { name: /^Open MCP Security Framework$/ })
  const bb = await open.boundingBox()
  await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  let row
  if (MODE === 'pan') {
    await p.waitForFunction(() => window.__t.openFrame !== null, null, { timeout: 15000, polling: 16 })
    const r = await p.evaluate(() => ({ tapToOpenFrame: window.__t.openFrame - window.__t.tap, tapToUrl: window.__t.urlAt - window.__t.tap, epoch: performance.timeOrigin + window.__t.tap }))
    row = { run, panClipsPlayingAtTap: panClip, tapToOpenFrameMs: +r.tapToOpenFrame.toFixed(0), tapToUrlMs: +r.tapToUrl.toFixed(0), epoch: r.epoch, errs }
  } else {
    // the control is there within ~100 ms of the open tap: tap it as soon as it is on screen
    await p.waitForFunction(() => window.__t.backHalf !== null, null, { timeout: 5000, polling: 8 })
    const bk = await p.locator('.ph-back').boundingBox()
    await p.evaluate(() => { window.__t.backTap = null; addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('.ph-back')) window.__t.backTap = e.timeStamp }, true) })
    await p.touchscreen.tap(bk.x + bk.width / 2, bk.y + bk.height / 2)
    await p.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 })
    await p.waitForTimeout(600)
    const r = await p.evaluate(() => ({ t: window.__t, closeClip: [...document.querySelectorAll('video')].some((v) => /close-/.test(v.getAttribute('src') ?? '') && (!v.paused || v.currentTime > 0)), y: Math.round(scrollY), fm: document.documentElement.classList.contains('ph-filemode') }))
    row = { run, size: `${W}x${H}`, backVisibleMs: +(r.t.backSeen - r.t.tap).toFixed(0), backHalfMs: +(r.t.backHalf - r.t.tap).toFixed(0), backTapAfterOpenTapMs: +(r.t.backTap - r.t.tap).toFixed(0), overlaps: r.t.overlaps.slice(0, 6), overlapFrames: r.t.overlaps.length, closeClip: r.closeClip, urlBack: '/', y: r.y, fileMode: r.fm, epoch: performance.timeOrigin ? 0 : 0, errs }
    row.epoch = (await p.evaluate(() => performance.timeOrigin + window.__t.tap))
  }
  rows.push(row); console.log(JSON.stringify(row))
  if (run === 0) {
    await p.waitForTimeout(500); await cdp.send('Page.stopScreencast')
    fs.rmSync(`${OUT}/${MODE}-screencast`, { recursive: true, force: true }); fs.mkdirSync(`${OUT}/${MODE}-screencast`, { recursive: true })
    shots.forEach((x, i) => fs.writeFileSync(`${OUT}/${MODE}-screencast/s-${String(i).padStart(4, '0')}-${x.ts.toFixed(4)}.jpg`, Buffer.from(x.data, 'base64')))
    fs.writeFileSync(`${OUT}/${MODE}-tap.json`, JSON.stringify({ epochMs: row.epoch }))
  }
  await ctx.close()
}
fs.writeFileSync(`${OUT}/${MODE}-${W}x${H}.json`, JSON.stringify(rows, null, 1))
await b.close()
