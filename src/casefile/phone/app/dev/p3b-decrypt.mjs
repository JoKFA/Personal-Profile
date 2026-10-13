import { launch, until } from './lib.mjs'
const [OUT, ID = 'X-001', BASE = 'http://127.0.0.1:5194'] = process.argv.slice(2)
const { b, p, errs } = await launch(390, 664)
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1000)
await p.touchscreen.tap(195, 260)
await p.evaluate((id) => window.__phone.openEntry(id), ID)
await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(800)
await p.screenshot({ path: `${OUT}/dec-0.png` })
await p.evaluate(() => { const f = document.querySelector('.ph-file'); f.scrollTo({ top: 560 }) })
for (const [i, ms] of [[1, 80], [2, 160], [3, 160], [4, 200], [5, 500]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/dec-${i}.png` }) }
console.log(await p.evaluate(() => document.querySelector('.ph-verify').textContent), errs)
await b.close()
