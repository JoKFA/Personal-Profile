// The interior at the seven test sizes: for every station and several frames of it (held, deterministic) no chip may leave the region, sit under the bar,
// reach the sheet, overlap another chip, or cover any text. Screenshots of a few frames at every size.
//   node p3c-sizes.mjs <outDir> [--base=http://127.0.0.1:4199] [--sizes=375x548,390x664,...]
import fs from 'node:fs'
import { chromium } from '@playwright/test'
import { until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4199')
const SIZES = flag('sizes', '375x548,390x664,390x750,430x740,360x640,412x780,412x860').split(',').map((s) => s.split('x').map(Number))
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', args: GPU })
const all = []
for (const [W, H] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)) })
  const p = await ctx.newPage(); p.setDefaultTimeout(60000)
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await p.evaluate(() => localStorage.setItem('yw.entry', '1')); await p.reload({ waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  await p.touchscreen.tap(W / 2, H * 0.3)
  const bb = await p.locator('.ph-door').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await p.waitForFunction(() => window.__phone.space?.mode === 'station', null, { timeout: 40000 })
  const rows = []
  const frames = [18, 40, 62, 84, 106, 124]
  for (let i = 0; i < 6; i++) {
    for (const f of frames) {
      await p.evaluate(([i, f]) => window.__phone.space.showFrame(i, f), [i, f])
      await p.waitForFunction(() => window.__phone.space.mode === 'held', null, { timeout: 8000 }).catch(() => {})
      await p.waitForTimeout(120)
      const r = await p.evaluate(([i, f]) => {
        const s = window.__phone.space, boxes = s.chips.boxes.filter((c) => c.opacity > 0.5)
        const bar = document.querySelector('.ph-bar').getBoundingClientRect(), sheet = s.sheet.querySelector('.ph-sp').getBoundingClientRect()
        const textRects = [...document.querySelectorAll('.ph-bar *, .ph-space *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect())
        const bad = []
        const reg = s.region
        boxes.forEach((c, n) => {
          const b = c.box
          if (b.l < reg.l - 0.5 || b.r > reg.r + 0.5 || b.t < reg.t - 0.5 || b.b > reg.b + 0.5) bad.push(`chip ${c.chip} outside the region`)
          if (b.t < bar.bottom - 0.5) bad.push(`chip ${c.chip} under the bar`)
          if (b.b > sheet.top + 0.5) bad.push(`chip ${c.chip} reaches the sheet`)
          boxes.slice(n + 1).forEach((o) => { if (b.l < o.box.r && b.r > o.box.l && b.t < o.box.b && b.b > o.box.t) bad.push(`chips ${c.chip} and ${o.chip} overlap`) })
          for (const t of textRects) if (b.l < t.right && b.r > t.left && b.t < t.bottom && b.b > t.top) { bad.push(`chip ${c.chip} over text at ${Math.round(t.left)},${Math.round(t.top)}`); break }
        })
        const els = [...document.querySelectorAll('.ph-sp-chip')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.5)
        const small = els.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11 || parseFloat(getComputedStyle(e.querySelector('span')).fontSize) < 11).length
        return { i, f, chips: boxes.length, bad, small, regionBottom: Math.round(reg.b), sheetTop: Math.round(sheet.top), barBottom: Math.round(bar.bottom) }
      }, [i, f])
      rows.push(r)
      if ((i === 0 && f === 62) || (i === 2 && f === 84) || (i === 5 && f === 124)) await p.screenshot({ path: `${OUT}/${W}x${H}-st${i + 1}-f${f}.png` })
    }
  }
  const bad = rows.flatMap((r) => r.bad.map((x) => `st${r.i + 1} f${r.f}: ${x}`))
  const csp = await p.evaluate(() => window.__csp)
  const sum = { size: `${W}x${H}`, samples: rows.length, chipsChecked: rows.reduce((n, r) => n + r.chips, 0), problems: bad, smallText: rows.reduce((n, r) => n + r.small, 0), region: { bottom: rows[0].regionBottom, sheetTop: rows[0].sheetTop, bar: rows[0].barBottom }, errs, csp }
  console.log(JSON.stringify(sum))
  all.push(sum)
  await ctx.close()
}
fs.writeFileSync(`${OUT}/sizes.json`, JSON.stringify(all, null, 1))
await b.close()
