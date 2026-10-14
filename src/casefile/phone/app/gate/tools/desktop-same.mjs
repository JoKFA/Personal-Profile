// The desktop's first paint and final paint must be the same with and without the phone's first-paint changes (index.html body bgcolor, prerender.css phone rules).
// A = the build before (BASE_A), B = the build after (BASE_B). Screens: the prerendered page with scripting off (the first paint's HTML and CSS) at three non-touch sizes, and the entry page
// with reduced motion (the sealed print, a settled frame) at 1440 x 900 with the parts that hold the clock and the visitor's own readings painted over.
//   node desktop-same.mjs <outDir> [--a=http://127.0.0.1:4197] [--b=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const A = flag('a', 'http://127.0.0.1:4197'), B = flag('b', 'http://127.0.0.1:4196')
fs.mkdirSync(OUT, { recursive: true })
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
const shots = []
for (const [tag, base] of [['A', A], ['B', B]]) {
  const b = await chromium.launch({ channel: 'chrome', args: GPU })
  for (const [W, H] of [[1440, 900], [1024, 768], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, javaScriptEnabled: false })
    const p = await ctx.newPage(); await p.goto(`${base}/`, { waitUntil: 'load' }); await p.waitForTimeout(300)
    const f = path.join(OUT, `${tag}-nojs-${W}x${H}.png`); await p.screenshot({ path: f, fullPage: true }); shots.push(f); await ctx.close()
  }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const p = await ctx.newPage(); await p.goto(`${base}/?intro`, { waitUntil: 'load' })
  await p.waitForSelector('.gate .gate-skip'); await p.waitForTimeout(1500)
  // the entry page carries the visitor's own readings and a recon time: paint those boxes over (same boxes in both builds)
  await p.evaluate(() => { for (const e of document.querySelectorAll('.fp-exh, .fp-mi, .fp-phase, .fp-hash')) { const s = e.style; s.visibility = 'hidden' } })
  const f = path.join(OUT, `${tag}-gate-1440x900.png`); await p.screenshot({ path: f }); shots.push(f)
  await b.close()
}
console.log(shots.join('\n'))
