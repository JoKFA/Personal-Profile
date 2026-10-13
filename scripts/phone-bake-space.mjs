// P3c: the profile drive's door and interior, baked through the real code (the door, the interior's clock, camera and runtime, the archive's close()).
// Jobs (each its own page, as every bake job):
//   tour   door-YW-000 (to the cut) + the whole tour after it: space-intro, space-<i> x6, fly-<i>-<i+1> x5, the evidence thumbnails.
//          The tour is one continuous run of the interior's clock; its frames are cut into clips where the clock's state changes
//          (intro | station i | flight i), so no frame is in two clips and no pose is ours.
//   outin  out-<i> x6 (the desktop's own way out, runtime.exit(), up to the hub) and in-<i> x6 (the hub -> station i at p = 0, a flight of the real clock
//          started from the hub pose)
//   stills rest-<i> x6 (station i at p = 1) and the hub
//   exit   hub -> the intro backwards -> the door backwards (archive.close(), the desktop's way) -> the director takes the camera back to the cover stop
// The interior's own time is held at 0 (lab idle0), so a baked picture is still when nothing moves.
import fs from 'node:fs'
import path from 'node:path'
import { DPR_CLIP, FPS, pad } from './phone-bake-lib.mjs'

/** what the interior is told at a start that is not the door's cut: nothing after the intro depends on it (it is used only inside the intro) */
const HANDOFF = { glow: 0.28, fov: 24.5, dieFrac: 0.7 }
const INTRO_DUR = 1.9
const REGION = { width: 480, height: 960, cx: 0.5, cy: 300 / 960, rw: 1, rh: 472 / 960, rect: { x0: 0, y0: 64, x1: 480, y1: 536 } }
const EXIT_BLEND = 8

export const SPACE_NAMES = {
  stations: [0, 1, 2, 3, 4, 5].map((i) => `space-${i}`),
  fly: [0, 1, 2, 3, 4].map((i) => `fly-${i}-${i + 1}`),
  out: [0, 1, 2, 3, 4, 5].map((i) => `out-${i}`),
  in: [0, 1, 2, 3, 4, 5].map((i) => `in-${i}`),
}
export const isSpaceClip = (n) => n === 'space-intro' || n === 'space-exit' || /^space-\d$/.test(n) || /^fly-\d-\d$/.test(n) || /^(out|in)-\d$/.test(n)

/** c: the bake's context (see phone-bake.mjs) */
export function spaceJobs(c) {
  const { sess, WORK, REUSE, KEEP, log, py, HERE, png, framesDir, wanted, R, roundPts, round } = c
  const metaOf = (name) => path.join(framesDir(name), 'meta.json')
  const have = (names) => REUSE && names.every((n) => fs.existsSync(metaOf(n)))
  const writeMeta = (name, meta) => { fs.mkdirSync(framesDir(name), { recursive: true }); fs.writeFileSync(metaOf(name), JSON.stringify(meta)) }
  const mk = (name) => { const d = framesDir(name); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); return d }
  const frameFile = (dir, i) => path.join(dir, `f-${pad(i)}.png`)
  const dataUrlTo = (url, file) => fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))

  /** the interior's classification of a drawn frame: where in the tour it is */
  const klass = (sm) => {
    const f = sm.frame
    if (!f) return 'none'
    if (f.travel && f.travel.to === -1) return 'exit-fly'
    if (f.intro < INTRO_DUR - 1e-9) return 'intro'
    return f.travel ? `fly${f.area}` : `st${f.area}`
  }

  // ── tour ──
  const tourNames = ['door-YW-000', 'space-intro', ...SPACE_NAMES.stations, ...SPACE_NAMES.fly]
  const tourJob = () => async () => {
    if (have(tourNames) && [0, 1, 2, 3, 4, 5].every((i) => fs.existsSync(png(`thumb-${i}.webp`)))) { log('tour: reusing frames'); return }
    const t = Date.now()
    await sess(DPR_CLIP, async (s) => {
      await s.settle('YW-000')
      await s.ph('door', { interior: true, exact: true })
      // the door, to its cut (the exterior's last frame)
      const ddir = mk('door-YW-000'), dq = [], dcam = []
      let n = 0
      for (let i = 0; i < 500; i++) {
        if (i > 0) await s.step()
        const sm = await s.sample(); dq.push(roundPts(sm.quad)); dcam.push(round(sm.cam, 4))
        await s.shot(frameFile(ddir, i)); n = i + 1
        if (await s.p.evaluate(() => window.__ph.doorCut)) break
      }
      if (!(await s.p.evaluate(() => window.__ph.doorCut))) throw new Error('the door never reached its cut')
      writeMeta('door-YW-000', { count: n, q: dq, cam: dcam, marks: await s.marks() })
      fs.writeFileSync(path.join(WORK, 'areas.json'), JSON.stringify(await s.p.evaluate(() => window.__ph.space.areas())))
      fs.writeFileSync(path.join(WORK, 'handoff.json'), JSON.stringify(await s.p.evaluate(() => window.__ph.handoff)))
      // the tour: the interior's own runtime and clock from the cut to the last station's result
      const tdir = mk('tour'), samples = []
      for (let j = 0; j < 4000; j++) {
        await s.step()
        const sm = await s.ispace(); samples.push(sm)
        await s.shot(frameFile(tdir, j))
        if (sm.clock.reason === 'done' && !sm.clock.playing) break
      }
      const last = samples[samples.length - 1]
      if (!(last.clock.reason === 'done' && last.clock.area === 5 && last.clock.p >= 1)) throw new Error('the tour did not reach the last result')
      // the evidence thumbnails the runtime took of the live scene (the desktop's own framing and size)
      const th = await s.p.evaluate(() => window.__ph.space.thumbs())
      for (let i = 0; i < 6; i++) { if (!th[i]) throw new Error('no thumbnail for station ' + i); dataUrlTo(th[i], png(`thumb-${i}.webp`)) }
      c.splitTour(samples, tdir)
    }, { label: 'tour', interior: true, exact: true })
    log(`tour done (${((Date.now() - t) / 1000).toFixed(0)} s)`)
  }

  /** cut the tour's frames into clips where the clock's state changes; each clip gets its frames, p, chips and plate */
  c.splitTour = (samples, tdir) => {
    const ks = samples.map(klass), runs = []
    ks.forEach((k, j) => { if (runs.length && runs[runs.length - 1].k === k) runs[runs.length - 1].to = j; else runs.push({ k, from: j, to: j }) })
    const want = ['intro', 'st0', 'fly0', 'st1', 'fly1', 'st2', 'fly2', 'st3', 'fly3', 'st4', 'fly4', 'st5']
    if (runs.map((r) => r.k).join() !== want.join()) throw new Error('the tour is not the expected sequence: ' + runs.map((r) => `${r.k}[${r.from}-${r.to}]`).join(' '))
    const copy = (name, a, b) => { const d = mk(name); for (let j = a; j <= b; j++) fs.copyFileSync(frameFile(tdir, j), frameFile(d, j - a)); return d }
    const meta = {}
    for (const r of runs) {
      const count = r.to - r.from + 1
      if (r.k === 'intro') { copy('space-intro', r.from, r.to); writeMeta('space-intro', { count }); meta['space-intro'] = count }
      else if (r.k.startsWith('fly')) { const i = +r.k.slice(3), name = `fly-${i}-${i + 1}`; copy(name, r.from, r.to); writeMeta(name, { count }); meta[name] = count }
      else {
        const i = +r.k.slice(2), name = `space-${i}`, sub = samples.slice(r.from, r.to + 1)
        copy(name, r.from, r.to)
        const p = sub.map((sm) => round(sm.frame.p, 5))
        const resultFrame = p.findIndex((v) => v >= c.RESULT_AT), stepFrames = c.STEP_AT.map((sp) => p.findIndex((v) => v >= sp))
        // chips: those the content marks phone: true, one entry each, per frame
        const keys = [...new Set(sub.flatMap((sm) => sm.chips.map((q) => q.chip)))].sort((a, b) => a - b)
        const chips = keys.map((chip) => {
          const per = sub.map((sm) => sm.chips.find((q) => q.chip === chip))
          return { chip, at: per.find(Boolean).at, x: per.map((q) => (q ? round(q.x, 1) : null)), y: per.map((q) => (q ? round(q.y, 1) : null)), on: per.map((q) => !!q && q.on) }
        })
        const pt = (q) => (q ? { x: round(q.x, 1), y: round(q.y, 1) } : null)
        writeMeta(name, { count, p, resultFrame, stepFrames, chips, plate: { result: pt(sub[resultFrame].plate), end: pt(sub[sub.length - 1].plate) } })
        meta[name] = count
      }
    }
    log('tour split: ' + Object.entries(meta).map(([k, v]) => `${k} ${v}`).join(', '))
    if (!KEEP) fs.rmSync(tdir, { recursive: true, force: true })
  }

  // ── out / in ──
  const outinNames = [...SPACE_NAMES.out, ...SPACE_NAMES.in]
  const outinJob = () => async () => {
    if (have(outinNames)) { log('out/in: reusing frames'); return }
    const t = Date.now()
    await sess(DPR_CLIP, async (s) => {
      const H = HANDOFF
      // the clock's state to start from, by the real clock's own steps (run without drawing), then the interior's runtime from there
      const prepOut = (i) => s.p.evaluate(([i, h]) => { const sp = window.__ph.space; sp.suspend(); sp.restart(true); sp.fastForward('arrive', i); sp.clock.select(i); sp.fastForward('result', i); sp.start(h) }, [i, H])
      // (the hub is drawn once first, so the flight starts from the hub pose, as the way out ended on it)
      const prepIn = (i) => s.p.evaluate(([i, h]) => {
        const sp = window.__ph.space; sp.suspend(); sp.restart(true)
        if (i === 0) { sp.fastForward('arrive', 1); sp.clock.select(0) } else sp.fastForward('flight', i)
        sp.showHub(true); sp.start(h)
      }, [i, H])
      // out-i: station i's result → the hub, by the runtime's own exit
      for (let i = 0; i < 6; i++) {
        const name = `out-${i}`, dir = mk(name)
        await prepOut(i)
        await s.step()                                  // the first runtime frame: the result held
        let n = 0
        const rec = async () => { await s.shot(frameFile(dir, n++)) }
        let sm = await s.ispace(); await rec()
        await s.p.evaluate(() => { window.__ph.space.exit() })
        for (let k = 0; k < 200; k++) {
          await s.step(); sm = await s.ispace(); await rec()
          if (klass(sm) !== 'exit-fly') break           // this frame is the intro phase's first: the hub the flight ended on
        }
        await s.p.evaluate(() => window.__ph.space.stop())
        writeMeta(name, { count: n })
      }
      // in-i: the hub → station i at p = 0, the real clock's flight started from the hub pose
      for (let i = 0; i < 6; i++) {
        const name = `in-${i}`, dir = mk(name)
        await prepIn(i)
        let n = 0
        for (let k = 0; k < 300; k++) {
          await s.step(); const sm = await s.ispace(); await s.shot(frameFile(dir, n++))
          const f = sm.frame
          if (f && !f.travel && f.area === i && f.intro >= INTRO_DUR - 1e-9) break
        }
        await s.p.evaluate(() => window.__ph.space.stop())
        writeMeta(name, { count: n })
      }
    }, { label: 'outin', interior: true, exact: true })
    log(`out/in done (${((Date.now() - t) / 1000).toFixed(0)} s)`)
  }

  // ── rest stills and the hub ──
  const stillsJob = (DPR) => async () => {
    if (REUSE && [0, 1, 2, 3, 4, 5].every((i) => fs.existsSync(png(`rest-${i}.png`))) && fs.existsSync(png('hub.png'))) { log('rest/hub: reusing'); return }
    await c.sessAt(DPR, async (s) => {
      for (let i = 0; i < 6; i++) {
        await s.p.evaluate(([i, h]) => { const sp = window.__ph.space; sp.suspend(); sp.restart(true); sp.fastForward('arrive', i); sp.clock.select(i); sp.fastForward('result', i); sp.start(h) }, [i, HANDOFF])
        for (let k = 0; k < 3; k++) await s.step()
        await s.shot(png(`rest-${i}.png`))
        await s.p.evaluate(() => window.__ph.space.stop())
      }
      await s.p.evaluate(() => { const sp = window.__ph.space; sp.stop(); sp.showHub(true); sp.showHub(true) })
      await s.shot(png('hub.png'))
    }, { label: 'rest/hub', interior: true, exact: true })
  }

  // ── exit: hub → intro backwards → door backwards → the cover stop ──
  const exitJob = () => async () => {
    if (have(['space-exit'])) { log('exit: reusing frames'); return }
    const t = Date.now()
    await sess(DPR_CLIP, async (s) => {
      await s.settle('YW-000')
      // the real door, with the clock run to the end of the tour at the cut (all six results retained)
      await s.ph('door', { interior: true, ff: { until: 'done' } })
      for (let i = 0; i < 500 && !(await s.p.evaluate(() => window.__ph.doorCut)); i++) await s.step()
      for (let i = 0; i < 3; i++) await s.step()
      await s.p.evaluate(() => window.__ph.space.closeArchive())
      const dir = mk('space-exit'), q = [], cam = []
      let n = 0, doorFrame = -1, retook = false, readyAt = -1
      for (let k = 0; k < 900; k++) {
        await s.step()
        const sm = await s.ispace()
        if (klass(sm) === 'exit-fly' && sm.suspended) continue         // the flight to the hub: that is out-<i>
        const d = await s.sample()
        const inside = sm.suspended
        if (!inside && doorFrame < 0) doorFrame = n
        q.push(inside ? [] : roundPts(d.quad)); cam.push(round(d.cam, 4))
        await s.shot(frameFile(dir, n++))
        // the archive has closed the file again: the director takes the camera from where the engine left it, back to the cover's framing
        if (sm.closed && !retook) { await s.p.evaluate(() => window.__ph.retake()); retook = true }
        if (retook && readyAt < 0 && (await s.ready())) readyAt = n
        if (readyAt >= 0 && n - readyAt >= 20) break
      }
      if (readyAt < 0) throw new Error('the exit never came back to the cover stop')
      py(path.join(HERE, 'phone-bake-blend.py'), png('stop-YW-000.png'), dir, String(EXIT_BLEND))
      writeMeta('space-exit', { count: n, q, cam, doorFrame, retookAt: q.length })
    }, { label: 'exit', interior: true, exact: true })
    log(`exit done (${((Date.now() - t) / 1000).toFixed(0)} s)`)
  }

  return { tourJob, outinJob, stillsJob, exitJob, REGION, HANDOFF, tourNames, outinNames }
}
