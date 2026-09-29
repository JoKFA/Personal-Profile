import fs from 'node:fs'
import path from 'node:path'
import { routes as pages, SITE_URL } from './site-routes.mjs'

const publicDir = path.resolve(process.cwd(), 'public')
const siteUrl = SITE_URL

const routes = pages.map((p) => p.route)

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}${route}</loc>
  </url>`,
  )
  .join('\n')}
</urlset>
`

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`

fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8')
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf8')
