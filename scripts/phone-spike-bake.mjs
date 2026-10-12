// P0.1 minimal bake for the phone spike: scene-only stills and clips from the real engine (?phone&bake), frame-exact.
// node scripts/phone-spike-bake.mjs [outDir] [tmpDir]      (dev server on :5194, or BASE=...)
// Stills: 390x866 css px at dpr 3, WebP. Clips: dpr 2, 25 fps, H.264. Nothing here changes lab.ts's timeline numbers.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { session, W, H, FPS, STEP } from './phone-spike-lib.mjs'
const OUT = path.resolve(process.argv[2] || 'public/phone-spike')
const TMP = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'phone-spike-bake'))
const PAN_FRAMES = Number(process.env.PAN_FRAMES || 41)      // 1.6 s + the settled frame 0
const OPEN_FRAMES = Number(process.env.OPEN_FRAMES || 50)    // 2.0 s

fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true })

const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a])
const encodeClip = (dir, out) => ff('-framerate', String(FPS), '-i', path.join(dir, 'f-%04d.png'),
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-r', String(FPS),
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', out)
const toWebp = (png, out) => ff('-i', png, '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', out)
const size = (f) => fs.statSync(f).size

/** the reticle rectangle exactly as overlay.ts places it once a stop has settled (master css px) */
function reticle(quad, id) {
  const xs = quad.map((q) => q[0]), ys = quad.map((q) => q[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const hw = (Math.max(...xs) - Math.min(...xs)) / 2 * 1.1 + 12, hh = (Math.max(...ys) - Math.min(...ys)) / 2 * 1.1 + 12
  const top = id === 'YW-000' ? 300 : 76, bottom = H - (id === 'YW-000' ? 168 : 252) - 14
  return { x0: cx - hw, y0: Math.max(top, cy - hh), x1: cx + hw, y1: Math.min(bottom, cy + hh) }
}

const manifest = { master: { w: W, h: H }, fps: FPS, assets: {} }

// ── stills, dpr 3 ──
await session(3, async (s) => {
  await s.warmRun([['stop', 'YW-000', 2500], ['stop', 'X-001', 2500], ['open', undefined, 3000], ['stop', 'YW-000', 2500]])
  await s.manual()
  for (const id of ['YW-000', 'X-001']) {
    await s.stopAndSettle(id)
    const png = path.join(TMP, `stop-${id}.png`); await s.shot(png)
    const file = `stop-${id}.webp`; toWebp(png, path.join(OUT, file))
    manifest.assets[`stop-${id}`] = { file, kind: 'still', px: [W * 3, H * 3], bytes: size(path.join(OUT, file)), reticle: reticle(await s.quad(0), id) }
  }
  // the open window: settled well after the clip's end (2.0 s)
  await s.ph('open')
  for (let i = 0; i < 100; i++) await s.step()
  const png = path.join(TMP, 'window-X-001.png'); await s.shot(png)
  toWebp(png, path.join(OUT, 'window-X-001.webp'))
  // the secure element: its centre is the etched die's centre, face uv (0.6914, 0.5421) of the face plane (drive.ts faceTraces: rect 600..816 x 264..432 on 1024x760,
  // plane 4.38 x 3.3 centred at x 0, y 0.2..3.5, z BOARD_Z), projected through the live camera and the drive's world matrix
  const die = await s.p.evaluate(() => {
    const a = window.__cf, T = 0.376, BOARD_Z = (T - 0.16) / 2 + 0.002
    const x = (708 / 1024 - 0.5) * 4.38, y = 0.2 + (1 - 348 / 760) * 3.3
    a.heroGroup.updateMatrixWorld(); a.tmp.set(x, y, BOARD_Z).applyMatrix4(a.heroGroup.matrixWorld).project(a.stage.camera)
    return [(a.tmp.x + 1) / 2 * innerWidth, (1 - a.tmp.y) / 2 * innerHeight]
  })
  // measured on the pixels: the centroid of the die's flat brown fill (phone-spike-die.py). dieProjected is the analytic guess above, kept to show how far off it is.
  const measured = JSON.parse(execFileSync('python', [path.join(path.dirname(fileURLToPath(import.meta.url)), 'phone-spike-die.py'), path.join(OUT, 'window-X-001.webp')]).toString())
  manifest.assets['window-X-001'] = { file: 'window-X-001.webp', kind: 'still', px: [W * 3, H * 3], bytes: size(path.join(OUT, 'window-X-001.webp')), die: measured.die, dieBbox: measured.bbox, dieHow: 'centroid of the die fill in the settled window still, found by colour (scripts/phone-spike-die.py), master css px', dieProjected: die, quad: await s.quad(0.5) }
})

// ── clips, dpr 2 ──
await session(2, async (s) => {
  await s.warmRun([['stop', 'YW-000', 2500], ['stop', 'X-001', 2500], ['open', undefined, 3000], ['stop', 'YW-000', 2500], ['stop', 'X-001', 2500]])
  await s.manual()
  // pan: settled cover -> settled X-001 stop
  {
    const dir = path.join(TMP, 'pan'); fs.mkdirSync(dir)
    await s.stopAndSettle('YW-000')
    for (let i = 0; i < PAN_FRAMES; i++) {
      if (i === 0) await s.ph('stop', 'X-001'); else await s.step()
      await s.shot(path.join(dir, `f-${String(i).padStart(4, '0')}.png`))
    }
    const out = path.join(OUT, 'pan-YW-000-X-001.mp4'); encodeClip(dir, out)
    manifest.assets['pan-YW-000-X-001'] = { file: 'pan-YW-000-X-001.mp4', kind: 'clip', frames: PAN_FRAMES, fps: FPS, px: [W * 2, H * 2], bytes: size(out) }
  }
  // open: settled X-001 stop -> 2.0 s of the open timeline, with the face quad of every frame
  {
    const dir = path.join(TMP, 'open'); fs.mkdirSync(dir)
    await s.stopAndSettle('X-001')
    const quads = []
    for (let i = 0; i < OPEN_FRAMES; i++) {
      if (i === 0) await s.ph('open'); else await s.step()
      quads.push(await s.quad(0.5))
      await s.shot(path.join(dir, `f-${String(i).padStart(4, '0')}.png`))
    }
    const out = path.join(OUT, 'open-X-001.mp4'); encodeClip(dir, out)
    manifest.assets['open-X-001'] = { file: 'open-X-001.mp4', kind: 'clip', frames: OPEN_FRAMES, fps: FPS, px: [W * 2, H * 2], bytes: size(out), quads, quadNote: 'faceQuad(0.5): TL,TR,BR,BL of the drive face in card coordinates, master css px; frame 0 is the settled stop (the open cue fires after it)' }
  }
})

manifest.totalBytes = Object.values(manifest.assets).reduce((n, a) => n + a.bytes, 0)
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest))
console.log('baked', Object.entries(manifest.assets).map(([k, a]) => `${k} ${a.bytes}`).join(', '), 'total', manifest.totalBytes)
