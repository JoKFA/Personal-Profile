// P6b: what is inside each long task of one step of the motion path (4x CPU): a CPU profile, cut to each task over 50 ms (the long-task entries give their start and length),
// the frames mapped to source through the build's source maps. Prints, per task, the functions with the most inclusive time and the ones with the most self time.
//   node p6-lt.mjs <step> --dist=<dir of a --sourcemap build> [--base=http://127.0.0.1:4199] [--rate=4] [--min=50]
//   steps: entrance | pan1 | pan2 | open | close | door | interior | index
import fs from 'node:fs'
import path from 'node:path'
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
import { launch, swipe, until } from './lib.mjs'

const [STEP, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const TRACE = flag('trace', '') === '1'
const BASE = flag('base', 'http://127.0.0.1:4199'), DIST = flag('dist', ''), RATE = Number(flag('rate', 4)), MIN = Number(flag('min', 50)), FILE = flag('file', 'ED-02')
const [W, H] = [390, 664]
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const { b, p, cdp } = await launch(W, H, { gate: true })
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
await p.addInitScript(() => { window.__st = []; const smp = (t) => { const ph = window.__phone; if (ph) window.__st.push([t, ph.phase, ph.space?.mode ?? '', Math.round(scrollY)]); requestAnimationFrame(smp) }; requestAnimationFrame(smp)
  window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true }) })
let t0 = 0
const events = []
if (TRACE) cdp.on('Tracing.dataCollected', (e) => events.push(...e.value))
const start = async () => {
  await p.evaluate(() => { if (window.__lt) window.__lt.length = 0 })
  if (TRACE) await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,v8,disabled-by-default-v8.compile,blink,cc,toplevel,blink.user_timing,loading' + (flag('js', '') ? ',disabled-by-default-v8.cpu_profiler' : '') + (flag('inv', '') ? ',disabled-by-default-devtools.timeline.invalidationTracking' : ''), transferMode: 'ReportEvents' })
  else await cdp.send('Profiler.start')
  t0 = await p.evaluate(() => performance.now())
}
const tapAt = async (l) => { await l.scrollIntoViewIfNeeded(); const bb = await l.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }
const mode = (m, ms = 90000) => p.waitForFunction((m) => { const s = window.__phone.space; return s && m.includes(s.mode) }, m, { timeout: ms })
if (STEP === 'load') await start()
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1500)
if (STEP !== 'load') {
const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
await touch(cdp, 'touchStart', px + pw / 2, py + ph / 2)
if (STEP === 'entrance') await start()
await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0); await touch(cdp, 'touchEnd')
if (STEP === 'entrance') { await until(p, () => window.__phone.entry.coverAt > 0, undefined, 120000); await p.waitForTimeout(2500) }
else {
  await until(p, () => window.__phone.entry.coverAt > 0, undefined, 120000); await p.waitForTimeout(4000)
  const pan = async (n) => { await swipe(cdp, W, H); await until(p, (n) => window.__phone.at === n && window.__phone.phase === 'settled', n, 120000); await p.waitForTimeout(2500) }
  if (STEP === 'pan1') { await start(); await pan(1); await p.waitForTimeout(500) }
  else if (STEP === 'pan2') { await pan(1); await start(); await pan(2) }
  else if (STEP === 'open' || STEP === 'close') {
    await pan(1); await pan(2)
    if (STEP === 'open') await start()
    await p.evaluate((id) => window.__phone.openEntry(id), FILE); await until(p, () => window.__phone.phase === 'file', undefined, 120000); await p.waitForTimeout(2000)
    if (STEP === 'close') { await start(); await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 120000); await p.waitForTimeout(1500) }
  } else if (STEP === 'index') {
    await start(); await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H, 60000); await p.waitForTimeout(1200)
  } else if (STEP === 'exit') {
    await tapAt(p.locator('.ph-door')); await mode(['door'], 15000); await mode(['intro'], 60000); await mode(['station', 'rest'], 120000); await p.waitForTimeout(1500)
    await start(); await p.evaluate(() => scrollTo(0, 0)); await p.locator('.ph-back').tap(); await p.waitForFunction(() => window.__phone.phase === 'settled', null, { timeout: 60000 }); await p.waitForTimeout(1500)
  } else if (STEP === 'door' || STEP === 'interior') {
    await start(); await tapAt(p.locator('.ph-door')); await mode(['door'], 15000); if (flag('prelock', '')) await p.evaluate(() => { document.querySelector('.ph-reel').style.contentVisibility = 'hidden' }); await mode(['intro'], 60000)
    if (STEP === 'interior') { await mode(['station', 'rest'], 120000); await mode(['fly'], 120000); await mode(['station'], 120000) }
    await p.waitForTimeout(1500)
  }
}
}
// frames -> source
const maps = new Map()
const mapFor = (url) => { const f = url.split('/').pop(); if (!maps.has(f)) { const mp = path.join(DIST, 'assets', f + '.map'); maps.set(f, fs.existsSync(mp) ? new TraceMap(JSON.parse(fs.readFileSync(mp, 'utf8'))) : null) } return maps.get(f) }
const label = (cf) => {
  if (!cf.url) return cf.functionName ? `[native] ${cf.functionName}` : '(root)'
  const m = mapFor(cf.url); let src = `${cf.url.split('/').pop()}:${cf.lineNumber + 1}`
  if (m) { const o = originalPositionFor(m, { line: cf.lineNumber + 1, column: cf.columnNumber }); if (o.source) src = `${o.source.replace(/^.*\/src\//, 'src/')}:${o.line}` + (o.name ? ` (${o.name})` : '') }
  return `${cf.functionName || '(anon)'} @ ${src}`
}
const lts = (await p.evaluate(() => window.__lt)).filter(([, d]) => d >= MIN)
if (TRACE) {
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done
  // the page's main thread: the thread that ran the most RunTask events
  const calls = new Map(); for (const e of events) if (e.name === 'FunctionCall' || e.name === 'EventDispatch' || e.name === 'FireAnimationFrame') { const k = `${e.pid}:${e.tid}`; calls.set(k, (calls.get(k) ?? 0) + 1) }
  const main = [...calls.entries()].sort((a, c) => c[1] - a[1])[0][0]
  const ev = events.filter((e) => `${e.pid}:${e.tid}` === main && e.ph === 'X' && e.dur != null).sort((a, c) => a.ts - c.ts || c.dur - a.dur)
  const runs = ev.filter((e) => e.name === 'RunTask' && e.dur >= MIN * 1000)
  // pair the long tasks (page time) with the RunTask events (trace time) by length, in order
  console.error('main runtasks >= MIN:', runs.map((r) => Math.round(r.dur / 1000)).join(','))
  // the JS stacks from the trace's own CPU profile (the same clock as the RunTask events)
  const pn = new Map(), pp = new Map(), js = []
  { let t = null; const evs = events.filter((e) => e.name === 'Profile' || e.name === 'ProfileChunk')
    for (const e of evs) { if (e.name === 'Profile') { t = e.args.data.startTime; continue } const d = e.args.data, cp = d.cpuProfile ?? {}
      for (const n of cp.nodes ?? []) { pn.set(n.id, n); if (n.parent != null) pp.set(n.id, n.parent) }
      const sm = cp.samples ?? [], td = d.timeDeltas ?? []
      for (let i = 0; i < sm.length; i++) { t += td[i]; js.push([t, sm[i], td[i]]) } } }
  const out = []
  let ri = 0
  for (const [at, dur] of lts) {
    let best = null; for (let j = ri; j < runs.length; j++) if (Math.abs(runs[j].dur / 1000 - dur) < Math.max(8, dur * 0.12)) { best = j; break }
    if (best == null) { out.push(`--- task ${Math.round(at)} ms (${Math.round(dur)} ms): no matching RunTask`); continue }
    ri = best + 1; const r = runs[best]
    const inside = ev.filter((e) => e !== r && e.ts >= r.ts && e.ts + e.dur <= r.ts + r.dur + 1)
    // exclusive time per event name: an event's duration minus its direct children's
    const excl = new Map(), kids = new Map()
    const stack = [r]
    for (const e of inside) { while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop(); const par = stack.at(-1); if (par) kids.set(par, (kids.get(par) ?? 0) + e.dur); stack.push(e) }
    excl.set('(RunTask self)', r.dur - (kids.get(r) ?? 0))
    const detail = new Map()
    for (const e of inside) { const self = e.dur - (kids.get(e) ?? 0); const k = e.name; excl.set(k, (excl.get(k) ?? 0) + self); if (/FunctionCall|EvaluateScript|v8.run|TimerFire|FireAnimationFrame|EventDispatch|ResourceReceive|ImageDecode|Decode/.test(k)) { const a = e.args?.data ?? {}; const u = (a.url || a.functionName || a.type || '').toString().split('/').pop(); const dk = `${k} ${u}${a.lineNumber != null ? ':' + a.lineNumber : ''}`; detail.set(dk, (detail.get(dk) ?? 0) + e.dur) } }
    const lay = inside.filter((e) => /^(Layout|UpdateLayoutTree|RecalculateStyles)$/.test(e.name) && e.dur > 3000).map((e) => `${(e.dur / 1000).toFixed(0)} ms ${e.name} ${JSON.stringify(e.args?.beginData ?? {}).slice(0, 90)} ${JSON.stringify(e.args?.elementCount ?? '')} ${JSON.stringify(e.args?.endData ?? {}).slice(0, 80)}`)
    if (flag('raw', '')) for (const e of inside) if ((e.name === 'UpdateLayoutTree' || e.name === 'Document::recalcStyle') && e.dur > 15000) console.error('RAW', e.name, e.dur, JSON.stringify(e.args).slice(0, 400))
    if (lay.length) detail.set('(big layout/style events listed below)', 0)
    const invs = new Map()
    for (const e of events) { if (!/InvalidationTracking$/.test(e.name) || e.ts < r.ts || e.ts > r.ts + r.dur) continue; const d = e.args?.data ?? {}; const k = `${e.name.replace('InvalidationTracking', '')} reason=${d.reason ?? ''} sel=${(d.selectorPart ?? d.invalidationList?.map?.((x) => x.classes?.join('.') || x.id).join(',') ?? '').toString().slice(0, 60)} extra=${(d.extraData ?? '').toString().slice(0, 40)} on=${d.nodeName ?? ''}`; invs.set(k, (invs.get(k) ?? 0) + 1) }
    if (flag('raw', '')) for (const [k, v] of invs) if (/subtree|escendant|ubtree|all |Font|Media|Custom|Property/i.test(k)) console.error('INV', v, k)
    const invTop = [...invs.entries()].sort((a, c) => c[1] - a[1]).slice(0, 12).map(([k, v]) => `${String(v).padStart(5)} x ${k}`)
    let jsTop = []
    if (js.length) { const incl = new Map(), self = new Map()
      for (const [t, id, d] of js) { if (t < r.ts || t > r.ts + r.dur) continue
        const n = pn.get(id); if (!n) continue; const sl = label(n.callFrame); self.set(sl, (self.get(sl) ?? 0) + d / 1000)
        const seen = new Set(); for (let k = id; k != null; k = pp.get(k)) { const l = label(pn.get(k).callFrame); if (seen.has(l) || /^\((root|program|idle)\)/.test(l)) continue; seen.add(l); incl.set(l, (incl.get(l) ?? 0) + d / 1000) } }
      const tp = (m, k) => [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, k).map(([l, v]) => `${v.toFixed(0).padStart(5)} ms ${l}`)
      jsTop = ['  JS inclusive:', ...tp(incl, Number(flag('top', 14))).map((x) => '   ' + x), '  JS self:', ...tp(self, 8).map((x) => '   ' + x)] }
    const top = [...excl.entries()].sort((a, c) => c[1] - a[1]).slice(0, 10).map(([k, v]) => `${(v / 1000).toFixed(0).padStart(5)} ms ${k}`)
    const dtop = [...detail.entries()].sort((a, c) => c[1] - a[1]).slice(0, 7).map(([k, v]) => `${(v / 1000).toFixed(0).padStart(5)} ms ${k}`)
    const st = (await p.evaluate(() => window.__st)); const before = st.filter((x) => x[0] <= at).at(-1), after = st.find((x) => x[0] >= at + dur); const stateTxt = `state before: ${before ? before.slice(1).join('/') : '?'} | after: ${after ? after.slice(1).join('/') : '?'}`
    out.push([`--- task at ${Math.round(at)} ms, ${Math.round(dur)} ms long  (${stateTxt})`, '  exclusive by event:', ...top.map((x) => '   ' + x), '  calls:', ...dtop.map((x) => '   ' + x), ...(invTop.length ? ['  invalidations:', ...invTop.map((x) => '   ' + x)] : []), ...(lay.length ? ['  layout events:', ...lay.map((x) => '   ' + x)] : []), ...jsTop].join('\n'))
  }
  console.log(`${STEP}: ${lts.length} tasks >= ${MIN} ms: ${lts.map(([, d]) => Math.round(d)).join(', ')}`); console.log(out.join('\n')); await b.close(); process.exit(0)
}
const prof = (await cdp.send('Profiler.stop')).profile
const nodes = new Map(prof.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
// sample times (ms, on the page's performance.now scale)
const times = []; let acc = prof.startTime; for (const d of prof.timeDeltas) { acc += d; times.push((acc - prof.startTime) / 1000 + t0) }
console.log(`${STEP}: ${lts.length} tasks >= ${MIN} ms: ${lts.map(([, d]) => Math.round(d)).join(', ')}`)
const out = []
for (const [at, dur] of lts) {
  const incl = new Map(), self = new Map(); let n = 0
  for (let i = 0; i < times.length; i++) {
    if (times[i] < at - 5 || times[i] > at + dur + 5) continue
    n++; const dt = prof.timeDeltas[i] / 1000; const node = nodes.get(prof.samples[i]); const lab = label(node.callFrame)
    if (!/^\((root|program|idle|garbage collector)\)/.test(lab)) self.set(lab, (self.get(lab) ?? 0) + dt); else self.set(lab, (self.get(lab) ?? 0) + dt)
    const seen = new Set()
    for (let id = node.id; id; id = parent.get(id)) { const l = label(nodes.get(id).callFrame); if (seen.has(l) || /^\((root|program|idle)\)/.test(l)) continue; seen.add(l); incl.set(l, (incl.get(l) ?? 0) + dt) }
  }
  const top = (m, k) => [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, k).map(([l, v]) => `${v.toFixed(0).padStart(5)} ms ${l}`)
  const block = [`--- task at ${Math.round(at)} ms, ${Math.round(dur)} ms long (${n} samples)`, '  inclusive:', ...top(incl, 9).map((x) => '   ' + x), '  self:', ...top(self, 7).map((x) => '   ' + x)]
  out.push(block.join('\n'))
}
console.log(out.join('\n'))
if (flag('timeline', '')) {
  // the longest task, in 20 ms buckets: the frames at the top of the stack that held the time (JS frames by their source line, natives by name)
  const [at, dur] = lts.slice().sort((a, c) => c[1] - a[1])[0]; const B = 20, bk = new Map()
  for (let i = 0; i < times.length; i++) {
    if (times[i] < at || times[i] > at + dur) continue
    const k = Math.floor((times[i] - at) / B); const n = nodes.get(prof.samples[i]); const chain = []
    for (let id = n.id; id && chain.length < 4; id = parent.get(id)) chain.push(label(nodes.get(id).callFrame).replace(/^\[native\] /, '').replace(/ @ src\/casefile\/phone\//, ' @ '))
    const key = chain.join(' < '); const m = bk.get(k) ?? new Map(); m.set(key, (m.get(key) ?? 0) + prof.timeDeltas[i] / 1000); bk.set(k, m)
  }
  for (const [k, m] of [...bk.entries()].sort((a, c) => a[0] - c[0])) console.log(String(k * B).padStart(4), [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, 2).map(([l, v]) => v.toFixed(0) + 'ms ' + l).join(' | '))
}
await b.close()
