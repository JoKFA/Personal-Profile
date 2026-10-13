// Shared by `npm run phone:bake`: a frame-exact page on the real engine (fake clock, manual rAF), ffmpeg helpers, hashing.
// The page is the bake build's `/?bake` (src/casefile/phone/bake/director.ts, master framing), scene pixels only.
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
// Playwright lives in the main checkout's node_modules (this worktree's is a junction to it)
const { chromium } = require('@playwright/test')

export const MASTER = { w: 480, h: 960 }
export const FPS = 25
export const STEP = 1000 / FPS
/** the stills' pixel ratio (2.5 → 1200 × 2400) and the clips' (2 → 960 × 1920) */
export const DPR_STILL = 2.5
export const DPR_CLIP = 2
/** steps after a stop is ready until it is settled to the pixel (the spring tails are long: plan §3.1) */
export const SETTLE_STEPS = Number(process.env.SETTLE_STEPS || 125)

export const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
export const sizeOf = (f) => fs.statSync(f).size
export const pad = (i) => String(i).padStart(4, '0')

export const ffmpeg = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] })

export function py(script, ...args) {
  const r = spawnSync('python', [script, ...args], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`python ${path.basename(script)} failed: ${r.stderr || r.stdout}`)
  return r.stdout
}

/** H.264, yuv420p, BT.709 tagged, faststart: the clip every browser here decodes */
export function encodeClip(dir, out, { crf = 23, fps = FPS, width = 0 } = {}) {
  // width: scale the frames to this many pixels across (0 = as rendered)
  ffmpeg('-framerate', String(fps), '-i', path.join(dir, 'f-%04d.png'),
    '-vf', `${width ? `scale=${width}:-2:flags=lanczos:` : 'scale='}out_color_matrix=bt709:out_range=tv,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-profile:v', 'high', '-level', '4.1', '-r', String(fps), '-g', String(fps),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', out)
}
export const toWebp = (png, out, q = 90) => ffmpeg('-i', png, '-c:v', 'libwebp', '-quality', String(q), '-compression_level', '6', out)

/** the browser: Chrome (the bundled Chromium has no H.264), hardware GPU through ANGLE/D3D11 */
export const launch = () => chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })

/** the GPU must be real hardware: a bake on a software renderer would be a different picture. Returns the renderer string. */
export async function assertHardwareGpu(browser) {
  const p = await browser.newPage()
  try {
    await p.goto('about:blank')
    const r = await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
      if (!gl) return { renderer: 'NO WEBGL', vendor: '' }
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      return ext ? { renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) } : { renderer: 'NO WEBGL_debug_renderer_info', vendor: '' }
    })
    const s = `${r.vendor} ${r.renderer}`
    if (!r.renderer || /swiftshader|llvmpipe|softpipe|microsoft basic|basic render|software|NO WEBGL/i.test(s)) throw new Error(`the bake needs a hardware GPU; WebGL reports: ${s}`)
    return s.trim()
  } finally { await p.close() }
}

/**
 * One frame-exact page. `run(s)` gets: s.step() (one 40 ms frame), s.shot(file), s.settle(id), s.ph(fn, arg), s.sample() …
 * Every job gets its own page (and context), so an asset does not depend on what was rendered before it.
 */
export async function session(browser, base, dpr, run, { warm = false, label = '', interior = false, exact = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: MASTER.w, height: MASTER.h }, deviceScaleFactor: dpr, bypassCSP: true })
  await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') } catch { /* */ } })
  await ctx.clock.install({ time: new Date('2026-10-10T14:02:00') })
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window)
    const queue = new Map(); let manual = false, next = 1
    window.requestAnimationFrame = (cb) => { if (!manual) return raf(cb); const id = -(next++); queue.set(id, cb); return id }
    window.cancelAnimationFrame = (id) => { if (id < 0) queue.delete(id); else caf(id) }
    window.__filmManual = (on = true) => { manual = on }
    window.__filmFlush = () => { const now = performance.now(), due = [...queue.values()]; queue.clear(); for (const cb of due) cb(now) }
    window.__filmAnim = (dt) => { for (const a of document.getAnimations()) { if (a.playState === 'finished' || a.playState === 'idle') continue; if (!a.__film) { a.__film = true; a.pause(); a.currentTime = 0; continue } const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity; const n = (Number(a.currentTime) || 0) + dt; if (Number.isFinite(end) && n >= end) a.finish(); else a.currentTime = n } }
  })
  const p = await ctx.newPage(); p.setDefaultTimeout(600000)
  p.on('pageerror', (e) => console.log(`[${label}] PAGEERR`, String(e)))
  p.on('console', (m) => { if (m.type() === 'error') console.log(`[${label}] console.error`, m.text().slice(0, 300)) })
  await p.goto(`${base}/?bake&quality=high&dpr=${dpr}`, { waitUntil: 'load' })
  const until = async (cond, what, ms = 100) => { for (let t = 0; t < 120000; t += ms) { if (await p.evaluate(cond)) return; await p.clock.runFor(ms) } throw new Error('timed out: ' + what) }
  await until(() => !!window.__ph && !!window.__cf && window.__cf.getSnapshot().mode === 'archive', 'archive')
  await p.clock.runFor(1500)
  // the interior is built on the archive's renderer before the frames are driven by hand (its build waits on real frames)
  if (interior) await p.evaluate(() => window.__ph.spaceBoot())
  // exact: the fake clock is PAUSED, so a frame is exactly 40 ms of the page's time. (Left running, Playwright's clock keeps flowing between calls:
  // each "40 ms" step was 41-44 ms, and up to 50 ms when the machine was busy: the baked motion ran 3-25% fast and varied run to run.)
  if (exact) await p.clock.pauseAt(new Date((await p.evaluate(() => Date.now())) + 2000))
  const api = {
    p, dpr,
    ph: (fn, arg) => p.evaluate(([f, a]) => window.__ph[f](a), [fn, arg]),
    // one 40 ms frame: the clock, then the engine's rAF queue (one drawn frame), then the document's animations
    step: async () => { await p.clock.runFor(STEP); await p.evaluate((dt) => { window.__filmFlush(); window.__filmAnim(dt) }, STEP) },
    manual: () => p.evaluate(() => window.__filmManual(true)),
    shot: (file) => p.screenshot({ path: file, type: 'png' }),
    /** the face's corners and the camera's progress for the frame just drawn */
    sample: () => p.evaluate(() => window.__ph.sample()),
    ready: () => p.evaluate(() => window.__ph.ready),
    stopCue: (id) => p.evaluate((i) => window.__ph.stop(i), id),
    /** go to a stop and let it come to rest: until ready, then SETTLE_STEPS more frames */
    settle: async (id) => {
      await api.stopCue(id)
      for (let i = 0; i < 600 && !(await api.ready()); i++) await api.step()
      for (let i = 0; i < SETTLE_STEPS; i++) await api.step()
    },
    /** the bake's pixels are the scene's: nothing but the canvases may be visible on the page */
    assertSceneOnly: async () => {
      const extra = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !['SCRIPT', 'CANVAS'].includes(e.tagName) && !e.closest('svg') && !e.querySelector('canvas') }).map((e) => `${e.tagName}.${e.className}`))
      if (extra.length) throw new Error(`DOM is visible over the scene: ${extra.join(', ')}`)
    },
    until,
    marks: () => p.evaluate(() => window.__ph.marks),
    /** the interior's numbers for the frame just drawn (bake/interior.ts) */
    ispace: () => p.evaluate(() => window.__ph.space.sample()),
    stops: () => p.evaluate(() => window.__ph.stops),
  }
  try {
    if (warm) {
      // (an off-camera run of the shots first; kept as an option to prove it changes nothing: SETTLE-independent pixels)
      for (const [fn, arg, ms] of warm) { await p.evaluate(([f, a]) => window.__ph[f](a), [fn, arg]); await p.clock.runFor(ms) }
    }
    await api.manual()
    return await run(api)
  } finally { await ctx.close() }
}

/** run async jobs with at most n in flight */
export async function pool(jobs, n, onDone = () => {}) {
  const out = new Array(jobs.length); let next = 0, done = 0
  const worker = async () => { for (;;) { const i = next++; if (i >= jobs.length) return; out[i] = await jobs[i](); onDone(++done, jobs.length) } }
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, worker))
  return out
}
