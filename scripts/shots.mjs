// Fixed screenshot set for the design review loop (docs/curation-plan.md §3).
// Run after `npm run build`. Every round shoots the same frames, so scores compare across commits.
//
//   node scripts/shots.mjs                      → shots/<commit>/, low quality (no GPU needed)
//   node scripts/shots.mjs --quality high       → real quality on a GPU machine (ANGLE d3d11, as in e2e)
//   node scripts/shots.mjs --only F3,F7          → a subset
//   node scripts/shots.mjs --query entry=c --out shots/entry-c   → extra URL parameters (prototypes)
//   SHOTS_CHROMIUM=/path/to/chrome node scripts/shots.mjs
//
// Low quality uses SwiftShader with `?quality=low` and reduced motion: the layout and the copy are
// right, the light is not. Judge light on a GPU.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const quality = arg('quality', 'low')
const low = quality === 'low'
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' } })()
const out = path.resolve(arg('out', `shots/${commit}`))
const only = arg('only', '')?.split(',').filter(Boolean)
const query = new URLSearchParams(arg('query', ''))
const PORT = 4181
const LONG = 15 * 60_000   // SwiftShader can take minutes per frame

const dist = path.resolve('dist')
const home = fs.existsSync(path.join(dist, 'index.html')) ? fs.readFileSync(path.join(dist, 'index.html'), 'utf8') : ''
if (!home.includes('class="prerender"')) { console.error('shots: run `npm run build` first (dist/ has no prerendered pages)'); process.exit(1) }

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

// ── what each frame waits for ──
const at = (ms) => async (page, t0) => { const wait = ms - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait) }
const fn = (page, f, arg) => page.waitForFunction(f, arg, { timeout: LONG, polling: 1000 })
const archiveUp = async (page) => {
  await fn(page, () => { const a = window.__cf; return a && a.getSnapshot().mode === 'archive' && a.settled() && document.querySelector('.hud.on') && !document.querySelector('.cf--arriving') })
  await page.waitForTimeout(1500)
}
const landed = async (page) => {
  // a first visit: leave the entry; the entrance then settles in the archive or opens the subject file by itself
  await page.locator('.gate-skip').click({ timeout: LONG })
  await fn(page, () => {
    const a = window.__cf, s = a?.getSnapshot()
    return !document.querySelector('.gate') && s && ((s.mode === 'file' && document.querySelector('.file-meta h1')?.textContent) || (s.mode === 'archive' && a.settled() && !document.querySelector('.cf--arriving')))
  })
  await page.waitForTimeout(4000)
}
// each frame also works on its own (`--only F5`): it first waits for the archive
const panel = (id) => async (page) => {
  await archiveUp(page)
  await page.evaluate((id) => window.__cf.jumpTo(id), id)
  await fn(page, (id) => document.querySelector('.panel-id')?.textContent?.includes(id) && window.__cf.settled(), id)
  await page.waitForTimeout(1500)
}
const index = async (page) => {
  await archiveUp(page)
  await page.locator('.hud-index-btn', { hasText: 'Index' }).click({ timeout: LONG })
  await page.locator('.index[role="dialog"]').waitFor({ timeout: LONG })
  await page.waitForTimeout(600)
}
const fileUp = async (page) => {
  await fn(page, () => window.__cf?.getSnapshot().mode === 'file' && document.querySelector('.file-meta h1')?.textContent)
  await page.waitForTimeout(2500)
}

// Frames in one group share a page (the scene is built once). `first` = a first visit; otherwise a
// returning visitor who has seen the entry and the key hint.
const GROUPS = [
  { vp: DESK, first: true, motion: true, frames: [['F1-desk', at(1500)], ['F2-desk', at(5000)]] },
  { vp: PHONE, first: true, motion: true, frames: [['F1-phone', at(1500)], ['F2-phone', at(5000)]] },
  { vp: DESK, first: true, frames: [['F3-desk', landed]] },
  { vp: PHONE, first: true, frames: [['F3-phone', landed]] },
  { vp: DESK, frames: [['F4-desk', archiveUp], ['F5-desk', panel('X-001')], ['F6-desk', index]] },
  { vp: PHONE, frames: [['F4-phone', archiveUp]] },
  { vp: DESK, path: '/projects/mcp-security-framework', frames: [['F7-desk', fileUp]] },
  { vp: PHONE, path: '/projects/mcp-security-framework', frames: [['F7-phone', fileUp]] },
  { vp: DESK, path: '/projects/coast-capital', frames: [['F8-desk', fileUp]] },
].map((g) => ({ ...g, frames: g.frames.filter(([id]) => !only?.length || only.includes(id.split('-')[0])) })).filter((g) => g.frames.length)

// what crawlers, link previews and AI summaries read: the home page without JavaScript
function homeText() {
  const main = home.match(/<main class="prerender">([\s\S]*?)<\/main>/)?.[1] ?? ''
  return main
    .replace(/<h1>/g, '# ').replace(/<h2>/g, '\n## ').replace(/<li>/g, '- ').replace(/<nav>/g, '\n[links] ')
    .replace(/<\/(h1|h2|p|li|ul)>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

const gpu = low
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

fs.mkdirSync(out, { recursive: true })
if (!only?.length || only.includes('T1')) fs.writeFileSync(path.join(out, 'T1-home.txt'), homeText())

const server = await preview({ preview: { port: PORT, strictPort: true, open: false }, logLevel: 'silent' })
const failed = []
async function shoot(g) {
  const phone = g.vp === PHONE
  // a browser per page: each has its own GPU process, so software rendering runs in parallel
  const browser = await chromium.launch({ executablePath: process.env.SHOTS_CHROMIUM || undefined, args: gpu })
  const ctx = await browser.newContext({
    viewport: g.vp, deviceScaleFactor: phone && !low ? 3 : 1, hasTouch: phone,
    reducedMotion: low && !g.motion ? 'reduce' : 'no-preference',
  })
  if (!g.first) await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') } catch { /* */ } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  let t0 = Date.now(), done = 0
  try {
    const params = new URLSearchParams(query)
    if (low) params.set('quality', 'low')
    await page.goto(`http://127.0.0.1:${PORT}${g.path ?? '/'}${params.size ? `?${params}` : ''}`, { waitUntil: 'load', timeout: LONG })
    t0 = Date.now()
    for (const [id, wait] of g.frames) {
      await wait(page, t0)
      await page.screenshot({ path: path.join(out, `${id}.png`), timeout: LONG })
      console.log(`shots: ${id} (${Math.round((Date.now() - t0) / 1000)} s)`)
      done++
    }
  } catch (e) {
    const lost = g.frames.slice(done).map(([id]) => id)
    failed.push(...lost); console.error(`shots: FAIL ${lost.join(', ')}: ${String(e).split('\n')[0]}`)
  } finally {
    if (errors.length) console.error(`shots: page errors in ${g.frames.map(([id]) => id).join(',')}: ${errors.slice(0, 3).join(' | ')}`)
    await browser.close()
  }
}
try {
  // a few pages at a time: each one builds the whole scene in software when there is no GPU
  const queue = [...GROUPS], workers = low ? 3 : 1
  await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await shoot(queue.shift()) }))
} finally {
  await server.close()
}
if (failed.length) { console.error(`shots: ${failed.length} frame(s) failed: ${failed.join(', ')}`); process.exitCode = 1 }
else console.log(`shots: ok → ${path.relative(process.cwd(), out)}`)
