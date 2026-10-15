// P6a: where a long task goes: a CPU profile (4x throttle) of one step of the E1 path, top functions by self time, with urls and lines.
//   node p6-prof.mjs <outFile.json> --step=swipe1|open|close|load [--base=http://127.0.0.1:4196] [--file=ED-02] [--rate=4]
import fs from 'node:fs'
import { launch, swipe, until } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), STEP = flag('step', 'swipe1'), FILE = flag('file', 'ED-02'), RATE = Number(flag('rate', 4)), [W, H] = [390, 664]
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const { b, p, cdp } = await launch(W, H, { gate: true })
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 })
const start = () => cdp.send('Profiler.start')
let prof = null
const stop = async () => { prof = (await cdp.send('Profiler.stop')).profile }
if (STEP === 'load') await start()
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(STEP === 'load' ? 3000 : 1500)
if (STEP === 'load') await stop()
else {
  const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
  await touch(cdp, 'touchStart', px + pw / 2, py + ph / 2)
  await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0); await touch(cdp, 'touchEnd')
  await until(p, () => window.__phone.entry.coverAt > 0, undefined, 120000); await p.waitForTimeout(1500)
  if (STEP === 'swipe1') { await start(); await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled', undefined, 120000); await p.waitForTimeout(1200); await stop() }
  else {
    await p.evaluate((id) => window.__phone.openEntry(id), FILE); await until(p, () => window.__phone.phase === 'file', undefined, 120000); await p.waitForTimeout(2500)
    if (STEP === 'open') { /* profiled below */ }
  }
}
if (STEP === 'open' || STEP === 'close') {
  // re-run the step under the profiler
  if (STEP === 'close') { await start(); await p.evaluate(() => scrollTo(0, 0)); await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 120000); await p.waitForTimeout(1500); await stop() }
  else { await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 120000); await p.waitForTimeout(1500); await start(); await p.evaluate((id) => window.__phone.openEntry(id), FILE); await until(p, () => window.__phone.phase === 'file', undefined, 120000); await p.waitForTimeout(2500); await stop() }
}
// self time by function
const nodes = new Map(prof.nodes.map((n) => [n.id, n])); const self = new Map()
for (let i = 0; i < prof.samples.length; i++) { const n = nodes.get(prof.samples[i]); const dt = prof.timeDeltas[i] / 1000; const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}:${f.columnNumber + 1}`; self.set(k, (self.get(k) ?? 0) + dt) }
// who calls the heavy builtins (the nearest named callers, by self time of the builtin under them)
const parent = new Map(); for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
const callers = new Map()
for (let i = 0; i < prof.samples.length; i++) { const n = nodes.get(prof.samples[i]); if (!/^(toDataURL|getBoundingClientRect|fillRect|getContext|\(garbage collector\))$/.test(n.callFrame.functionName)) continue; const chain = []; for (let id = parent.get(n.id), k = 0; id && k < 4; id = parent.get(id), k++) { const f = nodes.get(id).callFrame; chain.push(`${f.functionName || '(anon)'}@${f.url.split('/').pop()}:${f.lineNumber + 1}:${f.columnNumber + 1}`) } const key = `${n.callFrame.functionName} <- ${chain.join(' <- ')}`; callers.set(key, (callers.get(key) ?? 0) + prof.timeDeltas[i] / 1000) }
const callerTop = [...callers.entries()].sort((a, c) => c[1] - a[1]).slice(0, 10).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`)
const top = [...self.entries()].sort((a, c) => c[1] - a[1]).slice(0, 18).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`)
fs.writeFileSync(OUT, JSON.stringify({ step: STEP, rate: RATE, totalMs: Math.round(prof.samples.length ? (prof.endTime - prof.startTime) / 1000 : 0), top, callerTop }, null, 1))
console.log(top.join('\n'))
await b.close()
