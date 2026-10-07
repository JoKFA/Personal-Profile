import fs from 'node:fs'
import path from 'node:path'
import { CERTIFICATIONS, CONTACT, entries, OG_IMAGE, routes as routeMeta, SELECTED, SITE_URL, THESIS } from './site-routes.mjs'

const distDir = path.resolve(process.cwd(), 'dist')
const indexPath = path.join(distDir, 'index.html')

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Plain-text version of each page inside #root: what crawlers, link previews, AI summaries and
// readers without JavaScript get. React replaces it on load. The home page is a short CV in
// reading order (thesis, the files to read first, then the record); a file ends with the next one.
const byId = new Map(entries.map((e) => [e.id, e]))
const routeOf = (e) => routeMeta.find((r) => r.entry === e)?.route
const nameOf = (e) => (e.kind === 'service' ? e.org : e.title)
const link = (e) => { const r = routeOf(e); return r ? `<a href="${r}">${esc(nameOf(e))}</a>` : esc(nameOf(e)) }

function homeBody(e) {
  const facts = e.facts.map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join('')
  const start = SELECTED.map((s) => { const x = byId.get(s.id); return `<li>${link(x)} · ${esc(s.tag)} · ${esc(s.line)}</li>` }).join('')
  const of = (kind) => entries.filter((x) => x.kind === kind)
  const work = of('service').map((x) => `<li>${link(x)} · ${esc(x.title)} · ${esc(x.dates)}</li>`).join('')
  const projects = of('case').filter((x) => !SELECTED.some((s) => s.id === x.id)).map((x) => `<li>${link(x)} · ${esc(x.summary)}</li>`).join('')
  const school = of('education').map((x) => `<li>${link(x)} · ${esc(x.org)} · ${esc(x.dates)}</li>`).join('')
  const contact = `<a href="mailto:${esc(CONTACT.email)}">${esc(CONTACT.email)}</a> · <a href="${esc(CONTACT.linkedin)}">LinkedIn</a> · <a href="${esc(CONTACT.github)}">GitHub</a>`
  return `<main class="prerender"><h1>${esc(e.title)}</h1><p>${esc(e.kicker)}</p><p>${esc(THESIS.lead)} ${esc(THESIS.rest)}</p><ul>${facts}</ul>`
    + `<h2>Start here</h2><ul>${start}</ul><h2>Experience</h2><ul>${work}</ul><h2>More projects</h2><ul>${projects}</ul>`
    + `<h2>Education</h2><ul>${school}</ul><h2>Certifications</h2><p>${esc(CERTIFICATIONS.join(' · '))}</p><h2>Contact</h2><p>${contact}</p></main>`
}

function staticBody(e) {
  if (e.kind === 'subject') return homeBody(e)
  const head = e.kind === 'service' ? `${e.title} · ${e.org} · ${e.dates}` : e.kicker
  const facts = e.facts.map(([k, v]) => `<li><b>${esc(k)}</b> ${esc(v)}</li>`).join('')
  const numbers = (e.numbers || []).map(([n, l]) => `<li><b>${esc(n)}</b> ${esc(l)}</li>`).join('')
  const sections = (e.sections || []).map((s) => `<h2>${esc(s.title)}</h2><p>${esc(s.body)}</p>${(s.points || []).map((p) => `<p>${esc(p)}</p>`).join('')}`).join('')
  // the next page to read: the next selected file, else the next page in the list; and the way back
  const pages = routeMeta.filter((r) => r.route !== '/').map((r) => r.entry)
  const sel = SELECTED.findIndex((s) => s.id === e.id)
  const next = sel >= 0 ? byId.get(SELECTED[(sel + 1) % SELECTED.length].id) : pages[(pages.indexOf(e) + 1) % pages.length]
  const nav = `Next file: ${link(next)} · <a href="/">All work</a>`
  return `<main class="prerender"><h1>${esc(nameOf(e))}</h1><p>${esc(head)}</p><p>${esc(e.summary)}</p><ul>${numbers}</ul><ul>${facts}</ul>${sections}<nav>${nav}</nav></main>`
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
  nextHtml = upsertTag(nextHtml, /<meta property="og:image:alt" content=".*?">/, `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}">`)
  nextHtml = upsertTag(nextHtml, /<meta name="twitter:image" content=".*?">/, `<meta name="twitter:image" content="${SITE_URL}${OG_IMAGE.path}">`)
  nextHtml = upsertTag(nextHtml, /<meta name="twitter:image:alt" content=".*?">/, `<meta name="twitter:image:alt" content="${esc(OG_IMAGE.alt)}">`)
  nextHtml = upsertTag(nextHtml, /<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${SITE_URL}${meta.route === '/' ? '/' : meta.route}">`)
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
