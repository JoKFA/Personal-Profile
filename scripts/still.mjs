// Stills of the settled site at real quality, for judging light and colour without a GPU (slow but true).
// Run after `npm run build`.
//
//   node scripts/still.mjs --out shots/still                 → home, the archive (X-001), a file
//   node scripts/still.mjs --size 1280x720 --quality medium --only home,archive
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const [W, H] = arg('size', '1280x720').split('x').map(Number)
const quality = arg('quality', 'medium')
const out = path.resolve(arg('out', 'shots/still'))
const only = arg('only', 'home,archive,file').split(',')
const LONG = 30 * 60_000
fs.mkdirSync(out, { recursive: true })

const server = await preview({ preview: { port: 4193, strictPort: false, open: false }, logLevel: 'silent' })
const PORT = server.httpServer.address().port
const browser = await chromium.launch({ executablePath: process.env.SHOTS_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const fn = (page, f, a) => page.waitForFunction(f, a, { timeout: LONG, polling: 1000 })
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } })
  await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') } catch { /* */ } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(LONG)
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://127.0.0.1:${PORT}/?quality=${quality}`, { timeout: LONG })
  const settled = () => fn(page, () => { const a = window.__cf; return a && a.getSnapshot().mode === 'archive' && a.settled() && !document.querySelector('.cf--arriving') })
  await settled(); await page.waitForTimeout(4000)
  if (only.includes('home')) { await page.screenshot({ path: path.join(out, 'home.png') }); console.log('still: home') }
  if (only.includes('archive') || only.includes('file')) {
    await page.evaluate(() => { window.__cf.setBrief(false); window.__cf.jumpTo('X-001') })
    await fn(page, () => document.querySelector('.panel-id')?.textContent?.includes('X-001') && window.__cf.settled())
    await page.waitForTimeout(4000)
    if (only.includes('archive')) { await page.screenshot({ path: path.join(out, 'archive.png') }); console.log('still: archive') }
  }
  if (only.includes('file')) {
    await page.locator('.panel .go').click()
    await fn(page, () => window.__cf.getSnapshot().mode === 'file' && document.querySelector('.file-meta h1')?.textContent)
    await page.waitForTimeout(5000)
    await page.screenshot({ path: path.join(out, 'file.png') }); console.log('still: file')
  }
  if (errors.length) console.error(`still: page errors: ${errors.slice(0, 3).join(' | ')}`)
} finally {
  await browser.close(); await server.close()
}
