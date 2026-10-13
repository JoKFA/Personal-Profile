// TEMPORARY: writes public/phone-dev/manifest.json (the PhoneManifest shape of src/casefile/phone/manifest.ts)
// from the P0 spike's frozen assets (public/phone-spike/frozen/). Used with ?phone-dev until the bake (P1) writes public/phone/manifest.json.
//   node src/casefile/phone/app/dev/make-dev-manifest.mjs
// What is real: stop-YW-000, stop-X-001, window-X-001, the cover->X-001 pan and open-X-001 (all P0 spike pictures).
// What is stand-in: the X-001->cover pan and close-X-001 are the same clips played backwards (ffmpeg -vf reverse);
// stop-SR-01 / SR-02 / X-009 are hue-shifted copies of stop-X-001; there are no pans between stops 01..04 (the
// runtime cross-fades them) and no open for stops other than X-001; `cam` is derived from the face quad's width.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../../../..')
// the FROZEN set: the archive's idle breathing held at 0 in the baked pixels (P0 finding 1), so clip ends match their stills (0.7-0.8% instead of 3-6%)
const spike = JSON.parse(fs.readFileSync(path.join(root, 'public/phone-spike/frozen/manifest.json'), 'utf8'))
const A = spike.assets
const size = (rel) => fs.statSync(path.join(root, 'public/phone-dev', rel)).size

const still = (file, a, dpr = 3) => ({ file, bytes: size(file), w: a.px[0], h: a.px[1], dpr })
const clip = (file, a) => ({ file, bytes: size(file), w: a.px[0], h: a.px[1], frames: a.frames, fps: a.fps })
const reticle = A['stop-X-001'].reticle
const quads = A['open-X-001'].quads
const win = A['window-X-001']
const quadW = (q) => Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1])
const w0 = quadW(quads[0]), w1 = quadW(win.quad)
const cam = quads.map((q) => Math.min(1, Math.max(0, (quadW(q) - w0) / (w1 - w0))))
cam[cam.length - 1] = 1
const xs = win.quad.map((p) => p[0]), ys = win.quad.map((p) => p[1])
const face = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }

// spike files are referenced in place (../phone-spike/…): the runtime resolves `file` against the manifest's folder
const sp = (name) => `../phone-spike/frozen/${name}`
const spSize = (name) => fs.statSync(path.join(root, 'public/phone-spike/frozen', name)).size
const spStill = (name, a) => ({ file: sp(name), bytes: spSize(name), w: a.px[0], h: a.px[1], dpr: 3 })
const spClip = (name, a) => ({ file: sp(name), bytes: spSize(name), w: a.px[0], h: a.px[1], frames: a.frames, fps: a.fps })

const x001Quad = quads[0]
const stops = {
  'YW-000': { id: 'YW-000', still: spStill('stop-YW-000.webp', A['stop-YW-000']), reticle: A['stop-YW-000'].reticle, quad: [[A['stop-YW-000'].reticle.x0, A['stop-YW-000'].reticle.y0], [A['stop-YW-000'].reticle.x1, A['stop-YW-000'].reticle.y0], [A['stop-YW-000'].reticle.x1, A['stop-YW-000'].reticle.y1], [A['stop-YW-000'].reticle.x0, A['stop-YW-000'].reticle.y1]].map(([x, y]) => ({ x, y })) },
  'X-001': { id: 'X-001', still: spStill('stop-X-001.webp', A['stop-X-001']), reticle, quad: x001Quad.map(([x, y]) => ({ x, y })) },
}
for (const id of ['SR-01', 'SR-02', 'X-009']) stops[id] = { id, still: still(`stop-${id}.webp`, A['stop-X-001']), reticle, quad: x001Quad.map(([x, y]) => ({ x, y })) }

const pt = ([x, y]) => ({ x, y })
const openAsset = A['open-X-001']
const manifest = {
  version: 1,
  inputHash: 'dev-spike',
  master: spike.master,
  reel: ['YW-000', 'X-001', 'SR-01', 'SR-02', 'X-009'],
  // stand-in: the app never plays the entrance in P2
  entrance: { ...spClip('pan-YW-000-X-001.mp4', A['pan-YW-000-X-001']), endsOn: 'YW-000' },
  stops,
  pans: {
    'YW-000>X-001': spClip('pan-YW-000-X-001.mp4', A['pan-YW-000-X-001']),
    'X-001>YW-000': clip('pan-X-001-YW-000.mp4', A['pan-YW-000-X-001']),
  },
  open: {
    'X-001': {
      ...spClip('open-X-001.mp4', openAsset),
      quads: quads.map((q) => q.map(pt)),
      cam,
      window: spStill('window-X-001.webp', win),
      die: pt(win.die),
      face,
    },
  },
  close: {
    'X-001': {
      ...clip('close-X-001.mp4', openAsset),
      quads: quads.slice().reverse().map((q) => q.map(pt)),
      cam: cam.slice().reverse(),
    },
  },
}
fs.writeFileSync(path.join(root, 'public/phone-dev/manifest.json'), JSON.stringify(manifest, null, 1))
console.log('wrote public/phone-dev/manifest.json', Object.keys(manifest.stops), Object.keys(manifest.pans), 'cam', cam.filter((_, i) => i % 7 === 0).map((c) => +c.toFixed(2)))
