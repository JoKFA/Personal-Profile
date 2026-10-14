// cover and stop 01 (the bar), and a demo window, for the clarity and bar checks. node p3b-shots.mjs <out>
import fs from 'node:fs'
import { launch, swipe, until } from './lib.mjs'
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true })
const { b, p, cdp } = await launch(390, 664)
await p.goto('http://127.0.0.1:5194/?phone-app&phone-expose', { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1800)
await p.screenshot({ path: `${OUT}/bar-1-cover.png` })
await swipe(cdp, 390, 664); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(900)
await p.screenshot({ path: `${OUT}/bar-2-stop01.png` })
await p.evaluate(() => window.__phone.openEntry('ED-03')); await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(1200)
await p.screenshot({ path: `${OUT}/clarity-ED-03-demo.png` })
await p.evaluate(() => scrollTo(0, 620)); await p.waitForTimeout(700)
await p.screenshot({ path: `${OUT}/clarity-ED-03-bar-scrolled.png` })
await b.close()
