// P7f / D3: the requests a desktop visitor's browser makes before the first contentful paint (same list for two builds), at 1440 and 1024. One browser at a time, closed at the end.
//   node p7-reqs.mjs <out.json> --base=http://127.0.0.1:4301 [--tag=main]
import fs from 'node:fs'
import { chromium } from '@playwright/test'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4301'), TAG = flag('tag', 'build')
const res = {}
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
try {
  for (const [W, H] of [[1440, 900], [1024, 768]]) {
    for (const run of [1, 2]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H } })
      await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* */ } })
      const p = await ctx.newPage()
      await p.goto(`${BASE}/`, { waitUntil: 'commit' })
      await p.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 30000 })
      await p.waitForTimeout(1500)
      const r = await p.evaluate(() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0].startTime
        const all = performance.getEntriesByType('resource').map((e) => ({ url: new URL(e.name).pathname.replace(/-[A-Za-z0-9_-]{8}(\.[a-z0-9]+)$/, '$1'), at: Math.round(e.startTime) }))
        return { fcp: Math.round(fcp), beforeFcp: all.filter((e) => e.at <= fcp).map((e) => e.url).sort(), within1_5s: all.length }
      })
      if (run === 1) res[`${W}`] = r; else res[`${W}-run2`] = r
      await ctx.close()
    }
  }
} finally { await b.close() }
fs.writeFileSync(OUT, JSON.stringify({ tag: TAG, ...res }, null, 1))
for (const [k, v] of Object.entries(res)) console.log(TAG, k, 'fcp', v.fcp, 'before FCP:', v.beforeFcp.length, v.beforeFcp.join(' '))
