// A quick look at the entry page: node probe.mjs <outDir> [--size=390x664] [--base=...]
// shots: idle (first frame, 0.6 s, 2.5 s), then a hold with screenshots along the way, then the sealed page.
import fs from 'node:fs'
import path from 'node:path'
import { launch } from '../../dev/lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:5194'), [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const { b, p, cdp, errs } = await launch(W, H, { gate: true })
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const shot = (n) => p.screenshot({ path: path.join(OUT, `${n}.png`) })
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'commit' })
await p.waitForSelector('.ph-gate')
await shot('a0-first'); await p.waitForTimeout(700); await shot('a1-0.7s')
const pr = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
const [x, y, w, h] = pr; const cx = x + w * 0.5, cy = y + h * 0.5
await p.waitForTimeout(800)
await touch('touchStart', cx, cy)
for (let i = 1; i <= 8; i++) { await p.waitForTimeout(250); await shot(`b${i}-hold-${i * 0.25}s`) }
await p.waitForTimeout(600); await shot('c-after')
await touch('touchEnd')
console.log(JSON.stringify({ print: pr, errs }))
await b.close()
