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
function clipsOf(manifest, dir, space) {
  const out = []
  const st = (id) => find(dir, `stop-${id}`), win = (id) => find(dir, `window-${id}`)
  if (manifest.entrance) out.push({ name: 'entrance', file: manifest.entrance.file, last: st(manifest.entrance.endsOn) })
  for (const [k, c] of Object.entries(manifest.pans)) { const [a, b] = k.split('>'); out.push({ name: `pan-${a}-${b}`, file: c.file, first: st(a), last: st(b) }) }
  for (const [id, c] of Object.entries(manifest.open)) out.push({ name: `open-${id}`, file: c.file, first: st(id), last: win(id) })
  for (const [id, c] of Object.entries(manifest.close)) out.push({ name: `close-${id}`, file: c.file, first: win(id), last: st(id) })
  for (const [id, c] of Object.entries(manifest.door || {})) out.push({ name: `door-${id}`, file: c.file, first: st(id) })
  if (space) {
    // P3c: the interior. A clip's ends against the stills they should meet (the rest of the junctions are frame to frame, below)
    const rest = (i) => find(dir, `rest-${i}`), hub = find(dir, 'hub')
    out.push({ name: 'space-intro', file: space.intro.file })
    space.stations.forEach((s, i) => out.push({ name: `space-${i}`, file: s.clip.file, last: rest(i) }))
    for (const [k, c] of Object.entries(space.fly)) { const i = +k.split('>')[0]; out.push({ name: `fly-${i}-${i + 1}`, file: c.file, first: rest(i) }) }
    for (const [k, c] of Object.entries(space.out)) out.push({ name: `out-${k}`, file: c.file, first: rest(+k), last: hub })
    for (const [k, c] of Object.entries(space.in)) out.push({ name: `in-${k}`, file: c.file, first: hub })
    out.push({ name: 'space-exit', file: space.exit.file, first: hub, last: st('YW-000') })
  }
  return out
}

export async function runChecks(manifest, dir, { evidence = '', work, space = null }) {
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true })
  const ends = path.join(work, '_ends'); fs.mkdirSync(ends)
  if (!space && manifest.space && fs.existsSync(path.join(dir, manifest.space.file))) space = JSON.parse(fs.readFileSync(path.join(dir, manifest.space.file), 'utf8'))
  const clips = clipsOf(manifest, dir, space)
  const rows = await pool(clips.map((c) => async () => {
    const fr = path.join(work, c.name); fs.mkdirSync(fr, { recursive: true })
    ffmpeg('-i', path.join(dir, c.file), path.join(fr, 'f-%04d.png'))
    const n = fs.readdirSync(fr).length
    fs.copyFileSync(path.join(fr, `f-${pad(1)}.png`), path.join(ends, `${c.name}.first.png`)); fs.copyFileSync(path.join(fr, `f-${pad(n)}.png`), path.join(ends, `${c.name}.last.png`))
    const row = { name: c.name, frames: n }
    if (c.first) row.firstDiff = +py(path.join(HERE, 'phone-bake-diff.py'), path.join(fr, `f-${pad(1)}.png`), c.first).trim()
    if (c.last) row.lastDiff = +py(path.join(HERE, 'phone-bake-diff.py'), path.join(fr, `f-${pad(n)}.png`), c.last).trim()
    // (ffmpeg numbers decoded frames from 1; the encoder's frame i is f-<i+1>)
    if (c.name === 'space-exit' && space) { fs.copyFileSync(path.join(fr, `f-${pad(space.exit.doorFrame)}.png`), path.join(ends, 'exit-cutA.png')); fs.copyFileSync(path.join(fr, `f-${pad(space.exit.doorFrame + 1)}.png`), path.join(ends, 'exit-cutB.png')) }
    const en = JSON.parse(py(path.join(HERE, 'phone-bake-energy.py'), fr))
    row.energy = { median: en.median, max: en.max, needles: en.needles, top: en.top.slice(0, 3) }
    row.energySeries = en.energy; row.std = en.std
    fs.rmSync(fr, { recursive: true, force: true })
    return row
  }), 4)
  rows.sort((a, b) => (a.name < b.name ? -1 : 1))
  const failures = []
  // dead frames: a flight, the way out or the exit must never show paper alone (std of a 195 x 332 luma < 2.0) for 2 frames or more: one continuous anchor in frame
  for (const r of rows) if (/^(fly|in|out)-/.test(r.name) || r.name === 'space-exit') {
    let i = 0; const runs = []
    while (i < r.std.length) { if (r.std[i] < 2.0) { let j = i; while (j + 1 < r.std.length && r.std[j + 1] < 2.0) j++; if (j - i + 1 >= 2) runs.push([i + 1, j + 1]); i = j + 1 } else i++ }
    r.featurelessRuns = runs
    if (runs.length) failures.push(`${r.name} has featureless runs (frames, 1-based): ${JSON.stringify(runs)}`)
  }
  // frame-to-frame junctions of the interior: the picture must carry on across the cut between two clips
  const junctions = []
  if (space) {
    const E = (n, w) => path.join(ends, `${n}.${w}.png`), diff = (a, b) => +py(path.join(HERE, 'phone-bake-diff.py'), a, b).trim()
    const J = (name, a, b, soft = false) => { const d = diff(a, b); junctions.push({ name, diff: d, soft }); if (!soft && d >= END_TOLERANCE) failures.push(`junction ${name} differs ${d}% (>= ${END_TOLERANCE}%)`) }
    const hub = find(dir, 'hub')
    J('exit: interior last -> exterior first (the cut)', path.join(ends, 'exit-cutA.png'), path.join(ends, 'exit-cutB.png'))
    J('door last (the cut) -> intro first (the match cut)', E('door-YW-000', 'last'), E('space-intro', 'first'), true)
    J('intro last -> space-0 first', E('space-intro', 'last'), E('space-0', 'first'))
    for (let i = 0; i < 5; i++) {
      J(`space-${i} last -> fly-${i}-${i + 1} first`, E(`space-${i}`, 'last'), E(`fly-${i}-${i + 1}`, 'first'))
      J(`fly-${i}-${i + 1} last -> space-${i + 1} first`, E(`fly-${i}-${i + 1}`, 'last'), E(`space-${i + 1}`, 'first'))
    }
    for (let i = 0; i < 6; i++) {
      J(`out-${i} last -> hub`, E(`out-${i}`, 'last'), hub)
      J(`hub -> in-${i} first`, hub, E(`in-${i}`, 'first'))
      J(`in-${i} last -> space-${i} first`, E(`in-${i}`, 'last'), E(`space-${i}`, 'first'))
      J(`out-${i} last -> space-exit first`, E(`out-${i}`, 'last'), E('space-exit', 'first'))
    }
  }
  for (const r of rows) {
    if (r.firstDiff !== undefined && r.firstDiff >= END_TOLERANCE) failures.push(`${r.name} first frame differs ${r.firstDiff}% (>= ${END_TOLERANCE}%)`)
    if (r.lastDiff !== undefined && r.lastDiff >= END_TOLERANCE) failures.push(`${r.name} last frame differs ${r.lastDiff}% (>= ${END_TOLERANCE}%)`)
    if (r.energy.needles.length) failures.push(`${r.name} has a hard-cut needle: ${JSON.stringify(r.energy.needles)}`)
  }
  for (const j of junctions) console.log(`junction ${j.name}: ${j.diff}%${j.soft ? '  (reported, not gated)' : ''}`)
  const lines = ['clip | frames | first vs source still % | last vs destination still % | energy median | max | top 3 (s=value) | needles', '--- | --- | --- | --- | --- | --- | --- | ---']
  for (const r of rows) lines.push([r.name, r.frames, r.firstDiff ?? '-', r.lastDiff ?? '-', r.energy.median, r.energy.max, r.energy.top.map((t) => `${t.t}s=${t.e}`).join(' '), r.energy.needles.length ? JSON.stringify(r.energy.needles) : 'none'].join(' | '))
  console.log(lines.join('\n'))
  if (evidence) {
    fs.mkdirSync(evidence, { recursive: true })
    fs.writeFileSync(path.join(evidence, 'checks.json'), JSON.stringify({ ok: failures.length === 0, failures, tolerance: END_TOLERANCE, junctions, rows }, null, 1))
    fs.writeFileSync(path.join(evidence, 'checks.txt'), lines.join('\n') + '\n')
    fs.appendFileSync(path.join(evidence, 'checks.txt'), junctions.map((j) => `junction ${j.name}: ${j.diff}%${j.soft ? ' (reported, not gated)' : ''}`).join(String.fromCharCode(10)) + String.fromCharCode(10))
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
