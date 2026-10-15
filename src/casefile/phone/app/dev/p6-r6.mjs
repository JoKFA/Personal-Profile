// P6a / R6 ① and ②: on the cover of a return visit, at every size: are the featured drive's four reticle marks inside the picture (between the bar and the panel, 4 px from the edges: the marks bracket the drive with a 6 px gap),
// and is the availability line (.ph-facts) there, visible, not covered, >= 11 px. A screenshot of each size.
//   node p6-r6.mjs <outDir> [--base=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { launch, until } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const BASE = (rest.find((x) => x.startsWith('--base=')) ?? '--base=http://127.0.0.1:4196').slice(7)
fs.mkdirSync(OUT, { recursive: true })
const SIZES = [[375, 548], [360, 640], [390, 664], [390, 844], [412, 780], [430, 740]]
const res = []
for (const [W, H] of SIZES) {
  const { b, p, errs } = await launch(W, H)
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(2500)
  const r = await p.evaluate(() => {
    const ph = window.__phone, marks = ph.marks(), bar = document.querySelector('.ph-bar')?.getBoundingClientRect(), panel = document.querySelector('.ph-pc')?.getBoundingClientRect(), f = document.querySelector('.ph-facts')
    const fr = f?.getBoundingClientRect(), fcs = f ? getComputedStyle(f) : null
    const hit = fr ? document.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2) : null
    const xs = marks.map((m) => m.x), ys = marks.map((m) => m.y)
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
    const top = bar ? bar.bottom : 0, bottom = panel ? panel.top : innerHeight
    return {
      marks: marks.map((m) => [Math.round(m.x), Math.round(m.y)]), driveBox: Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)])), freeBand: [Math.round(top), Math.round(bottom)],
      driveInFrame: box.x0 >= 4 && box.x1 <= innerWidth - 4 && box.y0 >= top + 4 && box.y1 <= bottom - 4,
      driveCentre: [Math.round((box.x0 + box.x1) / 2), Math.round((box.y0 + box.y1) / 2)],
      facts: f ? { text: f.textContent.trim(), display: fcs.display, visibility: fcs.visibility, opacity: fcs.opacity, font: fcs.fontSize, rect: [Math.round(fr.left), Math.round(fr.top), Math.round(fr.width), Math.round(fr.height)], inViewport: fr.top >= 0 && fr.bottom <= innerHeight && fr.width > 0, notCovered: !!hit && (f === hit || f.contains(hit) || hit.contains(f)) } : null,
    }
  })
  await p.screenshot({ path: path.join(OUT, `cover-${W}x${H}.png`) })
  res.push({ size: `${W}x${H}`, ...r, errs })
  await b.close()
}
fs.writeFileSync(path.join(OUT, 'r6-1-2.json'), JSON.stringify(res, null, 1))
for (const r of res) console.log(r.size, 'drive in frame:', r.driveInFrame, JSON.stringify(r.driveBox), 'band', JSON.stringify(r.freeBand), '| facts:', r.facts && `"${r.facts.text}" ${r.facts.font} visible=${r.facts.display !== 'none' && r.facts.inViewport && r.facts.notCovered}`)
