// Smoke test of the real build output (run after `npm run build`).
// Every sitemap route must have its own prerendered HTML with a distinct title and description,
// every referenced asset must exist, and the site must actually serve them through `vite preview`.
import fs from 'node:fs'
import path from 'node:path'
import { preview } from 'vite'

const dist = path.resolve('dist')
const fail = (msg) => { console.error(`smoke: FAIL ${msg}`); process.exitCode = 1 }

const sitemap = fs.readFileSync(path.resolve('public/sitemap.xml'), 'utf8')
const routes = [...sitemap.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1].replace(/\/$/, '') || '/')
if (routes.length < 2) fail(`sitemap lists ${routes.length} routes`)

const titles = new Map()
const assets = new Set()
for (const route of routes) {
  const file = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route, 'index.html')
  if (!fs.existsSync(file)) { fail(`${route}: no prerendered ${path.relative(dist, file)}`); continue }
  const html = fs.readFileSync(file, 'utf8')
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]
  if (!title) fail(`${route}: missing <title>`)
  else if (titles.has(title)) fail(`${route}: same title as ${titles.get(title)} ("${title}")`)
  else titles.set(title, route)
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) fail(`${route}: missing meta description`)
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) assets.add(m[1])
}
if (!assets.size) fail('no /assets/ references found in built HTML')
for (const a of assets) if (!fs.existsSync(path.join(dist, a))) fail(`missing asset ${a}`)

const server = await preview({ preview: { port: 4179, strictPort: true, open: false }, logLevel: 'silent' })
try {
  for (const url of [...routes, ...assets]) {
    const res = await fetch(`http://localhost:4179${url}`)
    if (res.status !== 200) fail(`GET ${url} -> ${res.status}`)
  }
} finally {
  await server.close()
}

if (!process.exitCode) console.log(`smoke: ok — ${routes.length} routes, ${assets.size} assets served`)
