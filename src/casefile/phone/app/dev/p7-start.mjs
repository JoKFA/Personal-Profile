// The first frames of a pan (a wheel notch to the next stop) and of an open (a tap on Open), as a screencast, for the 0.04 s strips: is the still going out over a clip that is already moving?
//   node p7-start.mjs <label> <base> <outDir> [--size=390x664]      (writes <outDir>/<label>-pan, -open and -close: screencast frames and the epoch of the input)
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const [LABEL, BASE, OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* */ } })
const p = await ctx.newPage(); p.setDefaultTimeout(60000)
await p.goto(BASE + '/')
await p.getByRole('button', { name: /Open the profile/ }).waitFor({ timeout: 60000 })
await p.locator('html:not(.ph-entry)').waitFor(); await p.waitForTimeout(1500)
const cdp = await ctx.newCDPSession(p); let shots = []
cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
const save = (name, epoch) => {
  const d = `${OUT}/${LABEL}-${name}`; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true })
  shots.forEach((x, i) => fs.writeFileSync(`${d}/s-${String(i).padStart(4, '0')}-${x.ts.toFixed(4)}.jpg`, Buffer.from(x.data, 'base64')))
  fs.writeFileSync(`${d}/input.json`, JSON.stringify({ epochMs: epoch }))
}
// a pan: the first notch, cover -> stop 1
await p.mouse.move(W / 2, H / 2)
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await p.waitForTimeout(300); shots = []
const e1 = await p.evaluate(() => performance.timeOrigin + performance.now())
await p.mouse.wheel(0, 500)
await p.waitForTimeout(1800); await cdp.send('Page.stopScreencast'); save('pan', e1)
await p.waitForFunction(() => !document.querySelector('.ph-stage video.on'), null, { timeout: 20000 })
await p.waitForTimeout(800)
// an open: the tap on Open of stop 1
const open = p.getByRole('button', { name: /^Open MCP Security Framework$/ }); const bb = await open.boundingBox()
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await p.waitForTimeout(300); shots = []
const e2 = await p.evaluate(() => performance.timeOrigin + performance.now())
await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
await p.waitForTimeout(1500); await cdp.send('Page.stopScreencast'); save('open', e2)
await p.waitForTimeout(3800)   // the open has reached its window
// a close: the tap on `← All files`
const bk = await p.locator('.ph-back').boundingBox()
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await p.waitForTimeout(300); shots = []
const e3 = await p.evaluate(() => performance.timeOrigin + performance.now())
await p.touchscreen.tap(bk.x + bk.width / 2, bk.y + bk.height / 2)
await p.waitForTimeout(1500); await cdp.send('Page.stopScreencast'); save('close', e3)
await b.close()
