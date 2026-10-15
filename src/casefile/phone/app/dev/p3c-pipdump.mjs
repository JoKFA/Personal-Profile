// Debug: at a held frame of a station, where are the chips' pips, and where do the baked anchors say they should be.
//   node p3c-pipdump.mjs <station 0-5> <frame> [--base=...]
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'
const [st, fr, ...rest] = process.argv.slice(2)
const BASE = (rest.find((x) => x.startsWith('--base=')) ?? '--base=http://127.0.0.1:4199').slice(7)
const W = 390, H = 664
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage(); p.setDefaultTimeout(60000)
await p.goto(`${BASE}/?phone-app`, { waitUntil: 'load' }); await p.evaluate(() => localStorage.setItem('yw.entry', '1'))
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
await p.touchscreen.tap(W / 2, H * 0.3)
const bb = await p.locator('.ph-door').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
await p.waitForFunction(() => window.__phone.space?.mode === 'station', null, { timeout: 40000 })
await p.evaluate(([i, f]) => window.__phone.space.showFrame(i, f), [+st, +fr])
await p.waitForFunction(() => window.__phone.space.mode === 'held', null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(200)
const r = await p.evaluate(() => {
  const s = window.__phone.space
  return { boxes: s.chips.boxes.map((c) => ({ chip: c.chip, anchor: [+c.anchor.x.toFixed(1), +c.anchor.y.toFixed(1)], op: c.opacity })), pips: [...document.querySelectorAll('.ph-sp-pip')].filter((e) => e.style.visibility !== 'hidden').map((e) => [+e.getAttribute('x') + 2.5, +e.getAttribute('y') + 2.5]), fit: s.host?.winFit?.() }
})
console.log(JSON.stringify(r))
await b.close()
