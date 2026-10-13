// The bake's acceptance checks, run on the encoded files (what a phone will decode):
//   1. every clip's last frame vs its destination still, and its first frame vs its source still: mean abs diff < 2% of 255
//   2. every clip's frames through the hard-cut scan (motion energy per frame; a needle = > 3x both neighbours and > 4)
// node scripts/phone-bake-checks.mjs <public/phone dir> [--evidence=dir]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ffmpeg, pad, pool, py } from './phone-bake-lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const END_TOLERANCE = 2   // % of 255

const find = (dir, name) => { const f = fs.readdirSync(dir).find((x) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[0-9a-f]{10}\\.webp$`).test(x)); if (!f) throw new Error(`no still ${name} in ${dir}`); return path.join(dir, f) }

/** every clip with what its ends should match: [name, file, firstStill?, lastStill?] */
function clipsOf(manifest, dir) {
  const out = []
  const st = (id) => find(dir, `stop-${id}`), win = (id) => find(dir, `window-${id}`)
  if (manifest.entrance) out.push({ name: 'entrance', file: manifest.entrance.file, last: st(manifest.entrance.endsOn) })
  for (const [k, c] of Object.entries(manifest.pans)) { const [a, b] = k.split('>'); out.push({ name: `pan-${a}-${b}`, file: c.file, first: st(a), last: st(b) }) }
  for (const [id, c] of Object.entries(manifest.open)) out.push({ name: `open-${id}`, file: c.file, first: st(id), last: win(id) })
  for (const [id, c] of Object.entries(manifest.close)) out.push({ name: `close-${id}`, file: c.file, first: win(id), last: st(id) })
  for (const [id, c] of Object.entries(manifest.door || {})) out.push({ name: `door-${id}`, file: c.file })
  return out
}

export async function runChecks(manifest, dir, { evidence = '', work }) {
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true })
  const clips = clipsOf(manifest, dir)
  const rows = await pool(clips.map((c) => async () => {
    const fr = path.join(work, c.name); fs.mkdirSync(fr, { recursive: true })
    ffmpeg('-i', path.join(dir, c.file), path.join(fr, 'f-%04d.png'))
    const n = fs.readdirSync(fr).length
    const row = { name: c.name, frames: n }
    if (c.first) row.firstDiff = +py(path.join(HERE, 'phone-bake-diff.py'), path.join(fr, `f-${pad(1)}.png`), c.first).trim()
    if (c.last) row.lastDiff = +py(path.join(HERE, 'phone-bake-diff.py'), path.join(fr, `f-${pad(n)}.png`), c.last).trim()
    // (ffmpeg numbers decoded frames from 1; the encoder's frame i is f-<i+1>)
    const en = JSON.parse(py(path.join(HERE, 'phone-bake-energy.py'), fr))
    row.energy = { median: en.median, max: en.max, needles: en.needles, top: en.top.slice(0, 3) }
    row.energySeries = en.energy
    fs.rmSync(fr, { recursive: true, force: true })
    return row
  }), 4)
  rows.sort((a, b) => (a.name < b.name ? -1 : 1))
  const failures = []
  for (const r of rows) {
    if (r.firstDiff !== undefined && r.firstDiff >= END_TOLERANCE) failures.push(`${r.name} first frame differs ${r.firstDiff}% (>= ${END_TOLERANCE}%)`)
    if (r.lastDiff !== undefined && r.lastDiff >= END_TOLERANCE) failures.push(`${r.name} last frame differs ${r.lastDiff}% (>= ${END_TOLERANCE}%)`)
    if (r.energy.needles.length) failures.push(`${r.name} has a hard-cut needle: ${JSON.stringify(r.energy.needles)}`)
  }
  const lines = ['clip | frames | first vs source still % | last vs destination still % | energy median | max | top 3 (s=value) | needles', '--- | --- | --- | --- | --- | --- | --- | ---']
  for (const r of rows) lines.push([r.name, r.frames, r.firstDiff ?? '-', r.lastDiff ?? '-', r.energy.median, r.energy.max, r.energy.top.map((t) => `${t.t}s=${t.e}`).join(' '), r.energy.needles.length ? JSON.stringify(r.energy.needles) : 'none'].join(' | '))
  console.log(lines.join('\n'))
  if (evidence) {
    fs.mkdirSync(evidence, { recursive: true })
    fs.writeFileSync(path.join(evidence, 'checks.json'), JSON.stringify({ ok: failures.length === 0, failures, tolerance: END_TOLERANCE, rows }, null, 1))
    fs.writeFileSync(path.join(evidence, 'checks.txt'), lines.join('\n') + '\n')
  }
  fs.rmSync(work, { recursive: true, force: true })
  return { ok: failures.length === 0, failures, rows }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = path.resolve(process.argv[2] || 'public/phone')
  const ev = process.argv.find((a) => a.startsWith('--evidence='))?.slice(11) || ''
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const r = await runChecks(manifest, dir, { evidence: ev, work: path.join(dir, '..', 'phone-check-work') })
  if (!r.ok) { console.error('CHECKS FAILED:\n  ' + r.failures.join('\n  ')); process.exit(1) }
  console.log('checks ok')
}
