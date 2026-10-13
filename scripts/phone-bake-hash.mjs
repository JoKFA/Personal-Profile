// The bake's input hash: sha256 over everything the baked pictures depend on (plan §2.3):
//   src/casefile/data/*.ts, src/casefile/phone/bake/**, src/casefile/scene/**, src/casefile/motion/**
// (tests excluded: editing a test must not demand a re-bake; line endings normalised: a CRLF checkout hashes the same)
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const INPUTS = [
  { dir: 'src/casefile/data', deep: false },
  { dir: 'src/casefile/phone/bake', deep: true },
  { dir: 'src/casefile/scene', deep: true },
  { dir: 'src/casefile/motion', deep: true },
]
const isTest = (f) => /\.test\.[cm]?[jt]sx?$/.test(f)

export function inputFiles(root) {
  const out = []
  const walk = (abs, rel, deep) => {
    if (!fs.existsSync(abs)) return
    for (const e of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = `${rel}/${e.name}`
      if (e.isDirectory()) { if (deep) walk(path.join(abs, e.name), r, deep) } else if (!isTest(e.name) && (deep || e.name.endsWith('.ts'))) out.push(r)
    }
  }
  for (const { dir, deep } of INPUTS) walk(path.join(root, dir), dir, deep)
  return out.sort()
}

export function inputHash(root) {
  const h = crypto.createHash('sha256')
  const files = inputFiles(root)
  for (const f of files) h.update(f).update('\0').update(fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n')).update('\0')
  return { hash: h.digest('hex'), files: files.length }
}
