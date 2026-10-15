// Debug: what is on screen, frame by frame, at one clip-to-clip seam of the interior (state of every video element and still, per animation frame).
//   node p3c-seam.mjs [--base=http://127.0.0.1:4199] [--from=intro] [--to=station]
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'
const rest = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4199'), FROM = flag('from', 'intro'), TO = flag('to', 'station')
const W = 390, H = 664
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage(); p.setDefaultTimeout(60000)
await p.goto(`${BASE}/?phone-app`, { waitUntil: 'load' }); await p.evaluate(() => localStorage.setItem('yw.entry', '1'))
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
await p.touchscreen.tap(W / 2, H * 0.3)
await p.evaluate(() => {
  window.__log = []; let last = ''
  const stage = document.querySelector('.ph-stage') || document.body
  const tick = () => {
    const vs = [...document.querySelectorAll('video.ph-vid')].map((v, i) => `${i}:${(v.dataset.key || '').slice(0, 9)}|${v.className.replace('ph-vid', '').trim()}|op${getComputedStyle(v).opacity}|vis${getComputedStyle(v).visibility[0]}|t${v.currentTime.toFixed(2)}`)
    const ims = [...document.querySelectorAll('.ph-still, img.ph-img, .ph-stage img')].filter((e) => +getComputedStyle(e).opacity > 0.01).map((e) => `${(e.dataset.key || e.alt || e.className).toString().slice(0, 14)}@${(+getComputedStyle(e).opacity).toFixed(2)}`)
    const s = `${window.__phone.space?.mode}  ${vs.join('  ')}  stills[${ims.join(',')}]`
    if (s !== last) { window.__log.push([((performance.timeOrigin + performance.now()) / 1000).toFixed(3), s]); last = s }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
const cdp = await ctx.newCDPSession(p); const shots = []
cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
const bb = await p.locator('.ph-door').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
await p.waitForFunction(() => window.__phone.space?.mode === 'station', null, { timeout: 40000 }); await p.waitForTimeout(700)
const log = await p.evaluate(() => window.__log)
await cdp.send('Page.stopScreencast')
const OUT = flag('out', 'seam-frames'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })
shots.forEach((x, i) => fs.writeFileSync(`${OUT}/s-${String(i).padStart(4, '0')}-${x.ts.toFixed(3)}.jpg`, Buffer.from(x.data, 'base64')))
// print the entries around the first 'station' entry
const i0 = log.findIndex(([, s]) => s.startsWith('station'))
for (const [t, s] of log.slice(Math.max(0, i0 - 8), i0 + 14)) console.log(t, s)
await b.close()
