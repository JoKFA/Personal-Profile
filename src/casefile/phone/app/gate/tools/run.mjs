// P4 acceptance run: one path through the entry page (hold | auto | skip | pause), real time, Chrome (channel:'chrome'), isMobile + touch, DPR 3,
// optionally under a network profile (CDP Network.emulateNetworkConditions). Needs a production build served with the CSP (vite preview).
//   node run.mjs <outDir> --path=hold [--net=none|4g|slow] [--size=390x664] [--base=http://127.0.0.1:4196] [--query=&phone-reject] [--tag=name] [--hold-ms=...]
// Writes: result-<tag>.json (the numbers), screencast-<tag>/s-NNNN-<ts>.jpg (the compositor's frames, for scan.py), sheet-<tag>.jpg (a frame every 0.25 s).
import fs from 'node:fs'
import path from 'node:path'
import { launch, until } from '../../dev/lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), PATH = flag('path', 'hold'), NET = flag('net', 'none'), QUERY = flag('query', ''), TAG = flag('tag', `${PATH}-${NET}`)
const [W, H] = flag('size', '390x664').split('x').map(Number), SC = Number(flag('sc', 1))   // --sc=2: the screencast at 2x (the name strip)
const PROFILES = { none: null, '4g': { latency: 60, downloadThroughput: (9e6 / 8), uploadThroughput: (9e6 / 8) }, slow: { latency: 400, downloadThroughput: (400e3 / 8), uploadThroughput: (400e3 / 8) } }
fs.mkdirSync(OUT, { recursive: true })

const initScript = () => {
  const S = { gateVisibleAt: 0, raf: [], gaps: [], fontAt: [] }
  window.__g = S
  // when a web font arrives and the text it sets is drawn again (the name swaps from the system font to Manrope)
  document.fonts.addEventListener('loadingdone', (e) => S.fontAt.push([Math.round(performance.now()), e.fontfaces.map((f) => f.family + ' ' + f.weight).join(',')]))
  let last = 0
  const tick = (now) => {
    requestAnimationFrame(tick)
    if (last && now - last > 50) S.gaps.push([Math.round(now), Math.round(now - last)])
    last = now
    if (!S.gateVisibleAt) { const g = document.querySelector('.ph-gate'); if (g && g.style.visibility === 'visible') S.gateVisibleAt = now }
  }
  requestAnimationFrame(tick)
}

const { b, ctx, p, cdp, errs } = await launch(W, H, { gate: true })
await ctx.addInitScript(initScript)
const shots = []
cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
const csp = []
p.on('console', (m) => { if (/Content Security Policy|securitypolicy/i.test(m.text())) csp.push(m.text().slice(0, 200)) })
const reqs = [], byId = new Map()
await cdp.send('Network.enable')
// every request: when it was asked for, when its last byte arrived, how many bytes crossed the wire (monotonic seconds, made relative below)
cdp.on('Network.requestWillBeSent', (e) => { const r = { url: e.request.url.replace(BASE, ''), type: e.type, t0: e.timestamp }; byId.set(e.requestId, r); reqs.push(r) })
cdp.on('Network.responseReceived', (e) => { const r = byId.get(e.requestId); if (r) { r.status = e.response.status; r.tFirst = e.timestamp } })
cdp.on('Network.loadingFinished', (e) => { const r = byId.get(e.requestId); if (r) { r.t1 = e.timestamp; r.bytes = e.encodedDataLength } })
const prof = PROFILES[NET]
if (prof) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...prof })
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W * SC, maxHeight: H * SC, everyNthFrame: 1 })

const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const T0 = Date.now()
await p.goto(`${BASE}/?phone-app&phone-expose${QUERY}`, { waitUntil: 'commit' })
await until(p, () => window.__g && window.__g.gateVisibleAt > 0, undefined, 240000)
const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { responseStart: n.responseStart, domContentLoaded: n.domContentLoadedEventEnd, gateVisibleAt: window.__g.gateVisibleAt } })
const rec = { tag: TAG, path: PATH, net: NET, size: `${W}x${H}`, nav, events: {} }
const printBox = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
const [px, py, pw, ph_] = printBox, cx = px + pw / 2, cy = py + ph_ / 2
const now = () => p.evaluate(() => performance.now())

if (PATH === 'hold') {
  await p.waitForTimeout(Number(flag('lead-ms', 800)))
  rec.events.pressAt = await now()
  await touch('touchStart', cx, cy)
  await until(p, () => !!window.__phone && window.__phone.entry && window.__phone.entry.sealedAt > 0, undefined, 240000)
  await touch('touchEnd')
} else if (PATH === 'pause') {
  // press, release early (pause exactly where it is), wait, press again and complete
  await p.waitForTimeout(600)
  rec.events.pressAt = await now(); await touch('touchStart', cx, cy)
  await p.waitForTimeout(Number(flag('hold-ms', 700))); await touch('touchEnd'); rec.events.releaseAt = await now()
  const a = await p.evaluate(() => document.querySelector('.ph-gate .fp-cap').textContent); void a
  await p.waitForTimeout(1500)   // < 3 s: no auto play yet
  rec.events.autoStartedWhilePaused = await p.evaluate(() => ({ phase: document.querySelector('.ph-gate').dataset.phase, sealed: !!(window.__phone && window.__phone.entry && window.__phone.entry.sealedAt) }))
  rec.events.pressAgainAt = await now(); await touch('touchStart', cx, cy + 10)
  await until(p, () => !!window.__phone && window.__phone.entry && window.__phone.entry.sealedAt > 0, undefined, 240000)
  await touch('touchEnd')
} else if (PATH === 'skip') {
  await p.waitForTimeout(Number(flag('lead-ms', 1000)))
  const bb = await p.locator('.ph-gate .gate-skip').boundingBox()
  rec.events.pressAt = await now()
  await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
} else if (PATH === 'auto') {
  rec.events.idleFrom = await now()   // no touch at all
}
await until(p, () => !!window.__phone && window.__phone.entry && window.__phone.entry.sealedAt > 0, undefined, 240000)
// the cover: the entrance has played (or cross-faded) and the paper has risen
await until(p, () => !!window.__phone && window.__phone.entry.coverAt > 0, undefined, 240000)
const coverAt = await now()
await p.waitForTimeout(1500)
await p.screenshot({ path: path.join(OUT, `final-${TAG}.png`) })
await cdp.send('Page.stopScreencast')
const A = await p.evaluate(() => {
  const ph = window.__phone, st = ph.stage
  return { timeOrigin: performance.timeOrigin, entry: { ...ph.entry }, mode: st.mode, rejects: st.rejects, fades: st.fades, handoffs: st.handoffs, csp: ph.csp, gaps: window.__g.gaps, fontAt: window.__g.fontAt, gateGone: !document.querySelector('.ph-gate'), yw: localStorage.getItem('yw.entry'), cover: { phase: ph.phase, at: ph.at } }
})
const E = A.entry
const waitMs = E.firstFrameAt && E.sealedAt ? E.firstFrameAt - E.sealedAt : null
rec.timeOrigin = A.timeOrigin; rec.entry = E; rec.mode = A.mode; rec.rejects = A.rejects; rec.fades = A.fades; rec.gateGone = A.gateGone; rec.yw = A.yw; rec.cover = A.cover
rec.handoffs = A.handoffs.map((h) => ({ clip: h.clip, via: h.via, playToFirstMs: +(h.firstFrameAt - h.playAt).toFixed(1), clipMs: +(h.endAt - h.firstFrameAt).toFixed(0), stillUnderVideoMs: +(h.stillShownAt - h.endAt).toFixed(2) }))
rec.numbers = {
  firstByteToGateVisibleMs: +(nav.gateVisibleAt - nav.responseStart).toFixed(0),
  navToGateVisibleMs: +nav.gateVisibleAt.toFixed(0),
  sealedAtMs: +E.sealedAt.toFixed(0),
  holdCompletedToEntranceFirstFrameMs: waitMs === null ? null : +waitMs.toFixed(0),
  clipWaitMs: +E.clipWaitMs.toFixed(0), via: E.via,
  pressToSealMs: rec.events.pressAt ? +(E.sealedAt - rec.events.pressAt).toFixed(0) : null,
  navToCoverReadableMs: +(E.coverAt + 400 - 0).toFixed(0),
  rafGapsOver50ms: A.gaps.length, worstGapMs: A.gaps.reduce((m, g) => Math.max(m, g[1]), 0),
}
rec.csp = [...A.csp, ...csp]; rec.errs = errs; rec.gaps = A.gaps; rec.fontAt = A.fontAt
const base0 = reqs.length ? Math.min(...reqs.map((r) => r.t0)) : 0
rec.requests = reqs.filter((r) => r.t1).map((r) => ({ url: r.url.slice(0, 70), status: r.status, startMs: Math.round((r.t0 - base0) * 1000), firstByteMs: Math.round(((r.tFirst ?? r.t1) - base0) * 1000), endMs: Math.round((r.t1 - base0) * 1000), bytes: r.bytes }))
const d = path.join(OUT, `screencast-${TAG}`); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true })
shots.forEach((s, i) => fs.writeFileSync(path.join(d, `s-${String(i).padStart(4, '0')}-${s.ts.toFixed(4)}.jpg`), Buffer.from(s.data, 'base64')))
rec.screencastFrames = shots.length
rec.wallMs = Date.now() - T0
fs.writeFileSync(path.join(OUT, `result-${TAG}.json`), JSON.stringify(rec, null, 1))
console.log(JSON.stringify({ tag: TAG, numbers: rec.numbers, mode: A.mode, gateGone: A.gateGone, csp: rec.csp.length, errs: errs.length, frames: shots.length }, null, 1))
await b.close()
void coverAt
