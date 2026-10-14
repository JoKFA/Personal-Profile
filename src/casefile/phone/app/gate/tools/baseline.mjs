// The desktop Gate at phone sizes (no phone shell, no hold): where the readings and the sentence sit in the layout the phone is meant to match.
import { chromium } from '@playwright/test'
const BASE = process.argv[2] ?? 'http://127.0.0.1:4196'
const out = []
for (const [W, H] of [[375, 548], [390, 664], [360, 640], [390, 750], [430, 740], [412, 780], [412, 860]]) {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage()
  await p.goto(`${BASE}/?intro`, { waitUntil: 'load' })
  await p.waitForFunction(() => { const e = document.querySelector('.fp-cap2'); return e && getComputedStyle(e).opacity === '1' }, undefined, { polling: 16, timeout: 20000 })
  await p.evaluate(async () => { await document.fonts.ready; dispatchEvent(new Event('resize')) }); await p.waitForTimeout(900)
  const r = await p.evaluate(() => {
    const vis = (e) => { const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 }
    const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)] }
    const g = document.querySelector('.gate'), pr = g.dataset.print.split(',').map(Number)
    return { print: [pr[2], pr[3]], printBottom: pr[1] + pr[3], mi: [...g.querySelectorAll('.fp-mi')].filter(vis).map(R), cap: [...g.querySelectorAll('.fp-cap')].filter(vis).map(R) }
  })
  out.push({ size: `${W}x${H}`, ...r }); await b.close()
}
console.log(JSON.stringify(out))
