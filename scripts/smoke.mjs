// Smoke test of the real build output (run after `npm run build`).
// Every sitemap route must have its own prerendered HTML with a distinct title and description,
// every referenced asset must exist, and the site must actually serve them through `vite preview`.
import fs from 'node:fs'
import path from 'node:path'
import { preview } from 'vite'
import { OG_IMAGE, SITE_URL } from './site-routes.mjs'

const dist = path.resolve('dist')
const fail = (msg) => { console.error(`smoke: FAIL ${msg}`); process.exitCode = 1 }

const sitemap = fs.readFileSync(path.resolve('public/sitemap.xml'), 'utf8')
const routes = [...sitemap.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((m) => m[1].replace(/\/$/, '') || '/')
if (routes.length < 2) fail(`sitemap lists ${routes.length} routes`)

const titles = new Map()
const assets = new Set()
for (const route of routes) {
  const file = route === '/' ? path.join(dist, 'index.html') : path.join(dist, `${route}.html`)
  if (!fs.existsSync(file)) { fail(`${route}: no prerendered ${path.relative(dist, file)}`); continue }
  const html = fs.readFileSync(file, 'utf8')
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]
  if (!title) fail(`${route}: missing <title>`)
  else if (titles.has(title)) fail(`${route}: same title as ${titles.get(title)} ("${title}")`)
  else titles.set(title, route)
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) fail(`${route}: missing meta description`)
  // share cards and search engines read absolute URLs on the canonical origin (never the vercel.app alias)
  const page = `${SITE_URL}${route}`
  if (!html.includes(`<link rel="canonical" href="${page}">`)) fail(`${route}: canonical is not ${page}`)
  if (!html.includes(`<meta property="og:url" content="${page}">`)) fail(`${route}: og:url is not ${page}`)
  if (!html.includes(`<meta property="og:image" content="${SITE_URL}${OG_IMAGE.path}">`)) fail(`${route}: og:image is not ${SITE_URL}${OG_IMAGE.path}`)
  if (!/<meta property="og:image:alt" content="[^"]{10,}">/.test(html)) fail(`${route}: missing og:image:alt`)
  if (/vercel\.app/.test(html)) fail(`${route}: still mentions a vercel.app address`)
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) assets.add(m[1])
}
// the share card: a JPEG of the size the tags promise, small enough for every preview service
const card = path.join(dist, OG_IMAGE.path)
if (!fs.existsSync(card)) fail(`missing ${OG_IMAGE.path}`)
else {
  const jpg = fs.readFileSync(card)
  let i = 2, w = 0, h = 0
  while (i + 9 < jpg.length) { if (jpg[i] !== 0xff) break; const m = jpg[i + 1]; if (m >= 0xc0 && m <= 0xc3) { h = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); break } i += 2 + jpg.readUInt16BE(i + 2) }
  if (w !== OG_IMAGE.width || h !== OG_IMAGE.height) fail(`${OG_IMAGE.path} is ${w}×${h}, the tags say ${OG_IMAGE.width}×${OG_IMAGE.height}`)
  if (jpg.length > 300 * 1024) fail(`${OG_IMAGE.path} is ${Math.round(jpg.length / 1024)} KB (limit 300)`)
}
// the résumé: one fixed address, a real PDF, linked from the plain-text home page
const resume = path.join(dist, 'Yaoting-Wang-Resume.pdf')
if (!fs.existsSync(resume)) fail('missing Yaoting-Wang-Resume.pdf')
else if (fs.statSync(resume).size < 50 * 1024 || fs.readFileSync(resume).subarray(0, 5).toString() !== '%PDF-') fail('Yaoting-Wang-Resume.pdf is not a real résumé PDF')
if (!fs.readFileSync(path.join(dist, 'index.html'), 'utf8').includes('href="/Yaoting-Wang-Resume.pdf"')) fail('the home page does not link the résumé')
if (!assets.size) fail('no /assets/ references found in built HTML')
for (const a of assets) if (!fs.existsSync(path.join(dist, a))) fail(`missing asset ${a}`)

const server = await preview({ preview: { port: 4179, strictPort: true, open: false }, logLevel: 'silent' })
try {
  for (const url of [...routes, ...assets]) {
    const res = await fetch(`http://localhost:4179${url}`)
    if (res.status !== 200) { fail(`GET ${url} -> ${res.status}`); continue }
    // a route must be served its own page (crawlers and link previews read it), not the app shell
    if (routes.includes(url)) {
      const served = ((await res.text()).match(/<title>([^<]*)<\/title>/) || [])[1]
      const own = [...titles].find(([, r]) => r === url)?.[0]
      if (served !== own) fail(`GET ${url} served "${served}", expected its own page "${own}"`)
    }
  }
} finally {
  await server.close()
}

if (!process.exitCode) console.log(`smoke: ok — ${routes.length} routes, ${assets.size} assets served`)
