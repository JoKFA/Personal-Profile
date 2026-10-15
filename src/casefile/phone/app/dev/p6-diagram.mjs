// P6a: the X-001 window diagram on the phone: a screenshot of the window at its first full frame (and a crop of the diagram), for before/after.
//   node p6-diagram.mjs <outDir> <tag> [--size=390x664] [--base=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { launch, until } from './lib.mjs'
const [OUT, TAG, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const { b, p, errs } = await launch(W, H)
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
await p.evaluate(() => window.__phone.openEntry('X-001'))
await until(p, () => window.__phone.phase === 'file', undefined, 30000); await p.waitForTimeout(6500)   // the diagram's script runs to its report stage
await p.screenshot({ path: path.join(OUT, `diagram-${TAG}-${W}x${H}.png`) })
const box = await p.locator('.ph-fdemo .dm-graph').boundingBox()
await p.screenshot({ path: path.join(OUT, `diagram-${TAG}-${W}x${H}-crop.png`), clip: { x: 0, y: Math.max(0, box.y - 70), width: W, height: Math.min(H - Math.max(0, box.y - 70), box.height + 120) } })
console.log(JSON.stringify({ box, errs, nodes: await p.evaluate(() => [...document.querySelectorAll('.ph-fdemo .dm-graph .nd rect')].map((r) => ({ rx: getComputedStyle(r).rx, stroke: getComputedStyle(r).strokeWidth }))) }))
await b.close()
