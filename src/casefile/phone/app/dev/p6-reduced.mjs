// P6a: reduced motion: the reticle's four marks and the stage's framing do not travel; they jump with the crossfade. Every animation frame during a pan, an open and a close:
// the four marks' positions and the stage's transform; the number of distinct values is the evidence (a control run without reduced motion shows the travel).
//   node p6-reduced.mjs <outDir> [--size=390x664] [--base=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const out = {}
for (const reduced of [true, false]) {
  const { b, p, cdp, errs } = await launch(W, H)
  if (reduced) await p.emulateMedia({ reducedMotion: 'reduce' })
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  const run = async (name, act, done) => {
    await p.evaluate(() => { window.__m = { marks: new Set(), fit: new Set(), n: 0, phases: new Set() }; const f = () => { const ph = window.__phone; window.__m.marks.add(ph.marks().map((m) => Math.round(m.x) + ',' + Math.round(m.y)).join('|')); window.__m.fit.add(ph.stage.el.style.transform); window.__m.phases.add(ph.phase); window.__m.n++; window.__m.raf = requestAnimationFrame(f) }; window.__m.raf = requestAnimationFrame(f) })
    await act(); await until(p, done, undefined, 30000); await p.waitForTimeout(400)
    const r = await p.evaluate(() => { cancelAnimationFrame(window.__m.raf); const m = window.__m; return { frames: m.n, distinctMarkSets: m.marks.size, distinctStageTransforms: m.fit.size, phases: [...m.phases] } })
    out[`${reduced ? 'reduced' : 'normal'}-${name}`] = r
  }
  await run('pan', () => swipe(cdp, W, H), () => window.__phone.at === 1 && window.__phone.phase === 'settled')
  await run('open', () => p.locator('.ph-go[data-id="X-001"]').tap(), () => window.__phone.phase === 'file')
  await p.waitForTimeout(1500)
  await run('close', () => p.locator('.ph-back').tap(), () => window.__phone.phase === 'settled' && !window.__phone.openId)
  out[`${reduced ? 'reduced' : 'normal'}-errs`] = errs
  await b.close()
}
fs.writeFileSync(path.join(OUT, 'reduced-marks.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
