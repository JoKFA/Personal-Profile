// `npm run phone:bake`: renders the phone's pictures with the real engine, frame-exact, scene pixels only, and writes
// public/phone/ (content-hashed files + manifest.json, the contract in src/casefile/phone/manifest.ts).
//
//   1. a clean snapshot: a detached git worktree at the current HEAD (E:\...\.codex-runtime\p3-bake), `vite build --mode bake`
//      there, `vite preview` on :4196. Source edits in this worktree cannot reach a bake in progress (commit first: the
//      bake renders what HEAD holds, and refuses to run when the bake's inputs are uncommitted).
//   2. WebGL must report a hardware GPU, or the bake aborts.
//   3. stills (dpr 2.5, WebP), then clips (dpr 2, 25 fps, H.264): entrance, pans, opens, closes, the profile's door.
//      Every job is its own page, so an asset does not depend on what was rendered before it.
//   4. budget checks, then the checks in phone-bake-checks.mjs (clip ends vs stills, hard-cut scan).
//
// node scripts/phone-bake.mjs [--only=a,b] [--out=dir] [--work=dir] [--jobs=4] [--keep-frames] [--dev=http://host:port] [--no-build] [--evidence=dir] [--reuse]
//   --only: asset names or prefixes (stop-X-001, pan-, open-X-001, entrance …): a partial bake goes to --out and leaves public/phone alone
//   --dev: render from a running dev server instead of the snapshot (experiments only; the inputHash then is not the snapshot's)
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MASTER, REEL } from '../src/casefile/phone/manifest.ts'
import { inputHash } from './phone-bake-hash.mjs'
import { DPR_CLIP, DPR_STILL, FPS, assertHardwareGpu, encodeClip, launch, pad, pool, py, session, sha, sizeOf, toWebp } from './phone-bake-lib.mjs'
import { runChecks } from './phone-bake-checks.mjs'
import { spaceJobs, isSpaceClip, SPACE_NAMES } from './phone-bake-space.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const arg = (k, d) => { const a = process.argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a === undefined ? d : a.includes('=') ? a.slice(k.length + 3) : true }
const ONLY = arg('only', '') ? String(arg('only')).split(',').filter(Boolean) : null
const PARTIAL = !!ONLY
const WORK = path.resolve(arg('work', path.join(ROOT, '..', 'p3-bake-work')))
const OUT = path.resolve(arg('out', PARTIAL ? path.join(WORK, 'out-partial') : path.join(WORK, 'out')))
const JOBS = Number(arg('jobs', 4))
const KEEP = !!arg('keep-frames', false)
// H.264 per asset class (PM decision 10-12): width in px across (the frames are rendered 960 wide), crf
const ENCODE = {
  entrance: { width: 720, crf: 26 },
  pan: { width: 720, crf: 24 },
  reel: { width: 960, crf: 24 },     // open / close of the reel's five stops
  rest: { width: 720, crf: 28 },     // open / close of every other Index entry
  door: { width: 960, crf: 23 },
  // P3c: the interior (720 wide): the intro, the stations and the exit at crf 26, the flights (tour, out, in) at crf 28
  space: { width: 720, crf: 26 },
  flight: { width: 720, crf: 28 },
}
/** the interior's stills: pixel ratio (2.5 = 1200 x 2400); lowered if the interior would not fit its 12 MB */
const DPR_SPACE_STILL = Number(arg('space-dpr', 2.5))
const INTERIOR_MAX = 12 * 1048576
const REUSE = !!arg('reuse', false)        // re-encode from frames (and stills) already in --work instead of rendering them again
const EVIDENCE = arg('evidence', '')
const SNAP = path.join(ROOT, '..', 'p3-bake')
const PORT = Number(arg('port', 4196))   // (another agent may hold 4196: pass --port)

// ── what a clip is ──
// pans and closes: rendered 4.0 s on the exact clock, then cut where the drive has come to rest: the first frame (not before 2.4 s) within 1.5% of the
// destination's still, the last 6 frames blended into it (the entrance's rule). At 40 ms a frame the springs need a little longer than the unpaused clock gave them.
const PAN_FRAMES = 100
const SETTLE_CUT = { threshold: 1.5, blend: 6, minFrames: 60 }
const OPEN_FRAMES = 50         // 2.0 s
const CLOSE_FRAMES = 100       // the closing timeline, then the stop's springs coming to rest (cut as above)
const BLEND = 6                // last frames blended into the destination's canonical still
const ENTRANCE_FRAMES = 160    // rendered 6.4 s; the clip is cut where the drive has come to rest (see ENTRANCE_CUT)
const ENTRANCE_CUT = { threshold: 1.5, blend: 8 }   // PM: cut at the first frame within 1.5% of the cover still, blend the last 8 into it
const STOP_CUE = 3.9           // s into the entrance: the prototype's stop:YW-000 cue
const DOOR_MAX = 400

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const encodeOf = (name) => {
  if (name === 'entrance') return ENCODE.entrance
  if (name.startsWith('pan-')) return ENCODE.pan
  if (name.startsWith('door-')) return ENCODE.door
  if (/^(fly|out|in)-\d/.test(name)) return ENCODE.flight
  if (isSpaceClip(name)) return ENCODE.space
  return REEL.includes(name.replace(/^(?:open|close)-/, '')) ? ENCODE.reel : ENCODE.rest
}
const wanted = (name) => !ONLY || ONLY.some((t) => name === t || name.startsWith(t))

// ── 1. the snapshot ──
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stdout}${r.stderr}`); return r.stdout.trim() }

function prepareSnapshot() {
  const head = sh('git', ['rev-parse', 'HEAD'], { cwd: ROOT })
  const dirty = sh('git', ['status', '--porcelain', '--', 'src/casefile/data', 'src/casefile/phone/bake', 'src/casefile/scene', 'src/casefile/motion', 'src/casefile/space', 'src/casefile/CasefileApp.tsx'], { cwd: ROOT })   // (the bake's inputs; other agents' edits to vite.config.ts / package.json do not change the pictures, and the snapshot builds HEAD's)
  if (dirty) throw new Error(`the bake renders the committed snapshot, but its inputs have uncommitted changes (commit them first):\n${dirty}`)
  if (!fs.existsSync(path.join(SNAP, '.git'))) { fs.rmSync(SNAP, { recursive: true, force: true }); sh('git', ['worktree', 'add', '--detach', SNAP, head], { cwd: ROOT }) }
  else { sh('git', ['reset', '--hard', '-q'], { cwd: SNAP }); sh('git', ['clean', '-fdq'], { cwd: SNAP }); sh('git', ['checkout', '--detach', '-q', head], { cwd: SNAP }) }
  const nm = path.join(SNAP, 'node_modules')
  if (!fs.existsSync(nm)) fs.symlinkSync(fs.realpathSync(path.join(ROOT, 'node_modules')), nm, 'junction')
  // (the snapshot's own pictures are not part of a bake build)
  for (const d of ['public/phone', 'public/phone-spike', 'public/phone-dev']) fs.rmSync(path.join(SNAP, d), { recursive: true, force: true })
  return head
}
const vite = (...a) => execFileSync(process.execPath, [path.join(SNAP, 'node_modules/vite/bin/vite.js'), ...a], { cwd: SNAP, stdio: 'inherit' })

const get = (url) => new Promise((res) => { http.get(url, (r) => { r.resume(); res(r.statusCode) }).on('error', () => res(0)) })

async function startPreview() {
  if ((await get(`http://127.0.0.1:${PORT}/`)) !== 0) throw new Error(`port ${PORT} is already in use (not killing what I did not start)`)
  const child = spawn(process.execPath, [path.join(SNAP, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', 'dist-bake', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: SNAP, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', () => {}); child.stderr.on('data', (d) => process.stderr.write(d))
  for (let i = 0; i < 100; i++) { if ((await get(`http://127.0.0.1:${PORT}/`)) === 200) return child; await new Promise((r) => setTimeout(r, 200)) }
  child.kill(); throw new Error('vite preview did not come up')
}
// kill the one process this script started (and only it)
const stopPreview = (child) => { if (child?.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) }

// ── helpers on a job's results ──
const R = { stop: {}, win: {}, clip: {} }
const png = (...p) => path.join(WORK, 'png', ...p)
const round = (v, n = 2) => +v.toFixed(n)
const roundPts = (q) => q.map(([x, y]) => [round(x), round(y)])
const bbox = (q) => ({ x0: Math.min(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), x1: Math.max(...q.map((p) => p[0])), y1: Math.max(...q.map((p) => p[1])) })

/** the reader's box around a resting drive, exactly as overlay.ts places it (master px, not clamped: the runtime clamps) */
function reticle(quad) {
  const b = bbox(quad), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
  const hw = (b.x1 - b.x0) / 2 * 1.1 + 12, hh = (b.y1 - b.y0) / 2 * 1.1 + 12
  return { x0: round(cx - hw), y0: round(cy - hh), x1: round(cx + hw), y1: round(cy + hh) }
}
const hashed = (dir, name, ext, srcFile) => {
  const buf = fs.readFileSync(srcFile), file = `${name}.${sha(buf).slice(0, 10)}.${ext}`
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, file), buf)
  return { file, bytes: buf.length }
}

// ── jobs (each opens its own page on the one browser, against the one base URL) ──
let BROWSER = null, BASE = ''
/** how long a drive holds in its window before its still is taken (and before a close starts): 5 s, settled; the sealed black drive's board is lit by the
 *  key's light, which fades slowly, so its still is taken where its open clip ends (2.0 s) and its close starts from that same state */
const KINDS = {}
const holdSteps = (id) => (KINDS[id] === 'restricted' ? OPEN_FRAMES - 1 : 125)
const sess = (dpr, run, opts) => session(BROWSER, BASE, dpr, run, opts)

function stillJob(id) {
  return async () => {
    const t = Date.now(), meta = png(`meta-${id}.json`)
    if (REUSE && fs.existsSync(meta)) { const m = JSON.parse(fs.readFileSync(meta, 'utf8')); R.stop[id] = m.stop; if (m.win && id !== 'YW-000') R.win[id] = m.win; return }
    await sess(DPR_STILL, async (s) => {
      fs.mkdirSync(png(), { recursive: true })
      await s.settle(id)
      await s.assertSceneOnly()
      await s.shot(png(`stop-${id}.png`))
      const stopS = await s.sample()
      R.stop[id] = { quad0: stopS.quad0 }
      // (YW-000 goes through the door: it has no window)
      if (id !== 'YW-000') {
        await s.ph('open'); for (let i = 0; i < holdSteps(id); i++) await s.step()
        await s.assertSceneOnly()
        await s.shot(png(`window-${id}.png`))
        const winS = await s.sample()
        R.win[id] = { inner: winS.inner, quad: winS.quad }
      }
      fs.writeFileSync(meta, JSON.stringify({ stop: R.stop[id], win: R.win[id] ?? null }))
    }, { label: `still ${id}` })
    log(`still ${id} (${((Date.now() - t) / 1000).toFixed(0)} s)`)
  }
}

/** a clip: `frames(i)` yields the cues; the frames are written, the last BLEND blended into `blendTo`, then encoded */
const framesDir = (name) => path.join(WORK, 'frames', name)
async function renderClip(name, frames, s, { n, blendTo, quads = false, stopWhen }) {
  const dir = framesDir(name)
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const q = [], cam = []
  let count = 0
  for (let i = 0; i < n; i++) {
    await frames(i)
    if (quads) { const sm = await s.sample(); q.push(roundPts(sm.quad)); cam.push(round(sm.cam, 4)) }
    await s.shot(path.join(dir, `f-${pad(i)}.png`)); count++
    if (i === 0 || i === n - 1 || i % 10 === 0) await s.assertSceneOnly()
    if (stopWhen && (await stopWhen(i))) break
  }
  let blend = null
  if (blendTo) { blend = JSON.parse(py(path.join(HERE, 'phone-bake-blend.py'), blendTo, dir, String(BLEND))); if (Math.max(...blend.diffs) >= 2) throw new Error(`${name}: the blend moved a frame by ${Math.max(...blend.diffs)}% (>= 2%): the clip does not end on its still`) }
  return { count, q, cam, blend: blend && blend.diffs }
}
/** encode a frames dir into the output (content-hashed) and record it */
function finishClip(name, { count, q, cam, marks, blend, dest }, quads) {
  const tmp = path.join(WORK, 'tmp'); fs.mkdirSync(tmp, { recursive: true })
  const mp4 = path.join(tmp, `${name}.mp4`)
  const enc = encodeOf(name)
  let dir = framesDir(name), cut = null
  if (name === 'entrance') {
    // the frames stay as rendered; the cut and its blend go to a directory of their own (so --reuse starts from the same frames)
    dir = framesDir('entrance-cut')
    cut = JSON.parse(py(path.join(HERE, 'phone-bake-cut.py'), png('stop-YW-000.png'), framesDir(name), dir, String(ENTRANCE_CUT.threshold), String(ENTRANCE_CUT.blend), String(Math.round(STOP_CUE * FPS))))
    if (cut.cut >= count - 6) throw new Error(`the entrance reaches ${ENTRANCE_CUT.threshold}% only at frame ${cut.cut} of ${count}: render a longer one`)
    if (Math.max(...cut.blend) >= 2) throw new Error(`the entrance's blend moved a frame by ${Math.max(...cut.blend)}% (>= 2%)`)
    blend = cut.blend
    count = cut.frames
  } else if (dest && (name.startsWith('pan-') || name.startsWith('close-'))) {
    dir = framesDir(`${name}-cut`)
    cut = JSON.parse(py(path.join(HERE, 'phone-bake-cut.py'), png(`stop-${dest}.png`), framesDir(name), dir, String(SETTLE_CUT.threshold), String(SETTLE_CUT.blend), String(SETTLE_CUT.minFrames - 1)))
    if (Math.max(...cut.blend) >= 2) throw new Error(`${name}: the blend moved a frame by ${Math.max(...cut.blend)}% (>= 2%)`)
    count = cut.frames
    if (q) { q = q.slice(0, count); cam = cam.slice(0, count) }
    blend = cut.blend
  }
  encodeClip(dir, mp4, { crf: enc.crf, width: enc.width })
  const a = hashed(OUT, name, 'mp4', mp4)
  R.clip[name] = { ...a, w: enc.width, h: enc.width * 2, frames: count, fps: FPS, crf: enc.crf, marks, blend, ...(cut ? { cut: { frame: cut.cut, residual: cut.residual, blend: cut.blend.length } } : {}), ...(quads ? { quads: q, cam } : {}) }
}

const clipJob = (name, body, quads = false) => async () => {
  const t = Date.now(), meta = path.join(framesDir(name), 'meta.json')
  if (REUSE && fs.existsSync(meta)) finishClip(name, JSON.parse(fs.readFileSync(meta, 'utf8')), quads)
  else {
    let res
    for (let attempt = 1; ; attempt++) {
      try { res = await sess(DPR_CLIP, (s) => body(s), { label: name }); break } catch (e) { if (attempt >= 2) throw e; log(`${name}: ${e.message} (retrying once)`) }
    }
    fs.writeFileSync(meta, JSON.stringify(res))
    finishClip(name, res, quads)
    if (!KEEP) fs.rmSync(framesDir(name), { recursive: true, force: true })
  }
  log(`clip ${name} ${R.clip[name].frames} frames, ${R.clip[name].w}px crf ${R.clip[name].crf}, ${(R.clip[name].bytes / 1024).toFixed(0)} KB (${((Date.now() - t) / 1000).toFixed(0)} s)`)
}

const panJob = (a, b) => clipJob(`pan-${a}-${b}`, async (s) => {
  await s.settle(a)
  return { ...(await renderClip(`pan-${a}-${b}`, async (i) => { if (i === 0) await s.stopCue(b); else await s.step() }, s, { n: PAN_FRAMES })), dest: b }
})
const openJob = (id) => clipJob(`open-${id}`, async (s) => {
  await s.settle(id)
  return renderClip(`open-${id}`, async (i) => { if (i === 0) await s.ph('open'); else await s.step() }, s, { n: OPEN_FRAMES, quads: true })
}, true)
const closeJob = (id) => clipJob(`close-${id}`, async (s) => {
  await s.settle(id)
  await s.ph('open'); for (let i = 0; i < holdSteps(id); i++) await s.step()
  return { ...(await renderClip(`close-${id}`, async (i) => { if (i === 0) await s.ph('close'); else await s.step() }, s, { n: CLOSE_FRAMES, quads: true })), dest: id }
}, true)
const entranceJob = () => clipJob('entrance', async (s) => {
  // the engine's own entrance, replayed without the home's brief; the push onto the cover is the prototype's cue
  await s.p.evaluate(() => { const a = window.__cf; a.setBrief(false); a.holdEntrance(); a.releaseEntrance() })
  let cued = false
  const r = await renderClip('entrance', async (i) => {
    if (!cued && i / FPS >= STOP_CUE - 1e-6) { cued = true; await s.stopCue('YW-000') }
    if (i > 0) await s.step()
  }, s, { n: ENTRANCE_FRAMES })
  return { ...r, marks: await s.marks() }
})
// ── main ──
const t0 = Date.now()
let preview = null
const keep = { ok: false }
try {
  let base, headSha = 'dev', hash
  if (arg('dev', '')) { base = String(arg('dev')); hash = inputHash(ROOT).hash; log(`DEV render from ${base}: inputHash is the working tree's`) }
  else {
    headSha = prepareSnapshot(); log(`snapshot ${SNAP} at ${headSha.slice(0, 8)}`)
    hash = inputHash(SNAP).hash
    if (hash !== inputHash(ROOT).hash) throw new Error('inputHash of the snapshot differs from the working tree (uncommitted or unrelated changes in the bake inputs)')
    if (!arg('no-build', false)) { log('vite build --mode bake'); vite('build', '--mode', 'bake', '--outDir', 'dist-bake', '--emptyOutDir') }
    preview = await startPreview(); base = `http://127.0.0.1:${PORT}`; log(`preview on ${base} (pid ${preview.pid})`)
  }
  fs.mkdirSync(WORK, { recursive: true }); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true })
  if (!REUSE) { fs.rmSync(path.join(WORK, 'png'), { recursive: true, force: true }); fs.rmSync(path.join(WORK, 'frames'), { recursive: true, force: true }) }

  BROWSER = await launch(); BASE = base
  const gpu = await assertHardwareGpu(BROWSER)
  log(`GPU: ${gpu}`)

  // which entries the phone Index lists: asked of the page's director (everything but skills and credentials)
  const stops = await sess(DPR_CLIP, (s) => s.stops(), { label: 'probe' })
  const ids = stops.map((x) => x.id)
  for (const x of stops) KINDS[x.id] = x.kind
  log(`stops (${ids.length}): ${ids.join(' ')}`)
  const pairs = REEL.flatMap((a, i) => (i < REEL.length - 1 ? [[a, REEL[i + 1]], [REEL[i + 1], a]] : []))

  // which clips this run makes, and so which stills it needs (a pan blends into its destination's still, a close into its own)
  const panWanted = pairs.filter(([a, b]) => wanted(`pan-${a}-${b}`))
  // (YW-000 has no open / close / window: it goes through the door and the interior, P3c)
  const openIds = ids.filter((id) => id !== 'YW-000' && wanted(`open-${id}`)), closeIds = ids.filter((id) => id !== 'YW-000' && wanted(`close-${id}`))
  const doWindow = (id) => id !== 'YW-000' && wanted(`window-${id}`)
  const needStill = new Set([
    ...ids.filter((id) => wanted(`stop-${id}`) || doWindow(id) || openIds.includes(id) || closeIds.includes(id)),
    ...panWanted.flatMap(([a, b]) => [a, b]), ...(wanted('entrance') || wanted('space-exit') ? ['YW-000'] : []),
  ])

  // ── stills ──
  log(`stills: ${[...needStill].join(' ')}`)
  await pool([...needStill].map((id) => stillJob(id)), JOBS)
  for (const id of needStill) {
    const s = R.stop[id], w = R.win[id]
    toWebp(png(`stop-${id}.png`), path.join(WORK, 'tmp-stop.webp')); s.still = hashed(OUT, `stop-${id}`, 'webp', path.join(WORK, 'tmp-stop.webp'))
    s.reticle = reticle(s.quad0)
    if (!w) continue
    toWebp(png(`window-${id}.png`), path.join(WORK, 'tmp-win.webp')); w.still = hashed(OUT, `window-${id}`, 'webp', path.join(WORK, 'tmp-win.webp'))
    const face = bbox(w.inner)
    w.face = { x0: round(face.x0), y0: round(face.y0), x1: round(face.x1), y1: round(face.y1) }
    try {
      const die = JSON.parse(py(path.join(HERE, 'phone-bake-die.py'), path.join(OUT, w.still.file), String(MASTER.w), String(face.x0), String(face.y0), String(face.x1), String(face.y1)))
      w.die = { x: round(die.die[0], 1), y: round(die.die[1], 1) }; w.dieBox = die.bbox; w.dieHow = 'measured'
    } catch (e) { w.dieError = String(e.message).trim().split(/\r?\n/).pop() }
  }
  // The secure element is measured on the pixels. A drive whose circuit is not drawn (the sealed black one, X-000) has no die to
  // see: its centre is the others' position inside the face (the etched die sits at one place of every drive's face).
  if ([...needStill].some((id) => R.win[id])) {
    const rel = (w) => ({ x: (w.die.x - w.face.x0) / (w.face.x1 - w.face.x0), y: (w.die.y - w.face.y0) / (w.face.y1 - w.face.y0) })
    const ok = [...needStill].map((id) => R.win[id]).filter((w) => w && w.die)
    const med = (a) => [...a].sort((p, q) => p - q)[a.length >> 1]
    if (!ok.length) throw new Error('no die could be measured in any window still')
    const rx = ok.map((w) => rel(w).x), ry = ok.map((w) => rel(w).y), mx = med(rx), my = med(ry)
    const spread = Math.max(Math.max(...rx) - Math.min(...rx), Math.max(...ry) - Math.min(...ry))
    log(`die: ${ok.length}/${[...needStill].filter((id) => R.win[id]).length} measured; position in the face x ${mx.toFixed(4)} y ${my.toFixed(4)}, spread ${(spread * 100).toFixed(2)}% of the face`)
    if (spread > 0.012) throw new Error(`the measured die positions disagree by ${(spread * 100).toFixed(2)}% of the face (> 1.2%)`)
    for (const id of needStill) {
      const w = R.win[id]
      if (w && !w.die) { w.die = { x: round(w.face.x0 + mx * (w.face.x1 - w.face.x0), 1), y: round(w.face.y0 + my * (w.face.y1 - w.face.y0), 1) }; w.dieHow = `derived (${w.dieError})`; log(`die ${id}: ${w.dieHow}`) }
    }
  }

  fs.writeFileSync(path.join(WORK, 'die.json'), JSON.stringify(Object.fromEntries([...needStill].filter((id) => R.win[id]).map((id) => [id, { die: R.win[id].die, how: R.win[id].dieHow, box: R.win[id].dieBox, face: R.win[id].face, reticle: R.stop[id].reticle }])), null, 1))

  // ── the interior (P3c): the door, the tour, the ways out and in, the rest stills, the exit ──
  const SP = spaceJobs({
    sess, sessAt: (dpr, run, opts) => session(BROWSER, BASE, dpr, run, opts), WORK, REUSE, KEEP, log, py, HERE, png, framesDir, wanted, R, roundPts, round,
    RESULT_AT: 0.86, STEP_AT: [0, 0.26, 0.55, 0.86],
  })
  const anyOf = (names) => !ONLY || names.some((n) => wanted(n)) || ONLY.some((t) => names.some((n) => n.startsWith(t)))
  const wantTour = anyOf(SP.tourNames) || wanted('thumb-'), wantOutIn = anyOf(SP.outinNames), wantRest = wanted('rest-') || wanted('hub') || !ONLY, wantExit = wanted('space-exit')
  const interiorJobs = [...(wantTour ? [SP.tourJob()] : []), ...(wantExit ? [SP.exitJob()] : []), ...(wantOutIn ? [SP.outinJob()] : []), ...(wantRest ? [SP.stillsJob(DPR_SPACE_STILL)] : [])]
  // ── clips ──
  await pool([
    ...(wanted('entrance') ? [entranceJob()] : []),
    ...panWanted.map(([a, b]) => panJob(a, b)),
    ...openIds.map((id) => openJob(id)),
    ...closeIds.map((id) => closeJob(id)),
    ...interiorJobs,
  ], JOBS)
  await BROWSER.close()

  // ── the interior's clips (encoded from the frames the jobs left), its stills, and its JSON (space-<hash>.json) ──
  const interiorNames = [...SP.tourNames, ...SP.outinNames, 'space-exit'].filter((n) => wanted(n) && fs.existsSync(path.join(framesDir(n), 'meta.json')))
  for (const n of interiorNames) {
    const meta = JSON.parse(fs.readFileSync(path.join(framesDir(n), 'meta.json'), 'utf8'))
    finishClip(n, meta, n === 'door-YW-000' || n === 'space-exit')
    if (!KEEP && !REUSE) fs.rmSync(framesDir(n), { recursive: true, force: true })
    log(`clip ${n} ${R.clip[n].frames} frames, ${R.clip[n].w}px crf ${R.clip[n].crf}, ${(R.clip[n].bytes / 1024).toFixed(0)} KB`)
  }
  const sixDone = (f) => [0, 1, 2, 3, 4, 5].every(f)
  let spaceM = null
  if (!ONLY && R.clip['space-intro'] && R.clip['space-exit'] && sixDone((i) => R.clip[`space-${i}`] && R.clip[`out-${i}`] && R.clip[`in-${i}`] && fs.existsSync(png(`rest-${i}.png`)) && fs.existsSync(png(`thumb-${i}.webp`))) && fs.existsSync(png('hub.png'))) {
    const clipOf = (n) => { const c = R.clip[n]; return { file: c.file, bytes: c.bytes, w: c.w, h: c.h, frames: c.frames, fps: c.fps } }
    const stillOf = (name, src, dpr, w = MASTER.w * dpr, h = MASTER.h * dpr) => ({ ...hashed(OUT, name, 'webp', src), w, h, dpr })
    const meta = (n) => JSON.parse(fs.readFileSync(path.join(framesDir(n), 'meta.json'), 'utf8'))
    const AREAS = JSON.parse(fs.readFileSync(path.join(WORK, 'areas.json'), 'utf8'))
    const stations = [0, 1, 2, 3, 4, 5].map((i) => {
      const m = meta(`space-${i}`)
      toWebp(png(`rest-${i}.png`), path.join(WORK, 'tmp-rest.webp'))
      return {
        index: i, key: AREAS[i].key, entry: AREAS[i].entry, clip: clipOf(`space-${i}`), p: m.p, resultFrame: m.resultFrame, stepFrames: m.stepFrames,
        chips: m.chips, plate: m.plate,
        rest: stillOf(`rest-${i}`, path.join(WORK, 'tmp-rest.webp'), DPR_SPACE_STILL),
        thumb: stillOf(`thumb-${i}`, png(`thumb-${i}.webp`), 1, 360, 225),
      }
    })
    toWebp(png('hub.png'), path.join(WORK, 'tmp-hub.webp'))
    const ex = R.clip['space-exit'], exm = meta('space-exit')
    spaceM = {
      version: 1, inputHash: hash, fps: FPS, region: SP.REGION,
      handoff: JSON.parse(fs.readFileSync(path.join(WORK, 'handoff.json'), 'utf8')),
      intro: clipOf('space-intro'), stations,
      fly: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [`${i}>${i + 1}`, clipOf(`fly-${i}-${i + 1}`)])),
      out: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [String(i), clipOf(`out-${i}`)])),
      in: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [String(i), clipOf(`in-${i}`)])),
      hub: stillOf('hub', path.join(WORK, 'tmp-hub.webp'), DPR_SPACE_STILL),
      exit: { ...clipOf('space-exit'), quads: ex.quads.map((q) => q.map(([x, y]) => ({ x, y }))), cam: ex.cam, doorFrame: exm.doorFrame },
    }
  }

  // ── manifest ──
  const still = (a, dpr = DPR_STILL) => ({ file: a.file, bytes: a.bytes, w: MASTER.w * dpr, h: MASTER.h * dpr, dpr })
  const clip = (n) => { const c = R.clip[n]; return { file: c.file, bytes: c.bytes, w: c.w, h: c.h, frames: c.frames, fps: c.fps } }
  const manifest = { version: 1, inputHash: hash, master: { ...MASTER }, reel: [...REEL], stops: {}, pans: {}, open: {}, close: {} }
  for (const id of needStill) if (wanted(`stop-${id}`)) manifest.stops[id] = { id, still: still(R.stop[id].still), reticle: R.stop[id].reticle, quad: roundPts(R.stop[id].quad0).map(([x, y]) => ({ x, y })) }
  for (const [a, b] of pairs) if (R.clip[`pan-${a}-${b}`]) manifest.pans[`${a}>${b}`] = clip(`pan-${a}-${b}`)
  for (const id of ids) {
    const o = R.clip[`open-${id}`], c = R.clip[`close-${id}`]
    if (o) { const w = R.win[id]; manifest.open[id] = { ...clip(`open-${id}`), quads: o.quads.map((q) => q.map(([x, y]) => ({ x, y }))), cam: o.cam, window: still(w.still), die: w.die, face: w.face } }
    if (c) manifest.close[id] = { ...clip(`close-${id}`), quads: c.quads.map((q) => q.map(([x, y]) => ({ x, y }))), cam: c.cam }
  }
  if (R.clip.entrance) manifest.entrance = { ...clip('entrance'), endsOn: 'YW-000' }
  if (R.clip['door-YW-000']) { const c = R.clip['door-YW-000']; manifest.door = { 'YW-000': { ...clip('door-YW-000'), quads: c.quads.map((q) => q.map(([x, y]) => ({ x, y }))), cam: c.cam } } }
  if (spaceM) {
    const buf = Buffer.from(JSON.stringify(spaceM)), file = `space-${sha(buf).slice(0, 10)}.json`
    fs.writeFileSync(path.join(OUT, file), buf); manifest.space = { file, bytes: buf.length }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest))

  // ── budgets ──
  const files = fs.readdirSync(OUT).filter((f) => f !== 'manifest.json')
  const total = files.reduce((n, f) => n + sizeOf(path.join(OUT, f)), 0) + sizeOf(path.join(OUT, 'manifest.json'))
  const first = manifest.entrance && manifest.stops['YW-000'] && manifest.pans['YW-000>X-001']
    ? manifest.entrance.bytes + manifest.stops['YW-000'].still.bytes + manifest.pans['YW-000>X-001'].bytes : null
  log(`total ${(total / 1048576).toFixed(2)} MB in ${files.length + 1} files; first screen (entrance + cover still + first pan) ${first == null ? 'n/a' : (first / 1048576).toFixed(2) + ' MB'}`)
  const failures = []
  if (!PARTIAL && total > 45 * 1048576) failures.push(`public/phone is ${(total / 1048576).toFixed(2)} MB > 45 MB`)
  const interiorBytes = files.filter((f) => /^(space|fly|out|in|rest|hub|thumb)[-.]/.test(f)).reduce((n, f) => n + sizeOf(path.join(OUT, f)), 0)
  if (spaceM) { log(`interior ${(interiorBytes / 1048576).toFixed(2)} MB (budget 12)`); if (interiorBytes > INTERIOR_MAX) failures.push(`the interior is ${(interiorBytes / 1048576).toFixed(2)} MB > 12 MB`) }
  if (first != null && first > 3 * 1048576) failures.push(`entrance + cover still + first pan is ${(first / 1048576).toFixed(2)} MB > 3 MB`)
  if (failures.length) throw new Error(`BUDGET FAILED (output kept in ${OUT}): ${failures.join('; ')}`)

  // ── checks (clip ends vs stills, hard-cut scan) ──
  const report = await runChecks(manifest, OUT, { evidence: EVIDENCE, work: path.join(WORK, 'check'), space: spaceM })
  if (!report.ok) throw new Error(`CHECKS FAILED (output kept in ${OUT}): ${report.failures.join('; ')}`)

  // ── publish ──
  if (!PARTIAL) {
    const pub = path.join(ROOT, 'public/phone')
    fs.rmSync(pub, { recursive: true, force: true }); fs.mkdirSync(pub, { recursive: true })
    for (const f of fs.readdirSync(OUT)) fs.copyFileSync(path.join(OUT, f), path.join(pub, f))
    log(`published ${files.length + 1} files to public/phone`)
  } else log(`partial bake kept in ${OUT} (public/phone untouched)`)
  keep.ok = true
  log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`)
} finally {
  stopPreview(preview)
}
process.exit(keep.ok ? 0 : 1)
