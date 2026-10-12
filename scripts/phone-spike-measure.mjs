// P0.3 handoff / DOM-sync measurements on the spike page (?phone-spike).
// node scripts/phone-spike-measure.mjs <chrome|msedge|webkit|chromium> <outDir> [--assets=frozen] [--cold] [--base=http://127.0.0.1:5194] [--dsf=3]
// In-page: every rAF the visible layers are composited on a small canvas over a magenta sentinel (a hole, a black or a white frame is caught),
// every presented video frame is thumbnailed inside requestVideoFrameCallback and matched against the clip's own frames (seek-decoded).
// Chromium also records the compositor with CDP screencast (frames saved as JPEG, scanned by phone-spike-scan.py).
import { chromium, webkit } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [kind, OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d }
const COLD = rest.includes('--cold'), ASSETS = flag('assets', ''), BASE = flag('base', 'http://127.0.0.1:5194'), DSF = Number(flag('dsf', 3)), RUNS = Number(flag('runs', 2)), LEAD = flag('lead', '')
fs.mkdirSync(OUT, { recursive: true })
const tag = `${kind}${ASSETS ? '-' + ASSETS : ''}${COLD ? '-cold' : ''}${LEAD ? '-lead' + LEAD : ''}`
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

const initScript = () => {
  const S = { raf: [], rvfc: [], gaps: 0 }
  window.__m = S
  S.csp = []
  document.addEventListener('securitypolicyviolation', (e) => S.csp.push(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber))
  const cv = document.createElement('canvas'); cv.width = 39; cv.height = 87
  const g = cv.getContext('2d', { willReadFrequently: true })
  const th = document.createElement('canvas'); th.width = 24; th.height = 54
  const tg = th.getContext('2d', { willReadFrequently: true })
  const gray = (ctx, n) => { const d = ctx.getImageData(0, 0, 24, 54).data, o = new Uint8Array(24 * 54); for (let i = 0; i < o.length; i++) o[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0; return n ? Array.from(o) : o }
  S.gray = gray; S.tg = tg
  // thumbnail of every presented frame, taken inside the callback
  const orig = HTMLVideoElement.prototype.requestVideoFrameCallback
  if (orig) HTMLVideoElement.prototype.requestVideoFrameCallback = function (cb) {
    return orig.call(this, (now, meta) => {
      try { tg.drawImage(this, 0, 0, 24, 54); S.rvfc.push({ mediaTime: meta.mediaTime, presented: meta.presentedFrames, now, sig: gray(tg, true), src: this.dataset.layer }) } catch { /* */ }
      cb(now, meta)
    })
  }
  let last = 0
  const tick = (now) => {
    requestAnimationFrame(tick)
    if (last && now - last > 50) S.gaps++
    last = now
    // no requestVideoFrameCallback (Playwright's WebKit build): sample the video's clock each animation frame instead (a proxy)
    if (!orig) for (const v of document.querySelectorAll('video[data-layer]')) {
      if (v.__lt === undefined) v.__lt = v.currentTime
      if (v.currentTime !== v.__lt) { v.__lt = v.currentTime; try { tg.drawImage(v, 0, 0, 24, 54); S.rvfc.push({ mediaTime: v.currentTime, presented: 0, now, sig: gray(tg, true), src: v.dataset.layer }) } catch { /* */ } }
    }
    const sp = window.__spike; if (!sp || !sp.layers) return
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 39, 87)
    // from the top down until a layer is opaque: what is below it cannot be seen, so only what can be seen is drawn (bottom first) and checked
    const all = sp.layers().slice().reverse(), ls = [], notes = []
    for (const l of all) { ls.push(l); const ok = l.el.tagName === 'IMG' ? (l.el.complete && l.el.naturalWidth > 0) : l.el.readyState >= 2; if (l.alpha >= 0.99 && ok) break }
    ls.reverse()
    for (const l of ls) {
      g.globalAlpha = l.alpha
      const ok = l.el.tagName === 'IMG' ? (l.el.complete && l.el.naturalWidth > 0) : l.el.readyState >= 2
      if (!ok) notes.push('not-ready:' + l.name)
      try { g.drawImage(l.el, 0, 0, 39, 87) } catch { notes.push('draw-fail:' + l.name) }
    }
    g.globalAlpha = 1
    const d = g.getImageData(0, 0, 39, 87).data; let holes = 0, sum = 0
    for (let i = 0; i < d.length; i += 4) { if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200) holes++; sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 }
    S.raf.push({ t: now, state: sp.state, layers: ls.map((l) => l.name + ':' + l.alpha.toFixed(2)).join('|'), lum: sum / (d.length / 4), holes: holes / (d.length / 4), notes: notes.join(',') })
  }
  requestAnimationFrame(tick)
}

const browserType = kind === 'webkit' ? webkit : chromium
const launchOpts = kind === 'webkit' ? {} : kind === 'chromium' ? { args: GPU } : { channel: kind, args: GPU }
const b = await browserType.launch(launchOpts)
const ctxOpts = { viewport: { width: 390, height: 866 }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true }
if (kind === 'webkit') ctxOpts.recordVideo = { dir: path.join(OUT, `video-${tag}`), size: { width: 390, height: 866 } }
const ctx = await b.newContext(ctxOpts)
await ctx.addInitScript(initScript)
const p = await ctx.newPage(); p.setDefaultTimeout(60000)
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) }); p.on('response', (r) => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()) })
const info = { kind, tag, ua: await p.evaluate(() => navigator.userAgent), version: b.version() }

// codec probe first (plan H2 / PM note 2): can this browser play the H.264 mp4 at all?
await p.goto(`${BASE}/phone-spike/manifest.json`)
info.probe = await p.evaluate(async (dir) => {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = dir + 'pan-YW-000-X-001.mp4'
  const r = { canPlay: v.canPlayType('video/mp4; codecs="avc1.640028"'), rvfc: 'requestVideoFrameCallback' in v }
  document.body.appendChild(v)
  await new Promise((res) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', res, { once: true }); setTimeout(res, 8000) })
  r.readyState = v.readyState; r.error = v.error ? v.error.code + ':' + v.error.message : null; r.videoWidth = v.videoWidth
  if (v.readyState >= 2) {
    let got = 0; const c = document.createElement('canvas'); c.width = 24; c.height = 54; const g = c.getContext('2d')
    const done = new Promise((res) => { const f = () => { got++; if (got >= 3) res(); else v.requestVideoFrameCallback ? v.requestVideoFrameCallback(f) : requestAnimationFrame(f) }; v.requestVideoFrameCallback ? v.requestVideoFrameCallback(f) : requestAnimationFrame(f) })
    await v.play().catch((e) => { r.playError = String(e) }); await Promise.race([done, new Promise((res) => setTimeout(res, 3000))])
    g.drawImage(v, 0, 0, 24, 54); const d = g.getImageData(0, 0, 24, 54).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]
    r.presentedCallbacks = got; r.currentTime = v.currentTime; r.meanRGB = s / (d.length / 4 * 3)
  }
  v.remove(); return r
}, '/phone-spike/')
console.log('probe', JSON.stringify(info.probe))
if (!info.probe.readyState || info.probe.readyState < 2) { info.skipped = 'the browser cannot decode the H.264 mp4'; fs.writeFileSync(path.join(OUT, `result-${tag}.json`), JSON.stringify(info, null, 1)); await ctx.close(); await b.close(); process.exit(0) }

await p.goto(`${BASE}/?phone-spike${ASSETS ? '&assets=' + ASSETS : ''}${COLD ? '&cold' : ''}${LEAD ? '&lead=' + LEAD : ''}`, { waitUntil: 'load' })
await p.waitForFunction(() => window.__spike && window.__spike.ready)

// Chromium: CDP screencast of the compositor
let cdp = null; const shots = []
if (kind !== 'webkit') {
  cdp = await ctx.newCDPSession(p)
  cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
}
const swipe = async () => {
  if (cdp) {
    const x = 195; const t = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    await t('touchStart', 600); for (let y = 600; y >= 440; y -= 20) { await t('touchMove', y); await p.waitForTimeout(8) } await t('touchEnd')
  } else { await p.mouse.move(195, 600); await p.mouse.down(); for (let y = 600; y >= 440; y -= 20) { await p.mouse.move(195, y); await p.waitForTimeout(8) } await p.mouse.up() }
}
const tap = async (id) => { const bb = await p.locator(`.sp-btn[data-id="${id}"]`).boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }
const waitState = (st) => p.waitForFunction((s) => window.__spike.state === s, st, { timeout: 30000 })

const runs = []
for (let r = 0; r < RUNS; r++) {
  if (cdp) await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 390, maxHeight: 866, everyNthFrame: 1 })
  await p.waitForTimeout(400)
  await swipe(); await waitState('x001'); await p.waitForTimeout(500)
  await tap('open'); await waitState('window'); await p.waitForTimeout(500)
  if (cdp) await cdp.send('Page.stopScreencast')
  await tap('reset'); await waitState('cover'); await p.waitForTimeout(600)
  runs.push({ r })
}

// reference signatures: the open / pan clips decoded by seeking, thumbnailed the same way
const analysis = await p.evaluate(async () => {
  const S = window.__m, sp = window.__spike, man = sp.manifest, fps = man.fps
  const refs = {}
  for (const [key, name] of [['pan', 'pan-YW-000-X-001'], ['open', 'open-X-001']]) {
    const a = man.assets[name], v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.src = '/phone-spike/' + (new URLSearchParams(location.search).get('assets') ? new URLSearchParams(location.search).get('assets') + '/' : '') + a.file
    await new Promise((res) => v.addEventListener('loadeddata', res, { once: true }))
    const list = []
    for (let i = 0; i < a.frames; i++) {
      v.currentTime = (i + 0.5) / fps; await new Promise((res) => v.addEventListener('seeked', res, { once: true }))
      S.tg.drawImage(v, 0, 0, 24, 54); list.push(S.gray(S.tg, true))
    }
    refs[key] = list
  }
  const l1 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length }
  const sync = []
  for (const f of S.rvfc) {
    const key = f.src, list = refs[key]; if (!list) continue
    const implied = Math.round(f.mediaTime * fps)
    let best = 0, bd = Infinity; list.forEach((r, i) => { const d = l1(f.sig, r); if (d < bd) { bd = d; best = i } })
    const di = l1(f.sig, list[Math.min(list.length - 1, implied)])
    sync.push({ clip: key, mediaTime: f.mediaTime, implied, best, dBest: bd, dImplied: di, ambiguous: best !== implied && di - bd < 0.15 })
  }
  // the DOM's side: the quad index each presented frame drove the marks with (recorded by the stage)
  const used = sp.frames.map((f) => ({ clip: f.clip, mediaTime: f.mediaTime, index: f.index, quadIndex: f.quadIndex }))
  // pop at the end of each clip: the clip's last frame vs the still it hands over to, both decoded by this browser, at 1/2 scale
  const pops = {}
  const cmp = async (clipName, still) => {
    const a = man.assets[clipName], v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'
    const dir = '/phone-spike/' + (new URLSearchParams(location.search).get('assets') ? new URLSearchParams(location.search).get('assets') + '/' : '')
    v.src = dir + a.file; await new Promise((res) => v.addEventListener('loadeddata', res, { once: true }))
    const img = new Image(); img.src = dir + still; await img.decode()
    const W = 195, H = 433, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d', { willReadFrequently: true })] }
    const out = {}
    for (const [label, t] of [['first', 0.5 / fps], ['last', (a.frames - 0.5) / fps]]) {
      v.currentTime = t; await new Promise((res) => v.addEventListener('seeked', res, { once: true }))
      const [c1, g1] = mk(), [c2, g2] = mk(); g1.drawImage(v, 0, 0, W, H); g2.drawImage(img, 0, 0, W, H)
      const d1 = g1.getImageData(0, 0, W, H).data, d2 = g2.getImageData(0, 0, W, H).data; let s = 0, sl = 0
      for (let i = 0; i < d1.length; i += 4) { s += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]); sl += (d1[i] * 0.3 + d1[i + 1] * 0.59 + d1[i + 2] * 0.11) - (d2[i] * 0.3 + d2[i + 1] * 0.59 + d2[i + 2] * 0.11) }
      out[label] = { madPct: s / (d1.length / 4 * 3) / 255 * 100, meanLumaDelta: sl / (d1.length / 4) }
    }
    return out
  }
  pops.panFirstVsCover = (await cmp('pan-YW-000-X-001', 'stop-YW-000.webp')).first
  pops.panLastVsX001 = (await cmp('pan-YW-000-X-001', 'stop-X-001.webp')).last
  pops.openFirstVsX001 = (await cmp('open-X-001', 'stop-X-001.webp')).first
  pops.openLastVsWindow = (await cmp('open-X-001', 'window-X-001.webp')).last
  return { sync, used, pops, handoffs: sp.handoffs, csp: [...sp.csp, ...S.csp], raf: S.raf, gaps: S.gaps }
})

// summarise
const lum = analysis.raf.filter((x) => x.layers && x.state !== 'loading')   // 'loading': the page's own paper background shows, before the cover is ready
const bad = lum.filter((x) => x.holes > 0 || x.lum < 40 || x.lum > 250 || x.notes)
const syncOf = (clip) => analysis.sync.filter((s) => s.clip === clip)
const mism = (clip) => syncOf(clip).filter((s) => !s.ambiguous && s.best !== s.implied)
const missing = (clip, n) => { const got = new Set(syncOf(clip).map((s) => s.implied)); return [...Array(n).keys()].filter((i) => !got.has(i)) }
const usedMismatch = analysis.used.filter((u) => u.index !== u.quadIndex && u.index >= 0 && u.index <= 49).length
const summary = {
  frames: { rafSamples: lum.length, lumMin: Math.min(...lum.map((x) => x.lum)), lumMax: Math.max(...lum.map((x) => x.lum)), blank: bad.length, blankSamples: bad.slice(0, 10), rafGapsOver50ms: analysis.gaps },
  handoffs: analysis.handoffs.map((h) => ({ clip: h.clip, latencyMs: +h.latencyMs.toFixed(1), playToFirstMs: +(h.firstFrameAt - h.playAt).toFixed(1), clipDurationMs: +(h.endAt - h.firstFrameAt).toFixed(0), stillUnderVideoMs: +(h.stillShownAt - h.endAt).toFixed(2) })),
  sync: ['open-X-001', 'pan-YW-000-X-001'].map((c) => { const k = c.startsWith('open') ? 'open' : 'pan'; const all = syncOf(k); return { clip: c, missingIndices: missing(k, c.startsWith('open') ? 50 : 76), presentedFrames: all.length, distinct: new Set(all.map((s) => s.implied)).size, ambiguous: all.filter((s) => s.ambiguous).length, mismatchedVsPixels: mism(k).length, mismatches: mism(k).slice(0, 8), maxAbsOff: Math.max(0, ...all.filter((s) => !s.ambiguous).map((s) => Math.abs(s.best - s.implied))) } }),
  domQuadIndexVsMediaTimeMismatch: usedMismatch,
  pops: analysis.pops, csp: analysis.csp, pageErrors: errs.slice(0, 10),
}
info.summary = summary
fs.writeFileSync(path.join(OUT, `result-${tag}.json`), JSON.stringify({ info, summary, sync: analysis.sync, used: analysis.used, rafBad: bad }, null, 1))
if (cdp) { const d = path.join(OUT, `screencast-${tag}`); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); shots.forEach((s, i) => fs.writeFileSync(path.join(d, `s-${String(i).padStart(4, '0')}-${s.ts.toFixed(4)}.jpg`), Buffer.from(s.data, 'base64'))); console.log('screencast frames', shots.length) }
console.log(JSON.stringify(summary, null, 1))
await ctx.close(); await b.close()
