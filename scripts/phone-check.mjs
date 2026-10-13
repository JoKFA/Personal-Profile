// `npm run phone:check`: fails when the baked phone pictures are stale, i.e. the sources they were rendered from have
// changed (hash of the data, the bake's director, the engine's scene and motion files; see phone-bake-hash.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inputHash } from './phone-bake-hash.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = path.join(root, 'public/phone/manifest.json')
if (!fs.existsSync(file)) { console.error('phone:check FAILED: public/phone/manifest.json is missing. Run `npm run phone:bake`.'); process.exit(1) }
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
const now = inputHash(root)
if (manifest.inputHash !== now.hash) {
  console.error(`phone:check FAILED: the baked pictures are stale (content changed: the data, the bake director or the engine's scene/motion files).\n  manifest ${manifest.inputHash}\n  sources  ${now.hash}  (${now.files} files)\nRun \`npm run phone:bake\` again.`)
  process.exit(1)
}
console.log(`phone:check ok: inputHash ${now.hash.slice(0, 12)} (${now.files} files) matches public/phone/manifest.json`)
