import { launch, swipe, until } from './lib.mjs'
const OUT = process.argv[2]
const { b, p, cdp, errs } = await launch(390, 664)
await p.goto('http://127.0.0.1:5194/?phone-app&phone-expose', { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready)
await p.waitForTimeout(1200)
await swipe(cdp, 390, 664); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(800)
await p.screenshot({ path: OUT + '/base-stop.png' })
await p.locator('.ph-go[data-id="X-001"]').tap()
await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(600)
await p.screenshot({ path: OUT + '/base-file.png' })
console.log(errs)
await b.close()
