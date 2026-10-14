// the top bar's Index / Contact must sit in exactly the same place on every section. node p3b-bar.mjs [WxH] [base]
import { launch, swipe, until } from './lib.mjs'
const [SIZE = '390x664', BASE = 'http://127.0.0.1:5194'] = process.argv.slice(2)
const [W, H] = SIZE.split('x').map(Number)
const { b, p, cdp, errs } = await launch(W, H)
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
const read = () => p.evaluate(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10, Math.round(b.top * 10) / 10] }; return { at: window.__phone.at, nav: [...document.querySelectorAll('.ph-nav button')].map(r), brand: r(document.querySelector('.ph-brand')), docW: document.documentElement.scrollWidth, innerW: innerWidth, vv: visualViewport.width, barW: document.querySelector('.ph-bar').getBoundingClientRect().width } })
const rows = [await read()]
for (let i = 0; i < 4; i++) { await swipe(cdp, W, H); await until(p, (n) => window.__phone.at === n && window.__phone.phase === 'settled', i + 1); await p.waitForTimeout(500); rows.push(await read()) }
for (const r of rows) console.log(JSON.stringify(r))
console.log(errs)
await b.close()
