import fs from 'node:fs'
import path from 'node:path'
import { OG_IMAGE, routes as routeMeta, SITE_URL } from './site-routes.mjs'

const distDir = path.resolve(process.cwd(), 'dist')
const indexPath = path.join(distDir, 'index.html')

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Plain-text version of each file inside #root: readable by crawlers and without JavaScript.
// React replaces it on load.
function staticBody(e) {
  const head = e.kind === 'service' ? `${e.title} · ${e.org} · ${e.dates}` : e.kicker
  const facts = e.facts.map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join('')
  const sections = (e.sections || []).map((s) => `<h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>${(s.points || []).map((p) => `<p>${esc(p)}</p>`).join('')}`).join('')
  const nav = routeMeta.filter((r) => r.entry !== e).map((r) => `<a href="${r.route}">${esc(r.entry.kind === 'service' ? r.entry.org : r.entry.title)}</a>`).join(' · ')
  return `<main class="prerender"><h1>${esc(e.kind === 'service' ? e.org : e.title)}</h1><p>${esc(head)}</p><p>${esc(e.summary)}</p><ul>${facts}</ul>${sections}<nav>${nav}</nav></main>`
}

function upsertTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`)
}

function withMeta(html, meta) {
  const title = esc(meta.title), description = esc(meta.description)
  let nextHtml = upsertTag(html, /<title>.*<\/title>/, `<title>${title}</title>`)
  nextHtml = upsertTag(
    nextHtml,
    /<meta name="description" content=".*?">/,
    `<meta name="description" content="${description}">`,
  )
  nextHtml = upsertTag(
    nextHtml,
    /<meta property="og:title" content=".*?">/,
    `<meta property="og:title" content="${title}">`,
  )
  nextHtml = upsertTag(
    nextHtml,
    /<meta property="og:description" content=".*?">/,
    `<meta property="og:description" content="${description}">`,
  )
  nextHtml = upsertTag(
    nextHtml,
    /<meta property="og:image" content=".*?">/,
    `<meta property="og:image" content="${SITE_URL}${OG_IMAGE.path}">`,
  )
  nextHtml = upsertTag(nextHtml, /<meta property="og:image:width" content=".*?">/, `<meta property="og:image:width" content="${OG_IMAGE.width}">`)
  nextHtml = upsertTag(nextHtml, /<meta property="og:image:height" content=".*?">/, `<meta property="og:image:height" content="${OG_IMAGE.height}">`)
  nextHtml = upsertTag(nextHtml, /<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${SITE_URL}${meta.route === '/' ? '/' : meta.route}">`)
  nextHtml = upsertTag(nextHtml, /<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${SITE_URL}${OG_IMAGE.path}">`)
  nextHtml = upsertTag(
    nextHtml,
    /<meta name="twitter:card" content=".*?">/,
    '<meta name="twitter:card" content="summary_large_image">',
  )
  return nextHtml
}

const sourceHtml = fs.readFileSync(indexPath, 'utf8')

for (const entry of routeMeta) {
  const routeHtml = withMeta(sourceHtml, entry).replace('<div id="root"></div>', `<div id="root">${staticBody(entry.entry)}</div>`)
  // /projects/<slug>.html: served at /projects/<slug> (no trailing slash) by Vercel's cleanUrls and by
  // vite preview, so every route gets its own prerendered page rather than the app shell
  const outputPath =
    entry.route === '/' ? indexPath : path.join(distDir, `${entry.route.replace(/^\//, '')}.html`)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, routeHtml, 'utf8')
}
