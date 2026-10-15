import { launch, until } from './lib.mjs'
const OUT = process.argv[2], BASE = process.argv[3] ?? 'http://127.0.0.1:5194'
const { b, p, errs } = await launch(390, 664)
p.on('console', (m) => { if (m.type() !== 'log') console.log('console', m.type(), m.text().slice(0, 200)) })
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
await p.screenshot({ path: `${OUT}/s0-cover.png` })
const bb = await p.locator('.ph-door').boundingBox(); console.log('door button', bb)
await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
for (const t of [300, 1200, 2600, 4200, 6500, 9000]) {
  await p.waitForTimeout(t === 300 ? 300 : 1000)
  const st = await p.evaluate(() => ({ phase: window.__phone.phase, mode: window.__phone.space?.mode, area: window.__phone.space?.area, ui: window.__phone.space?.state, y: scrollY }))
  console.log(t, JSON.stringify(st).slice(0, 260))
  await p.screenshot({ path: `${OUT}/s-${t}.png` })
}
console.log(errs)
await b.close()
