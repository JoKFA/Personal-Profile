// P6a: the cipher strips of a file body mid-decrypt (before/after drawing them on canvases): a screenshot of the body at a scroll position where lines are part-way.
//   node p6-cipher.mjs <outFile.png> [--base=http://127.0.0.1:4196] [--file=X-004] [--y=0.9]
import { launch, until } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const { b, p } = await launch(390, 664, { dsf: 3 })
await p.goto(`${flag('base', 'http://127.0.0.1:4196')}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
await p.evaluate((id) => window.__phone.openEntry(id), flag('file', 'X-004')); await until(p, () => window.__phone.phase === 'file', undefined, 60000); await p.waitForTimeout(2500)
const y = Number(flag('y', 0.9))
await p.evaluate((y) => scrollTo(0, innerHeight * y), y); await p.waitForTimeout(150)
await p.screenshot({ path: OUT })
console.log(JSON.stringify(await p.evaluate(() => ({ cbx: document.querySelectorAll('.ph-cbx').length, covers: document.querySelectorAll('.ph-cbx > canvas, .ph-cbx > i').length, tag: document.querySelector('.ph-cbx > *')?.tagName }))))
await b.close()
