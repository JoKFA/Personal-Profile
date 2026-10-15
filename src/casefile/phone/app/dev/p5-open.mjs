// P5: a row of the Index opens its file. (A) a file that is not a selected one: the sheet slides down on the spring, the entry's stop is shown, the open clip plays; a 0.05 s strip of the first
// 1.2 s after the tap. (B) the profile's row goes through the door (the runtime's own entry point), and closing returns to the same row.
//   node p5-open.mjs <outDir> [--size=390x664] [--base=http://127.0.0.1:4196] [--file=X-004]
import fs from 'node:fs'
import path from 'node:path'
import { launch, until } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), FILE = flag('file', 'X-004')
const [W, H] = flag('size', '390x664').split('x').map(Number), TAG = `${W}x${H}`
fs.mkdirSync(OUT, { recursive: true })
const { b, p, cdp, errs } = await launch(W, H)
const frames = []
cdp.on('Page.screencastFrame', (f) => { frames.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
const rep = { size: TAG }
const rowTop = (id) => p.evaluate((id) => Math.round(document.querySelector(`.ph-ix[data-id="${id}"]`).getBoundingClientRect().top), id)
const toIndex = async () => { await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H); await p.waitForTimeout(700) }
const center = async (id) => { await p.evaluate((id) => { const r = document.querySelector(`.ph-ix[data-id="${id}"]`).getBoundingClientRect(); scrollBy(0, r.top - innerHeight / 2) }, id); await p.waitForTimeout(500); const bb = await p.locator(`.ph-ix[data-id="${id}"]`).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2] }
await toIndex()

// (A) a file that is not a selected one
let [x, y] = await center(FILE)
const topA = await rowTop(FILE), yA = await p.evaluate(() => Math.round(scrollY))
await p.evaluate(() => { window.__sl = []; const f = () => { window.__sl.push([performance.now(), +window.__phone.page.indexSlide.toFixed(3), window.__phone.phase, window.__phone.stage.current]); if (window.__sl.length < 900) requestAnimationFrame(f) }; requestAnimationFrame(f) })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await p.waitForTimeout(150); const tTap = Date.now(); const tapTs = await p.evaluate(() => performance.now())
await p.touchscreen.tap(x, y)
await until(p, () => window.__phone.phase === 'file', undefined, 20000); await p.waitForTimeout(500)
await cdp.send('Page.stopScreencast')
rep.open = await p.evaluate((t0) => { const s = window.__sl.filter((r) => r[0] >= t0 - 200); const at = (fn) => { const r = s.find(fn); return r ? Math.round(r[0] - t0) : null }; return { slideGone95Ms: at((r) => r[1] >= 0.95), slideStartMs: at((r) => r[1] > 0.02), stopShownMs: at((r) => r[3] === 'stop:' + window.__phone.openId), openingMs: at((r) => r[2] === 'opening'), fileMs: at((r) => r[2] === 'file'), id: window.__phone.openId } }, tapTs)
// the strip: every 0.05 s from 0.1 s before the tap
{
  const ts = frames.map((f) => f.ts), tTapEpoch = frames.length ? frames[0].ts : 0; void tTapEpoch
  rep.frames = frames.length
  fs.writeFileSync(path.join(OUT, `open-frames-${TAG}.json`), JSON.stringify(frames.map((f) => f.ts)))
  const d = path.join(OUT, `screencast-open-${TAG}`); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true })
  frames.forEach((f, i) => fs.writeFileSync(path.join(d, `s-${String(i).padStart(4, '0')}-${f.ts.toFixed(4)}.jpg`), Buffer.from(f.data, 'base64')))
  void ts
}
await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 20000); await p.waitForTimeout(1200)
rep.close = { rowTopBefore: topA, rowTopAfter: await rowTop(FILE), yBefore: yA, yAfter: await p.evaluate(() => Math.round(scrollY)), focus: await p.evaluate(() => `${document.activeElement?.className} ${document.activeElement?.dataset?.id ?? ''}`), indexSlide: await p.evaluate(() => +window.__phone.page.indexSlide.toFixed(2)), path: await p.evaluate(() => location.pathname) }

// (B) the profile: through the door
await p.evaluate(() => scrollTo(0, 5 * innerHeight)); await p.waitForTimeout(500);
[x, y] = await center('YW-000')
const topB = await rowTop('YW-000')
await p.touchscreen.tap(x, y)
await until(p, () => window.__phone.phase === 'space', undefined, 30000).catch(() => {})
rep.door = { phase: await p.evaluate(() => window.__phone.phase), openId: await p.evaluate(() => window.__phone.openId), path: await p.evaluate(() => location.pathname), slide: await p.evaluate(() => +window.__phone.page.indexSlide.toFixed(2)) }
await p.waitForTimeout(6000)   // the door and the interior's first cut
rep.door.afterDoor = await p.evaluate(() => ({ phase: window.__phone.phase, y: Math.round(scrollY), fileMode: document.documentElement.classList.contains('ph-filemode') }))
await p.screenshot({ path: path.join(OUT, `door-${TAG}.png`) })
const back = await p.locator('.ph-back').boundingBox().catch(() => null)
if (back) { await p.touchscreen.tap(back.x + back.width / 2, back.y + back.height / 2); await until(p, () => window.__phone.phase === 'settled', undefined, 40000).catch(() => {}); await p.waitForTimeout(1500) }
rep.door.close = { phase: await p.evaluate(() => window.__phone.phase), rowTopBefore: topB, rowTopAfter: await rowTop('YW-000').catch(() => null), indexSlide: await p.evaluate(() => +window.__phone.page.indexSlide.toFixed(2)), focus: await p.evaluate(() => `${document.activeElement?.className} ${document.activeElement?.dataset?.id ?? ''}`) }
rep.errs = errs; rep.csp = await p.evaluate(() => window.__phone.csp)
fs.writeFileSync(path.join(OUT, `open-${TAG}.json`), JSON.stringify(rep, null, 1))
console.log(JSON.stringify(rep, null, 1))
await b.close()
