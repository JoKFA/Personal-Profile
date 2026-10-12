// shared by the phone spike's bake and probes: a frame-exact page on the real engine (fake clock, manual rAF)
import { chromium } from '@playwright/test'
export const BASE = process.env.BASE || 'http://127.0.0.1:5194'
export const W = 390, H = 866, FPS = 25, STEP = 1000 / FPS
export const SETTLE_STEPS = Number(process.env.SETTLE_STEPS || 100)
export async function session(dpr, run) {
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true })
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
  const p = await ctx.newPage(); p.setDefaultTimeout(600000); p.on('pageerror', (e) => console.log('PAGEERR', String(e)))
  await p.goto(`${BASE}/?phone&quality=high&dpr=${dpr}&bake`, { waitUntil: 'load' })
  const until = async (cond, what, ms = 100) => { for (let t = 0; t < 120000; t += ms) { if (await p.evaluate(cond)) return; await p.clock.runFor(ms) } throw new Error('timed out: ' + what) }
  await until(() => !!window.__ph && !!window.__cf && window.__cf.getSnapshot().mode === 'archive', 'archive')
  await p.clock.runFor(1500)
  // FREEZE_IDLE=1: the field's idle breathing (archive.ts idleGain, a function of the clock) is held at 0 for this page. A bake-time probe, not a source change.
  if (process.env.FREEZE_IDLE) await p.evaluate(() => { Object.defineProperty(window.__cf, 'idleGain', { get: () => 0, set: () => {} }) })
  const api = {
    p, dpr,
    ph: (fn, arg) => p.evaluate(([f, a]) => window.__ph[f](a), [fn, arg]),
    // one 40 ms frame: clock, the engine's rAF queue, document animations
    step: async () => { await p.clock.runFor(STEP); await p.evaluate((dt) => { window.__filmFlush(); window.__filmAnim(dt) }, STEP) },
    // warm-up runs off camera, in the page's own (non-manual) time
    warmRun: async (cues) => { for (const [fn, arg, ms] of cues) { await p.evaluate(([f, a]) => window.__ph[f](a), [fn, arg]); await p.clock.runFor(ms) } },
    manual: () => p.evaluate(() => window.__filmManual(true)),
    stopAndSettle: async (id) => {
      await p.evaluate((i) => window.__ph.stop(i), id)
      for (let i = 0; i < 600 && !(await p.evaluate(() => window.__ph.ready)); i++) await api.step()
      for (let i = 0; i < SETTLE_STEPS; i++) await api.step()
    },
    shot: (file) => p.screenshot({ path: file, type: 'png' }),
    quad: (inset) => p.evaluate((n) => window.__cf.faceQuad(n).map((q) => [q.x, q.y]), inset),
    close: () => b.close(),
  }
  try { return await run(api) } finally { await b.close() }
}

