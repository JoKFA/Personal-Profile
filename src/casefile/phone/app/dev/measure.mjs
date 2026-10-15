// P2 handoff / sync measurement on the production phone shell (?phone-app&phone-expose, in a VITE_HOOKS=1 build). Real time, Chrome, mobile emulation, DPR 3.
//   node src/casefile/phone/app/dev/measure.mjs <outDir> [--size=390x664] [--query=&phone-reject] [--tag=name] [--base=http://127.0.0.1:5194]
// In-page: on every animation frame the visible stage layers are composited on a small canvas over a magenta sentinel (a hole, a black or
// a white frame is caught); the stage records every presented video frame (index, DOM index) and every handoff.
// CDP screencast of the compositor is saved for scan.py (cuts, blanks) and domsync.py (marks vs picture). --stageonly / --marksonly hide parts of the page layer for the scans.
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:5194'), QUERY = flag('query', ''), TAG = flag('tag', 'run'), STAGE_ONLY = rest.includes('--stageonly'), MARKS_ONLY = rest.includes('--marksonly'), RUNS = Number(flag('runs', 2))
const PHQ = (process.env.PHQ ?? '&phone-expose').slice(1)
const [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })

const initScript = () => {
  const S = { raf: [], gaps: 0 }
  window.__m = S
  const cv = document.createElement('canvas'); cv.width = 39; cv.height = 87
  const g = cv.getContext('2d', { willReadFrequently: true })
  let last = 0
  const tick = (now) => {
    requestAnimationFrame(tick)
    if (last && now - last > 50) S.gaps++
    last = now
    const ph = window.__phone; if (!ph || !ph.stage) return
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 39, 87)
    // from the top down until a layer is opaque: what is below it cannot be seen, so only what can be seen is drawn (bottom first) and checked
    const all = ph.stage.layers().slice().reverse(), ls = [], notes = []
    const ok = (l) => l.el.tagName === 'IMG' ? (l.el.complete && l.el.naturalWidth > 0) : l.el.readyState >= 2
    for (const l of all) { ls.push(l); if (l.alpha >= 0.99 && ok(l)) break }
    ls.reverse()
    for (const l of ls) {
      g.globalAlpha = l.alpha
      if (!ok(l)) notes.push('not-ready:' + l.name)
      try { g.drawImage(l.el, 0, 0, 39, 87) } catch { notes.push('draw-fail:' + l.name) }
    }
    g.globalAlpha = 1
    const d = g.getImageData(0, 0, 39, 87).data; let holes = 0, sum = 0
    for (let i = 0; i < d.length; i += 4) { if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] > 200) holes++; sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 }
    S.raf.push({ t: now, phase: ph.phase, layers: ls.map((l) => l.name + ':' + l.alpha.toFixed(2)).join('|'), lum: sum / (d.length / 4), holes: holes / (d.length / 4), notes: notes.join(',') })
  }
  requestAnimationFrame(tick)
}

const { b, ctx, p, cdp, errs } = await launch(W, H)
await ctx.addInitScript(initScript)
const shots = []
cdp.on('Page.screencastFrame', (f) => { shots.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
await p.goto(`${BASE}/?phone-app&${PHQ}${QUERY}`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready)
await p.waitForTimeout(1500)
// the first touch primes the pool (a real tap on the page, away from any button)
await p.touchscreen.tap(W / 2, H * 0.4); await p.waitForTimeout(300)

// --stageonly: the page layer is hidden (opacity, !important, via an injected sheet: this is the dev server, no CSP) so a screencast scan sees only the pictures.
// --marksonly: only the four ink marks stay (domsync.py reads them).
if (STAGE_ONLY) await p.addStyleTag({ content: '.ph-reel, .ph-bar, .ph-reticle { opacity: 0 !important }' })
if (MARKS_ONLY) await p.addStyleTag({ content: '.ph-reel, .ph-bar, .ph-tag, .ph-rule { opacity: 0 !important }' })
const API = STAGE_ONLY || MARKS_ONLY
const rec = []
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await p.waitForTimeout(400)
for (let run = 0; run < RUNS; run++) {
  await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(700)
  if (API) await p.evaluate(() => window.__phone.openFile(1))
  else { const bb = await p.locator('.ph-go[data-id="X-001"]').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2) }
  await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(500)
  if (API) await p.evaluate(() => window.__phone.closeFile(true)); else await p.locator('.ph-back').tap()
  await until(p, () => window.__phone.phase === 'settled' && window.__phone.at === 1); await p.waitForTimeout(500)
  await swipe(cdp, W, H, 'up'); await until(p, () => window.__phone.at === 0 && window.__phone.phase === 'settled'); await p.waitForTimeout(600)
  rec.push(run)
}
await cdp.send('Page.stopScreencast')

const A = await p.evaluate(() => {
  const S = window.__m, st = window.__phone.stage
  return { timeOrigin: performance.timeOrigin, raf: S.raf, gaps: S.gaps, frames: st.frames, handoffs: st.handoffs, mode: st.mode, rejects: st.rejects, fades: st.fades, csp: window.__phone.csp, alive: st.stills.alive, fits: window.__phone.fits, winFit: window.__phone.winFit, openCam: window.__phone.manifest.open['X-001'].cam, closeCam: window.__phone.manifest.close['X-001'].cam }
})
const lum = A.raf.filter((x) => x.layers)
const bad = lum.filter((x) => x.holes > 0 || x.lum < 40 || x.lum > 250 || x.notes)
// contiguous presented frames per clip run: no skipped indices
const byClip = {}
for (const f of A.frames) (byClip[f.clip] ??= []).push(f)
const clips = Object.entries(byClip).map(([clip, fs_]) => {
  // split into runs (a new run starts when the index goes backwards)
  const runs = []; let cur = []
  for (const f of fs_) { if (cur.length && f.index < cur[cur.length - 1].index) { runs.push(cur); cur = [] } cur.push(f) }
  if (cur.length) runs.push(cur)
  return { clip, runs: runs.map((r) => { const idx = r.map((f) => f.index); const skipped = []; for (let i = 1; i < idx.length; i++) for (let k = idx[i - 1] + 1; k < idx[i]; k++) skipped.push(k); return { n: idx.length, first: idx[0], last: idx[idx.length - 1], skipped, domMinusIndex: [...new Set(r.map((f) => f.domIndex - f.index))] } }) }
})
const summary = {
  tag: TAG, size: `${W}x${H}`, query: QUERY, mode: A.mode, rejects: A.rejects, fades: A.fades, stillsAlive: A.alive,
  composites: { n: lum.length, lumMin: Math.min(...lum.map((x) => x.lum)), lumMax: Math.max(...lum.map((x) => x.lum)), blank: bad.length, blankSamples: bad.slice(0, 8), rafGapsOver50ms: A.gaps },
  handoffs: A.handoffs.map((h) => ({ clip: h.clip, via: h.via, latencyMs: +h.latencyMs.toFixed(1), playToFirstMs: +(h.firstFrameAt - h.playAt).toFixed(1), clipMs: +(h.endAt - h.firstFrameAt).toFixed(0), stillUnderVideoMs: +(h.stillShownAt - h.endAt).toFixed(2) })),
  clips, csp: A.csp, errs, screencastFrames: shots.length,
}
fs.writeFileSync(path.join(OUT, `result-${TAG}.json`), JSON.stringify({ summary, timeOrigin: A.timeOrigin, handoffsRaw: A.handoffs, fits: A.fits, winFit: A.winFit, openCam: A.openCam, closeCam: A.closeCam, rafBad: bad }, null, 1))
const d = path.join(OUT, `screencast-${TAG}`); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true })
shots.forEach((s, i) => fs.writeFileSync(path.join(d, `s-${String(i).padStart(4, '0')}-${s.ts.toFixed(4)}.jpg`), Buffer.from(s.data, 'base64')))
console.log(JSON.stringify(summary, null, 1))
await b.close()
