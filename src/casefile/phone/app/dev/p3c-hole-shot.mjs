// Before/after of the sheet's reserve for the result block, at the two widths, on a tall viewport (the layout of the sheet does not depend on the height): "before" is the same
// page with the reserve turned off (the block holds its own height), "after" is the page as built.   node p3c-hole-shot.mjs <outDir>
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'
const OUT = process.argv[2], BASE = 'http://127.0.0.1:4199'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const [W, H] of [[390, 664], [375, 548]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: 1000 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, bypassCSP: true })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  await p.goto(`${BASE}/?phone-app`, { waitUntil: 'load' }); await p.evaluate(() => localStorage.setItem('yw.entry', '1'))
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  await p.touchscreen.tap(W / 2, 300)
  const bb = await p.locator('.ph-door').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await p.waitForFunction(() => window.__phone.space?.mode === 'station', null, { timeout: 40000 })
  await p.evaluate(() => window.__phone.space.showFrame(0, 62)); await p.waitForFunction(() => window.__phone.space.mode === 'held'); await p.waitForTimeout(400)
  const clip = { x: 0, y: 420, width: W, height: 560 }
  await p.screenshot({ path: `${OUT}/sheet-after-${W}.png`, clip })
  await p.addStyleTag({ content: '.ph-sp-result[data-on="0"]{height:auto!important;overflow:visible!important}' }); await p.waitForTimeout(300)
  await p.screenshot({ path: `${OUT}/sheet-before-${W}.png`, clip })
  await ctx.close()
}
await b.close()
