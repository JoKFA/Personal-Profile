// A tap while a close clip is playing must be taken: Open on the stop the close is returning to -> the next open clip's first frame; and the other taps (a tick, an Index row after the Index's slide-back).
//   node p7-close.mjs <outDir> [--base=http://127.0.0.1:4209] [--runs=5] [--size=390x664]
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4209'), RUNS = Number(flag('runs', 5)), [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const rows = []
const boot = async () => {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* */ } })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(BASE + '/')
  await p.getByRole('button', { name: /Open the profile/ }).waitFor({ timeout: 60000 })
  await p.locator('html:not(.ph-entry)').waitFor(); await p.waitForTimeout(800)
  return { ctx, p, errs }
}
const tapEl = async (p, loc) => { const bb = await loc.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }
// the close is playing and the stop's Open is already there to be tapped (its row has come back in)
const openThere = (p) => p.waitForFunction(() => {
  const b = [...document.querySelectorAll('button.ph-go')].find((x) => x.getAttribute('aria-label') === 'Open MCP Security Framework'); if (!b) return false
  const r = b.getBoundingClientRect()
  if (!(r.width > 0 && Number(getComputedStyle(b.parentElement).opacity) > 0.3 && [...document.querySelectorAll('.ph-stage video')].some((v) => /close-/.test(v.getAttribute('src') ?? '') && !v.paused))) return false
  return [r.left + r.width / 2, r.top + r.height / 2]
}, null, { timeout: 20000, polling: 8 }).then((h) => h.jsonValue())

for (let run = 0; run < RUNS; run++) {
  const { ctx, p, errs } = await boot()
  const cdp = await ctx.newCDPSession(p); const shots = []
  cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
  await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, 500); await p.waitForTimeout(800)
  await p.waitForFunction(() => !document.querySelector('.ph-stage video.on'), null, { timeout: 15000 })
  await tapEl(p, p.getByRole('button', { name: /^Open MCP Security Framework$/ }))
  await p.waitForFunction(() => location.pathname.startsWith('/projects/'), null, { timeout: 5000 })
  await p.waitForTimeout(3800)   // the open has reached its window
  await p.evaluate(() => {
    const t = { tap: 0, url: null, frame: null }; window.__c = t
    t.armed = false
    addEventListener('click', (e) => { if (!t.tap && t.armed && e.isTrusted) t.tap = e.timeStamp }, true)   // (the touch's own click: the app's re-dispatch after taking the close is not trusted)
    const tick = () => {
      if (t.tap) {
        if (t.url === null && location.pathname.startsWith('/projects/')) t.url = performance.now()
        if (t.frame === null && t.url !== null && [...document.querySelectorAll('.ph-stage video')].some((v) => /open-/.test(v.getAttribute('src') ?? '') && !v.paused && v.currentTime > 0.001)) t.frame = performance.now()
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  if (run === 0) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  await tapEl(p, p.locator('.ph-back'))
  const [ox, oy] = await openThere(p)
  await p.evaluate(() => { window.__c.armed = true })
  await p.touchscreen.tap(ox, oy)   // the stop's Open, while the close is still playing
  const closeAtTap = await p.evaluate(() => ({ close: [...document.querySelectorAll('.ph-stage video')].filter((v) => /close-/.test(v.getAttribute('src') ?? '') && !v.paused).length, url: location.pathname }))
  await p.waitForFunction(() => window.__c.frame !== null, null, { timeout: 8000, polling: 16 }).catch(async () => { console.log('NO OPEN FRAME', JSON.stringify(await p.evaluate(() => ({ t: window.__c, url: location.pathname, fm: document.documentElement.classList.contains('ph-filemode') })))); process.exit(1) })
  const r = await p.evaluate(() => ({ toFrame: window.__c.frame - window.__c.tap, toUrl: window.__c.url - window.__c.tap, epoch: performance.timeOrigin + window.__c.tap }))
  const row = { run, closeAfterTap: closeAtTap, tapToOpenFrameMs: +r.toFrame.toFixed(0), tapToUrlMs: +r.toUrl.toFixed(0), epoch: r.epoch, errs }
  rows.push(row); console.log(JSON.stringify(row))
  if (run === 0) {
    await p.waitForTimeout(500); await cdp.send('Page.stopScreencast')
    fs.rmSync(`${OUT}/close-screencast`, { recursive: true, force: true }); fs.mkdirSync(`${OUT}/close-screencast`, { recursive: true })
    shots.forEach((x, i) => fs.writeFileSync(`${OUT}/close-screencast/s-${String(i).padStart(4, '0')}-${x.ts.toFixed(4)}.jpg`, Buffer.from(x.data, 'base64')))
    fs.writeFileSync(`${OUT}/close-tap.json`, JSON.stringify({ epochMs: row.epoch }))
  }
  await ctx.close()
}
// the other taps: a tick during a close (the cover is scrolled to), an Index row right after an Index entry's close (the sheet is sliding back)
{
  const { ctx, p, errs } = await boot()
  await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, 500); await p.waitForTimeout(800)
  await p.waitForFunction(() => !document.querySelector('.ph-stage video.on'), null, { timeout: 15000 })
  await tapEl(p, p.getByRole('button', { name: /^Open MCP Security Framework$/ }))
  await p.waitForFunction(() => location.pathname.startsWith('/projects/'), null, { timeout: 5000 })
  await p.waitForTimeout(3800)
  await tapEl(p, p.locator('.ph-back'))
  await p.waitForFunction(() => {
    const g = [...document.querySelectorAll('button.ph-go')].find((x) => x.getAttribute('aria-label') === 'Open MCP Security Framework'); const t = g && g.parentElement.querySelector('.ph-tick[data-stop="0"]'); if (!t) return false
    const r = t.getBoundingClientRect(); return r.width > 0 && Number(getComputedStyle(g.parentElement).opacity) > 0.5 && [...document.querySelectorAll('.ph-stage video')].some((v) => /close-/.test(v.getAttribute('src') ?? '') && !v.paused)
  }, null, { timeout: 20000, polling: 8 })
  const tk = await p.evaluate(() => { const g = [...document.querySelectorAll('button.ph-go')].find((x) => x.getAttribute('aria-label') === 'Open MCP Security Framework'); const r = g.parentElement.querySelector('.ph-tick[data-stop="0"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
  const t0 = Date.now()
  await p.touchscreen.tap(tk[0], tk[1])
  await p.waitForFunction(() => !document.documentElement.classList.contains('ph-filemode') && scrollY < 2, null, { timeout: 8000 })
  console.log('tick (to the profile) tapped during a close -> at the cover in', Date.now() - t0, 'ms; url', await p.evaluate(() => location.pathname), 'errors', JSON.stringify(errs))
  await ctx.close()
}
{
  const { ctx, p, errs } = await boot()
  await p.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Index' }).click()
  const row = p.locator('button.ph-ix[data-id="X-002"]'); await row.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200)
  await tapEl(p, row); await p.waitForFunction(() => location.pathname.startsWith('/projects/'), null, { timeout: 5000 })
  await p.waitForTimeout(3800)
  await tapEl(p, p.locator('.ph-back'))
  await p.waitForFunction(() => location.pathname === '/', null, { timeout: 5000 })
  await p.waitForFunction(() => !document.documentElement.classList.contains('ph-filemode'), null, { timeout: 8000, polling: 8 })   // the close is over: the Index sheet is on its way back
  const seen = await p.evaluate(() => ({ sheetSlide: getComputedStyle(document.querySelector('.ph-index')).translate }))
  const t1 = Date.now()
  await p.evaluate(() => document.querySelector('button.ph-ix[data-id="X-002"]').click())   // (a click on the row now, wherever the sliding sheet has it: the shell's answer is what is looked at)
  await p.waitForFunction(() => location.pathname.startsWith('/projects/'), null, { timeout: 8000 })
  console.log('an Index row tapped', JSON.stringify(seen), 'after the close ended (sheet mid-slide) -> file URL in', Date.now() - t1, 'ms', 'errors', JSON.stringify(errs))
  await p.waitForTimeout(4000)
  console.log('and it opened:', await p.evaluate(() => document.documentElement.classList.contains('ph-filemode')))
  await ctx.close()
}
fs.writeFileSync(`${OUT}/close-${W}x${H}.json`, JSON.stringify(rows, null, 1))
await b.close()
