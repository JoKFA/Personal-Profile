// P6a: the E1 path's cost on a phone at 4x CPU throttle.
//   A. first screen: the JS and CSS the first visit to the phone shell requests before the entry page is ready to be held (the production build, no test hooks), as gzip (and brotli) of the files on disk.
//   B. runtime (the hooks build, window.__phone): long tasks (PerformanceObserver 'longtask', > 50 ms) with the step they fell in, the decoded stills alive at each frame (max; limit 6),
//      the pool's <video> elements and the heap after the whole reel plus 3 opens (after a forced GC), and the DOM counters.
//   node p6-perf.mjs <outDir> --dist=<plain build dir> [--plain=http://127.0.0.1:4198] [--hooks=http://127.0.0.1:4196] [--size=390x664] [--rate=4]
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const DIST = flag('dist', ''), PLAIN = flag('plain', 'http://127.0.0.1:4198'), HOOKS = flag('hooks', 'http://127.0.0.1:4196'), RATE = Number(flag('rate', 4))
const [W, H] = flag('size', '390x664').split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const rep = { size: `${W}x${H}`, cpuThrottle: RATE }
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })

// ── A. first screen, bytes ──
{
  const { b, p, cdp } = await launch(W, H, { gate: true })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
  const reqs = []
  await cdp.send('Network.enable')
  cdp.on('Network.requestWillBeSent', (e) => reqs.push({ id: e.requestId, url: e.request.url, type: e.type, t: e.timestamp }))
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.find((x) => x.id === e.requestId); if (r) r.wire = e.encodedDataLength })
  const t0 = Date.now()
  await p.goto(`${PLAIN}/`, { waitUntil: 'load' })
  const shell = await p.evaluate(() => ({ gate: !!document.querySelector('.ph-gate'), phoneShell: !!document.querySelector('.ph-root, .ph-gate') }))
  await p.waitForSelector('.ph-gate .fp-hold', { timeout: 60000 }).catch(() => {})
  await p.waitForTimeout(1500)   // (the entry page is up and can be held; whatever the page asked for by now is the first screen)
  rep.firstScreen = { shell, gateReadyMs: Date.now() - t0 }
  const files = []
  for (const r of reqs) {
    if (!/\.(js|css|mjs)(\?|$)/.test(r.url)) continue
    const u = new URL(r.url); const f = path.join(DIST, decodeURIComponent(u.pathname))
    if (!fs.existsSync(f)) { files.push({ url: u.pathname, missing: true }); continue }
    const buf = fs.readFileSync(f)
    files.push({ url: u.pathname, kind: /\.css/.test(u.pathname) ? 'css' : 'js', raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, brotli: zlib.brotliCompressSync(buf).length })
  }
  const sum = (k, kind) => files.filter((x) => !x.missing && (!kind || x.kind === kind)).reduce((a, x) => a + x[k], 0)
  rep.firstScreen.files = files
  rep.firstScreen.totals = { jsGzipKB: +(sum('gzip', 'js') / 1024).toFixed(1), cssGzipKB: +(sum('gzip', 'css') / 1024).toFixed(1), totalGzipKB: +(sum('gzip') / 1024).toFixed(1), totalBrotliKB: +(sum('brotli') / 1024).toFixed(1), rawKB: +(sum('raw') / 1024).toFixed(1) }
  rep.firstScreen.budgetGzipKB = 250
  rep.firstScreen.pass = sum('gzip') / 1024 <= 250 && files.length > 0
  await b.close()
}

// ── B. runtime on the E1 path ──
{
  const { b, p, cdp, errs } = await launch(W, H, { gate: true })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
  await cdp.send('Performance.enable')
  await p.addInitScript(() => {
    window.__perf = { long: [], alive: 0, imgs: 0, vids: 0, frames: 0, slow: [], step: 'load', stepAt: [] }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), step: window.__perf.step }) }).observe({ type: 'longtask', buffered: true })
    let last = 0
    const f = (t) => {
      const P = window.__perf, ph = window.__phone
      if (last && t - last > 100) P.slow.push({ at: Math.round(t), dt: Math.round(t - last), step: P.step })
      last = t; P.frames++
      if (ph) { P.alive = Math.max(P.alive, ph.stage.stills.alive); P.imgs = Math.max(P.imgs, document.querySelectorAll('.ph-stage img, .ph-root img').length); P.vids = Math.max(P.vids, document.querySelectorAll('video').length) }
      requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  })
  const step = (s) => p.evaluate((s) => { window.__perf.step = s; window.__perf.stepAt.push([s, Math.round(performance.now())]) }, s)
  await p.goto(`${HOOKS}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1500)
  await step('entry: hold')
  const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
  await touch(cdp, 'touchStart', px + pw / 2, py + ph / 2)
  await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0); await touch(cdp, 'touchEnd')
  await step('entrance'); await until(p, () => window.__phone.entry.coverAt > 0, undefined, 120000); await p.waitForTimeout(1500)
  for (let i = 1; i <= 4; i++) { await step(`reel: stop 0${i}`); await swipe(cdp, W, H); await until(p, (n) => window.__phone.at === n && window.__phone.phase === 'settled', i, 120000); await p.waitForTimeout(1100) }
  const heap = async (label) => { await cdp.send('HeapProfiler.collectGarbage'); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value])); return { label, jsHeapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), documents: m.Documents, nodes: m.Nodes, listeners: m.JSEventListeners } }
  rep.heap = [await heap('after the full reel')]
  await step('index'); await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H, 60000); await p.waitForTimeout(900)
  const opens = ['X-004', 'SR-01', 'ED-02']
  rep.opens = []
  for (const id of opens) {
    await step(`open ${id}`)
    await p.evaluate((id) => window.__phone.openEntry(id), id)
    await until(p, () => window.__phone.phase === 'file', undefined, 120000); await p.waitForTimeout(2500)
    await step(`read ${id}`)
    const total = await p.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y + H < total; y += Math.round(H * 0.8)) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(300) }
    await step(`close ${id}`)
    await p.evaluate(() => { scrollTo(0, 0) }); await p.waitForTimeout(300)
    await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 120000); await p.waitForTimeout(1200)
    rep.opens.push(await heap(`after ${id}`))
  }
  await step('contact'); await p.locator('.ph-navb[data-go="contact"]').tap(); await p.waitForTimeout(1800)
  await step('done')
  const P = await p.evaluate(() => ({ ...window.__perf, vidEls: [...document.querySelectorAll('video')].map((v) => ({ w: v.videoWidth, h: v.videoHeight, ready: v.readyState, src: (v.currentSrc || '').split('/').pop().slice(0, 30), paused: v.paused })), stage: { stillsAlive: window.__phone.stage.stills.alive, mode: window.__phone.stage.mode } }))
  rep.longTasks = P.long; rep.longTasksOver50 = P.long.length; rep.longTaskMax = P.long.reduce((a, x) => Math.max(a, x.ms), 0)
  rep.slowFrames = P.slow
  rep.stillsAliveMax = P.alive; rep.stillsLimit = 6; rep.stillsImgElementsMax = P.imgs
  rep.pool = { videoElementsMax: P.vids, videoElementsAtEnd: P.vidEls.length, elements: P.vidEls, stage: P.stage }
  rep.steps = P.stepAt
  rep.heapSummary = { afterReel: rep.heap[0].jsHeapMB, afterThreeOpens: rep.opens.at(-1).jsHeapMB, domNodesAfterThreeOpens: rep.opens.at(-1).nodes }
  rep.errs = errs
  await b.close()
}
fs.writeFileSync(path.join(OUT, `perf-${W}x${H}-x${RATE}.json`), JSON.stringify(rep, null, 1))
console.log(JSON.stringify({ firstScreen: rep.firstScreen.totals, pass: rep.firstScreen.pass, shell: rep.firstScreen.shell, longTasks: rep.longTasks, slowFrames: rep.slowFrames.length, stillsAliveMax: rep.stillsAliveMax, imgs: rep.stillsImgElementsMax, pool: rep.pool, heap: [rep.heap[0], ...rep.opens], errs: rep.errs }, null, 1))
