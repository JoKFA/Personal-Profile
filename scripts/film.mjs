// Film the entrance frame by frame, to compare it with the reference at its own frame rate.
// Run after `npm run build`. The page runs on a fake clock: each frame advances it exactly 1/fps,
// so a slow software renderer still yields an exact 25 fps film.
//
//   node scripts/film.mjs                               → return visit, the entrance alone
//   node scripts/film.mjs --visit first                 → first visit: skip the entry, film the hand-over and the (short) entrance a skip gets
//   node scripts/film.mjs --seconds 6 --fps 25 --size 1280x720 --quality high --out shots/film/now
//   node scripts/film.mjs --gpu                         → on this machine's GPU instead of software rendering
//
// Writes f-0000.png…, a contact sheet per second (sheet-00.png…, 5 × 5 frames) and film.mp4.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const visit = arg('visit', 'return')
const seconds = Number(arg('seconds', '6')), fps = Number(arg('fps', '25'))
const [W, H] = arg('size', '1280x720').split('x').map(Number)
const quality = arg('quality', 'high')
const out = path.resolve(arg('out', `shots/film/${visit}`))
const LONG = 20 * 60_000

if (!fs.existsSync('dist/index.html')) { console.error('film: run `npm run build` first'); process.exit(1) }
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })

// 127.0.0.1 explicitly: on Windows vite binds `localhost` to IPv6 only, and the browser is sent to 127.0.0.1
const server = await preview({ preview: { host: '127.0.0.1', port: 4191, strictPort: false, open: false }, logLevel: 'silent' })
const PORT = server.httpServer.address().port
// --gpu: the machine's GPU through ANGLE (true light and material); without it, software rendering
const gpu = process.argv.includes('--gpu')
const browser = await chromium.launch({ executablePath: process.env.SHOTS_CHROMIUM || undefined, args: gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  if (visit !== 'first') await ctx.addInitScript(() => { try { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') } catch { /* */ } })
  await ctx.clock.install({ time: new Date('2026-10-05T14:02:00') })
  // one rendered frame per filmed frame: once filming starts, animation frames queue up and run
  // exactly once per step (the fake clock alone would run two or three per 40 ms)
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window)
    const queue = new Map(); let manual = false, next = 1
    window.requestAnimationFrame = (cb) => { if (!manual) return raf(cb); const id = -(next++); queue.set(id, cb); return id }
    window.cancelAnimationFrame = (id) => { if (id < 0) queue.delete(id); else caf(id) }
    window.__filmManual = () => { manual = true }
    window.__filmFlush = () => { const now = performance.now(), due = [...queue.values()]; queue.clear(); for (const cb of due) cb(now) }
    // CSS transitions and animations run on the real clock: pause each one the first time it is seen and
    // advance it by the film step, so DOM motion stays in step with the fake clock (without this the
    // page's own transitions are filmed as a single-frame cut); finish() fires transitionend
    window.__filmAnim = (dt) => {
      for (const a of document.getAnimations()) {
        if (a.playState === 'finished' || a.playState === 'idle') continue
        if (!a.__film) { a.__film = true; a.pause(); a.currentTime = 0; continue }
        const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity
        const next = (Number(a.currentTime) || 0) + dt
        if (Number.isFinite(end) && next >= end) a.finish(); else a.currentTime = next
      }
    }
    window.__filmAnimRelease = () => { for (const a of document.getAnimations()) if (a.__film && a.playState === 'paused') a.play() }
  })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
  page.setDefaultTimeout(LONG)
  const t0 = Date.now()
  await page.goto(`http://127.0.0.1:${PORT}/?quality=${quality}`, { waitUntil: 'load', timeout: LONG })
  if (process.env.FILM_DEBUG) console.log(`film: loaded in ${Math.round((Date.now() - t0) / 1000)} s`)
  // the page loads and builds its scene in real time (the fake clock flows until paused)
  const poll = async (cond, what) => {
    for (let i = 0; i < 2400; i++) { if (await page.evaluate(cond)) return; await new Promise((r) => setTimeout(r, 500)) }
    throw new Error(`film: timed out waiting for ${what}`)
  }
  // pause the flowing clock; a slow frame can carry it past a near target, so aim further each try
  const pause = async () => {
    for (const ahead of [50, 300, 1500, 5000, 15000]) {
      try { await page.clock.pauseAt(await page.evaluate((a) => Date.now() + a, ahead)); return } catch { /* the clock got there first */ }
    }
    throw new Error('film: could not pause the clock')
  }
  // with the clock paused, let fake time pass in steps (timers and frames run) until a condition holds
  const until = async (cond, what, step = 100) => {
    for (let t = 0; t < 120_000; t += step) { if (await page.evaluate(cond)) return; await page.clock.runFor(step) }
    throw new Error(`film: timed out waiting for ${what}`)
  }
  if (visit === 'first') {
    await poll(() => !!document.querySelector('.gate-skip') && getComputedStyle(document.querySelector('.gate')).visibility === 'visible', 'the entry')
    // pause on the entry, then leave it: the scene builds and the hand-over starts on fake time
    await pause()
    await page.locator('.gate-skip').click()
    await until(() => document.querySelector('.gate')?.getAttribute('data-phase') === 'transfer', 'the hand-over')
  } else {
    // a return visit: the entrance starts as soon as the scene is up; restart it at the paused clock
    await poll(() => { const a = window.__cf; return !!a && Number.isFinite(a.entranceAge()) }, 'the entrance')
    await pause()
    await page.evaluate(() => { window.__cf.holdEntrance(); window.__cf.releaseEntrance() })
  }
  if (process.env.FILM_DEBUG) console.log(`film: ready in ${Math.round((Date.now() - t0) / 1000)} s`)
  const n = Math.round(seconds * fps), step = 1000 / fps
  await page.evaluate(() => window.__filmManual())
  for (let i = 0; i < n; i++) {
    await page.clock.runFor(step)
    await page.evaluate((dt) => { window.__filmFlush(); window.__filmAnim(dt) }, step)
    await page.screenshot({ path: path.join(out, `f-${String(i).padStart(4, '0')}.png`) })
    if (i % fps === fps - 1) console.log(`film: ${(i + 1) / fps} s (${Math.round((Date.now() - t0) / 1000)} s real)`)
  }
  await page.evaluate(() => window.__filmAnimRelease())
  if (errors.length) console.error(`film: page errors: ${errors.slice(0, 3).join(' | ')}`)
} finally {
  await browser.close(); await server.close()
}
// a sheet per second, 5 × 5, each frame stamped with its time; and the film itself
// (ffmpeg wants the drive colon escaped inside a filter)
const font = process.platform === 'win32' ? "'C\\:/Windows/Fonts/consola.ttf'" : '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
const stamp = `drawtext=fontfile=${font}:text='%{eif\\:n/${fps}\\:d}.%{eif\\:mod(n\\,${fps})*${100 / fps}\\:d\\:2}':x=6:y=6:fontsize=16:fontcolor=red:box=1:boxcolor=white@0.6`
const sheets = Math.ceil(seconds)
for (let s = 0; s < sheets; s++) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-start_number', String(s * fps), '-i', path.join(out, 'f-%04d.png'),
    '-frames:v', '1', '-vf', `setpts=PTS+${s}/TB,scale=384:-1,${stamp.replace("n/", `(n+${s * fps})/`).replace('mod(n', `mod((n+${s * fps})`)},tile=5x5:padding=2:color=black`, path.join(out, `sheet-${String(s).padStart(2, '0')}.png`)])
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(out, 'f-%04d.png'), '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', path.join(out, 'film.mp4')])
console.log(`film: ok → ${path.relative(process.cwd(), out)}`)
