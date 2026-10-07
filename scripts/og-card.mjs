// Re-shoots the share card (public/og-card.jpg, 1200 x 630) from the live site: home, as a return visitor
// sees it once the callouts have faded in. Run it on a machine with a GPU, after `npm run build`:
//
//   node scripts/og-card.mjs                 → public/og-card.jpg
//   node scripts/og-card.mjs --out shots/og.jpg
//
// The page is shot at device scale 2 and brought back to 1200 x 630 by a canvas in a blank page
// (high-quality resampling, JPEG quality 85), so no image library is needed.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const out = path.resolve(arg('out', 'public/og-card.jpg'))
const W = 1200, H = 630, LONG = 120_000

// 127.0.0.1 explicitly: on Windows vite binds `localhost` to IPv6 only
const server = await preview({ preview: { host: '127.0.0.1', port: 4194, strictPort: false, open: false }, logLevel: 'silent' })
const PORT = server.httpServer.address().port
const browser = await chromium.launch({ executablePath: process.env.SHOTS_CHROMIUM || undefined, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') } catch { /* */ } })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://127.0.0.1:${PORT}/?quality=high`, { timeout: LONG })
  await page.waitForFunction(() => { const s = window.__cf?.getSnapshot(); return s?.mode === 'archive' && s.brief && !!document.querySelector('.hud.on') && !document.querySelector('.cf--arriving') }, null, { timeout: LONG, polling: 250 })
  await page.waitForSelector('.brief--lit', { timeout: LONG })
  await page.waitForTimeout(1500)   // the last callout has finished fading; the field is still
  const png = await page.screenshot()
  const helper = await ctx.newPage()
  await helper.setContent('<canvas id="c"></canvas>')
  const jpeg = await helper.evaluate(async ({ b64, w, h }) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode()
    const c = document.getElementById('c'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.85).split(',')[1]
  }, { b64: png.toString('base64'), w: W, h: H })
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, Buffer.from(jpeg, 'base64'))
  const kb = Math.round(fs.statSync(out).size / 1024)
  console.log(`og-card: ${path.relative(process.cwd(), out)} · ${W}×${H} · ${kb} KB${errors.length ? ` · page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`)
  if (kb >= 300) { console.error('og-card: over 300 KB'); process.exitCode = 1 }
} finally {
  await browser.close(); await server.close()
}
