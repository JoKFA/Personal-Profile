// The entry page at every test size: idle, held to the middle of the profile (all four readings and the sentence on screen), and sealed.
// Checks (boxes of the visible labels): the hold line clear of the print and the readings, the readings clear of the sentence, nothing past the screen edges, text >= 11 px for the hold line.
//   node sizes.mjs <outDir> [--base=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { launch } from '../../dev/lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196')
const SIZES = flag('sizes', '375x548,390x664,390x750,430x740,360x640,412x780,412x860').split(',').map((s) => s.split('x').map(Number))
fs.mkdirSync(OUT, { recursive: true })
const report = []
for (const [W, H] of SIZES) {
  const { b, p, cdp, errs } = await launch(W, H, { gate: true })
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1200)
  await p.screenshot({ path: path.join(OUT, `${W}x${H}-1-idle.png`) })
  const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
  await touch('touchStart', px + pw / 2, py + ph * 0.6)
  // hold until the sentence of the profile is on screen (statement 2), then release: the page stops exactly there
  await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-cap2'); return e && getComputedStyle(e).opacity === '1' && document.querySelector('.ph-gate .fp-mi .a') && getComputedStyle(document.querySelectorAll('.ph-gate .fp-mi .a')[3]).opacity === '1' }, undefined, { polling: 16, timeout: 20000 })
  await touch('touchEnd'); await p.waitForTimeout(120)
  await p.screenshot({ path: path.join(OUT, `${W}x${H}-2-profile.png`) })
  const boxes = await p.evaluate(() => {
    const vis = (e) => { const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 }
    const R = (e) => { const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } }
    const g = document.querySelector('.ph-gate'), pr = g.dataset.print.split(',').map(Number)
    const out = { print: { x0: pr[0], y0: pr[1], x1: pr[0] + pr[2], y1: pr[1] + pr[3] }, hold: R(g.querySelector('.fp-hold')), holdPx: parseFloat(getComputedStyle(g.querySelector('.fp-hold')).fontSize), mi: [...g.querySelectorAll('.fp-mi')].filter(vis).map(R), caps: [...g.querySelectorAll('.fp-cap, .fp-sub')].filter(vis).map(R), skip: R(g.querySelector('.gate-skip')) }
    out.all = [...g.querySelectorAll('.fp-labels > *, .fp-say > *, .gz-lock, .fp-phase, .gate-skip')].filter(vis).map((e) => ({ c: e.className, ...R(e) }))
    return out
  })
  const issues = []
  const hit = (a, c) => a.x0 < c.x1 && a.x1 > c.x0 && a.y0 < c.y1 && a.y1 > c.y0
  if (hit(boxes.hold, boxes.print)) issues.push('hold line overlaps the print')
  boxes.mi.forEach((m, i) => { if (hit(boxes.hold, m)) issues.push(`hold line overlaps reading ${i}`) })
  for (const m of boxes.mi) for (const c of boxes.caps) if (hit(m, c)) issues.push(`a reading overlaps the sentence (${Math.round(m.y1)} > ${Math.round(c.y0)})`)
  for (const a of boxes.all) if (a.x0 < -0.5 || a.x1 > W + 0.5 || a.y1 > H + 0.5) issues.push(`${a.c} outside the screen (${Math.round(a.x0)}..${Math.round(a.x1)}, ${Math.round(a.y1)})`)
  if (boxes.holdPx < 11) issues.push('hold line under 11px')
  await touch('touchStart', px + pw / 2, py + ph / 2)
  await p.waitForFunction(() => window.__phone && window.__phone.entry && window.__phone.entry.sealedAt > 0, undefined, { timeout: 30000 }); await touch('touchEnd')
  await p.waitForTimeout(40)
  await p.screenshot({ path: path.join(OUT, `${W}x${H}-3-sealed.png`) })
  report.push({ size: `${W}x${H}`, print: [pw, ph], holdPx: boxes.holdPx, issues, errs, mi: boxes.mi.map((m) => [Math.round(m.y0), Math.round(m.y1)]), caps: boxes.caps.map((m) => [Math.round(m.y0), Math.round(m.y1)]), hold: [Math.round(boxes.hold.y0), Math.round(boxes.hold.y1)], printY: [Math.round(boxes.print.y0), Math.round(boxes.print.y1)] })
  await b.close()
}
fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(report, null, 1))
console.log(JSON.stringify(report.map((r) => ({ size: r.size, print: r.print, holdPx: r.holdPx, issues: r.issues, errs: r.errs.length })), null, 1))
