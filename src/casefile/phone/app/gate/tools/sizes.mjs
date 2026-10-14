// The entry page at every test size, in its three phases (read, profile, seal), and the clearances that must hold at all of them:
//   - no text touches or crosses a hairline of the print's brackets (>= 6 px clear), none touches the print's box,
//   - every reading line keeps >= 8 px from the sentence (and its small line), from the print and from the hold line,
//   - the hold line is >= 11 px, nothing is past the screen edge.
// Text boxes are the text's own extent (a Range over the node's contents), so a wide box around short text does not count.
//   node sizes.mjs <outDir> [--base=http://127.0.0.1:4196] [--sizes=375x548,...]
import fs from 'node:fs'
import path from 'node:path'
import { launch } from '../../dev/lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196')
const SIZES = flag('sizes', '375x548,390x664,390x750,430x740,360x640,412x780,412x860').split(',').map((s) => s.split('x').map(Number))
fs.mkdirSync(OUT, { recursive: true })

/** in the page: every text's tight box, the print, the bracket's marks (as 1 px boxes) */
const measure = () => {
  const g = document.querySelector('.ph-gate')
  const tight = (e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom } }
  const rect = (e) => { const b = e.getBoundingClientRect(); return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom } }
  const box = (sel) => [...g.querySelectorAll(sel)].map(tight)
  const pr = g.dataset.print.split(',').map(Number), br = g.dataset.bracket.split(',').map(Number)
  const [X0, Y0, X1, Y1] = br, l = 14, h = 0.65
  const marks = [
    { x0: X0 - h, y0: Y0, x1: X0 + h, y1: Y0 + l }, { x0: X0, y0: Y0 - h, x1: X0 + l, y1: Y0 + h },
    { x0: X1 - h, y0: Y0, x1: X1 + h, y1: Y0 + l }, { x0: X1 - l, y0: Y0 - h, x1: X1, y1: Y0 + h },
    { x0: X0 - h, y0: Y1 - l, x1: X0 + h, y1: Y1 }, { x0: X0, y0: Y1 - h, x1: X0 + l, y1: Y1 + h },
    { x0: X1 - h, y0: Y1 - l, x1: X1 + h, y1: Y1 }, { x0: X1 - l, y0: Y1 - h, x1: X1, y1: Y1 + h },
  ]
  return {
    print: { x0: pr[0], y0: pr[1], x1: pr[0] + pr[2], y1: pr[1] + pr[3] }, bracket: br, marks,
    exh: box('.fp-exh-l, .fp-exh-r'), hold: box('.fp-hold')[0], holdPx: parseFloat(getComputedStyle(g.querySelector('.fp-hold')).fontSize),
    readings: box('.fp-mi .h, .fp-mi .v, .fp-mi .a'), sentence: box('.fp-cap, .fp-sub'),
    readingBoxes: [...g.querySelectorAll('.fp-mi')].map(rect), sentenceBoxes: [...g.querySelectorAll('.fp-cap, .fp-sub')].map(rect),
    phase: box('.fp-phase'), lock: box('.gz-lock .a, .gz-lock .b'), skip: box('.gz-skip .t1'),
    // the hash block is on screen only after the brackets are gone: not part of the hairline check
  }
}
const gap = (a, b) => Math.max(b.x0 - a.x1, a.x0 - b.x1, b.y0 - a.y1, a.y0 - b.y1)   // > 0: apart; the larger of the two axis gaps
const issues = (W, H, m) => {
  const out = [], r = (n) => Math.round(n * 10) / 10
  const texts = [['exhibit line', m.exh], ['hold line', [m.hold]], ['reading', m.readings], ['sentence', m.sentence], ['phase', m.phase], ['name', m.lock], ['skip', m.skip]]
  // text against the bracket's hairlines: >= 6 px
  for (const [n, bs] of texts) for (const t of bs) for (const k of m.marks) if (gap(t, k) < 6) out.push(`${n} ${r(gap(t, k))} px from a bracket hairline`)
  // the print's box: the lines of text that sit near it
  for (const [n, bs] of [['hold line', [m.hold]], ['reading', m.readings]]) for (const t of bs) if (gap(t, m.print) < (n === 'reading' ? 8 : 6)) out.push(`${n} ${r(gap(t, m.print))} px from the print`)
  for (const t of m.readings) {
    if (gap(t, m.hold) < 8) out.push(`reading ${r(gap(t, m.hold))} px from the hold line`)
  }
  // the sentence is measured by its line boxes (its glyphs sit inside them), the readings by their boxes
  for (const t of m.readingBoxes) for (const s of m.sentenceBoxes) if (gap(t, s) < 8) out.push(`reading ${r(gap(t, s))} px from the sentence`)
  if (m.holdPx < 11) out.push('hold line under 11 px')
  for (const [n, bs] of texts) for (const t of bs) if (t.x0 < -0.5 || t.x1 > W + 0.5 || t.y1 > H + 0.5) out.push(`${n} past the screen`)
  return [...new Set(out)]
}

const report = []
for (const [W, H] of SIZES) {
  const { b, p, cdp, errs } = await launch(W, H, { gate: true })
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
  const shot = (n) => p.screenshot({ path: path.join(OUT, `${W}x${H}-${n}.png`) })
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1500)   // (the fonts are in, the page is laid out again)
  await shot('1-idle')
  const m0 = await p.evaluate(measure)
  const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
  await touch('touchStart', px + pw / 2, py + ph * 0.6)
  const at = (sel) => p.waitForFunction((s) => { const e = document.querySelector(s); return e && getComputedStyle(e).opacity === '1' }, sel, { polling: 16, timeout: 20000 })
  // read: the first sentence and its small line are on screen, the readings come in; profile: the second sentence and all four attacker lines; seal: the sealed print
  await at('.ph-gate .fp-sub1'); await p.waitForTimeout(60); await shot('2-read')
  await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-cap2'); const a = document.querySelectorAll('.ph-gate .fp-mi .a')[3]; return e && getComputedStyle(e).opacity === '1' && a && getComputedStyle(a).opacity === '1' }, undefined, { polling: 16, timeout: 20000 })
  await touch('touchEnd'); await p.waitForTimeout(100); await shot('3-profile')
  await touch('touchStart', px + pw / 2, py + ph / 2)
  await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-cap3'); return e && getComputedStyle(e).opacity === '1' }, undefined, { polling: 16, timeout: 20000 })
  await p.waitForTimeout(150); await shot('4-seal-cipher')
  await p.waitForFunction(() => window.__phone && window.__phone.entry && window.__phone.entry.sealedAt > 0, undefined, { timeout: 30000 }); await touch('touchEnd')
  await p.waitForTimeout(40); await shot('5-sealed')
  const found = issues(W, H, m0)
  report.push({ size: `${W}x${H}`, print: [pw, ph], holdPx: m0.holdPx, issues: found, errs })
  await b.close()
}
fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(report, null, 1))
console.log(JSON.stringify(report.map((r) => ({ size: r.size, print: r.print, holdPx: r.holdPx, issues: r.issues, errs: r.errs.length })), null, 1))
