// The desktop path must be untouched: a desktop context (no touch) loads the archive, never the phone shell.
//   node src/casefile/phone/app/dev/desktop.mjs [--base=http://127.0.0.1:5194]
import { chromium } from '@playwright/test'
const BASE = (process.argv.find((a) => a.startsWith('--base=')) ?? '--base=http://127.0.0.1:5194').slice(7)
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const out = {}
for (const [name, ctxOpts] of [['desktop 1440x900', { viewport: { width: 1440, height: 900 } }], ['touch laptop 1280x800 (hasTouch, not mobile)', { viewport: { width: 1280, height: 800 }, hasTouch: true }], ['tablet-ish 820x1180 mobile', { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }]]) {
  const ctx = await b.newContext(ctxOpts), p = await ctx.newPage(), errs = []
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  const reqs = []; p.on('request', (r) => reqs.push(new URL(r.url()).pathname))
  await p.goto(`${BASE}/?intro`, { waitUntil: 'load' }).catch(() => {})
  await p.waitForTimeout(2500)
  out[name] = await p.evaluate(() => ({ phoneShell: !!document.querySelector('.ph-root'), cf: !!document.querySelector('.cf'), cfGlobal: typeof window.__cf, coarse: matchMedia('(pointer: coarse)').matches, screen: [screen.width, screen.height], bodyClass: document.body.className }))
  out[name].errors = errs; out[name].phoneRequests = reqs.filter((r) => /phone|PhoneApp/.test(r))
  await ctx.close()
}
console.log(JSON.stringify(out, null, 1))
await b.close()
