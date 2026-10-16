// P6c: when the entry page can be held, at 4x CPU: from the navigation start to the first frame in which the gate is visible (the same mark as gate/tools/run.mjs).
//   node p6-gate.mjs <outFile.json> --base=http://127.0.0.1:4198 [--rate=4] [--net=none|4g|slow] [--size=390x664]   (--net: first byte to the gate's first visible frame under the P4 network profiles)
import fs from 'node:fs'
import { launch } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4198'), RATE = Number(flag('rate', 4)), [W, H] = flag('size', '390x664').split('x').map(Number)
const { b, ctx, p, cdp } = await launch(W, H, { gate: true })
await ctx.addInitScript(() => {
  const S = window.__g = { visibleAt: 0, holdableAt: 0, long: [] }
  new PerformanceObserver((l) => { for (const e of l.getEntries()) S.long.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true })
  const tick = (now) => { if (!S.visibleAt) { const g = document.querySelector('.ph-gate'); if (g && g.style.visibility === 'visible') S.visibleAt = Math.round(now) } if (!S.holdableAt && document.querySelector('.ph-gate .fp-hold') && S.visibleAt) S.holdableAt = Math.round(now); if (!S.holdableAt) requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE })
const NET = flag('net', 'none'), PROFILES = { 4: null, none: null, '4g': { latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 9e6 / 8 }, slow: { latency: 400, downloadThroughput: 400e3 / 8, uploadThroughput: 400e3 / 8 } }
if (PROFILES[NET]) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...PROFILES[NET] }) }
await p.goto(`${BASE}/`, { waitUntil: 'commit' })
await p.waitForFunction(() => window.__g && window.__g.holdableAt > 0, null, { timeout: 240000 })
await p.waitForTimeout(1500)
const r = await p.evaluate(() => ({ ...window.__g, fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0), responseStart: Math.round(performance.getEntriesByType('navigation')[0].responseStart) }))
fs.writeFileSync(OUT, JSON.stringify(r))
console.log(JSON.stringify({ net: NET, visibleAt: r.visibleAt, responseStart: r.responseStart, firstByteToGate: r.visibleAt - r.responseStart, fcp: r.fcp }))
await b.close()
