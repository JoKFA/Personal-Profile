import fs from 'node:fs'
import path from 'node:path'

const publicDir = path.resolve(process.cwd(), 'public')
const siteUrl = (
  process.env.VITE_SITE_URL ||
  process.env.SITE_URL ||
  'https://personal-profile-alpha-cyan.vercel.app'
).replace(/\/$/, '')

const projectSlugs = [
  'mcp-security-framework',
  'ai-enhanced-edr-triage',
  'internal-pentest',
  'telus-ai-hackathon',
  'threat-modelling-viva',
]

const routes = ['/', '/portfolio', ...projectSlugs.map((slug) => `/projects/${slug}`)]

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
