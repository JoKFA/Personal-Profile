// P6b: the motion must not change: a screencast of a pan, an open and a close at real speed (no throttle), the frames resampled every 40 ms from the moment the gesture starts, for two builds.
//   node p6-strips.mjs <outDir> <tag> --base=http://127.0.0.1:4196 [--size=390x664] [--file=X-004]
//   -> <outDir>/<tag>-<flow>.json (the frames' times and file names) and <tag>-<flow>-NNN.jpg (every 40 ms); compose.py makes the strips and the numbers.
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'

const [OUT, TAG, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), [W, H] = flag('size', '390x664').split('x').map(Number), FILE = flag('file', 'X-001')
fs.mkdirSync(OUT, { recursive: true })
const { b, p, cdp } = await launch(W, H, { dsf: 1 })
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(5000)

/** run `action` with the screencast on; keep the frames from 100 ms before it to `tail` ms after `until` */
async function flow(name, action, done, tail = 600) {
  const frames = []
  const on = (f) => { frames.push({ ts: f.metadata.timestamp * 1000, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) }
  cdp.on('Page.screencastFrame', on)
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  await p.waitForTimeout(300)
  const t0 = await p.evaluate(() => performance.timeOrigin + performance.now())
  await action()
  await done()
  await p.waitForTimeout(tail)
  await cdp.send('Page.stopScreencast'); cdp.off('Page.screencastFrame', on)
  // the gesture's moment is t0 (wall clock, ms); resample every 40 ms from t0 - 120 to the end
  const last = frames.at(-1).ts, out = []
  let k = 0
  for (let t = t0 - 120; t <= last; t += 40) {
    let f = null; for (const fr of frames) if (fr.ts <= t) f = fr; else break
    if (!f) continue
    const file = `${TAG}-${name}-${String(k).padStart(3, '0')}.jpg`; fs.writeFileSync(path.join(OUT, file), Buffer.from(f.data, 'base64'))
    out.push({ t: Math.round(t - t0), file }); k++
  }
  fs.writeFileSync(path.join(OUT, `${TAG}-${name}.json`), JSON.stringify({ name, frames: out, raw: frames.length }, null, 1))
  console.log(name, 'frames', frames.length, 'sampled', out.length)
}
await flow('pan', () => swipe(cdp, W, H), () => p.waitForFunction(() => window.__phone.at === 1 && window.__phone.phase === 'settled', null, { timeout: 30000 }), 900)
await p.waitForTimeout(2500)
await flow('open', async () => { await p.evaluate((id) => window.__phone.openEntry(id), FILE) }, () => p.waitForFunction(() => window.__phone.phase === 'file', null, { timeout: 30000 }), 1200)
await p.waitForTimeout(1500)
await flow('close', async () => { await p.evaluate(() => window.__phone.closeFile(true)) }, () => p.waitForFunction(() => window.__phone.phase === 'settled' && !window.__phone.openId, null, { timeout: 30000 }), 900)
await b.close()
