// Which chunks the phone shell can reach (static and dynamic imports from PhoneApp-*.js), and whether any holds three.js.
//   node p3c-chunks.mjs <dist dir> [out.json]
import fs from 'node:fs'
import path from 'node:path'

const dist = process.argv[2], out = process.argv[3]
const dir = path.join(dist, 'assets')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
const text = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]))
const refs = (src) => {
  const st = new Set(), dy = new Set()
  for (const m of src.matchAll(/(?:from|import)\s*["'`]\.\/([^"'`]+\.js)["'`]/g)) st.add(m[1])
  for (const m of src.matchAll(/import\(\s*["'`]\.\/([^"'`]+\.js)["'`]\s*\)/g)) dy.add(m[1])
  // (vite's preload map lists every dynamic dependency of the whole app as "assets/x.js" strings: it says nothing about which chunk loads which, so it is not read)
  return { st, dy }
}
const three = (src) => /WebGLRenderer|MeshStandardMaterial|BufferGeometry/.test(src)
const entry = files.find((f) => /^PhoneApp-.*\.js$/.test(f))
const seen = new Map()
// the main chunk (index) holds the whole app, including the desktop's lazy imports: those are not the phone shell's, so a dynamic import is followed only from the phone's own chunks
const walk = (f, via) => { if (seen.has(f) || !text[f]) return; seen.set(f, via); const r = refs(text[f]); for (const x of r.st) walk(x, 'static'); if (!/^index-/.test(f)) for (const x of r.dy) walk(x, 'dynamic') }
walk(entry, 'entry')
const rows = [...seen].map(([f, via]) => ({ chunk: f, via, kb: +(Buffer.byteLength(text[f]) / 1024).toFixed(1), three: three(text[f]) }))
const all = files.map((f) => ({ chunk: f, three: three(text[f]) })).filter((x) => x.three).map((x) => x.chunk)
const res = { entry, reachable: rows, reachableWithThree: rows.filter((r) => r.three).map((r) => r.chunk), chunksWithThree: all }
console.log(JSON.stringify(res, null, 1))
if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1))
