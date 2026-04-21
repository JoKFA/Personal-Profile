import fs from 'node:fs'
import path from 'node:path'

const distDir = path.resolve(process.cwd(), 'dist')
const indexPath = path.join(distDir, 'index.html')

const routeMeta = [
  {
    route: '/',
    title: 'Yaoting Wang | Security Builder',
    description:
      'MASc Cybersecurity student at SFU. Building security systems, validating real attack paths, and working at the intersection of AI and security.',
  },
  {
    route: '/projects/mcp-security-framework',
    title: 'Yaoting Wang | MCP Security Framework',
    description:
      'A TypeScript framework that scans MCP servers for security vulnerabilities using 14 detectors. Structured SARIF output for CI/CD.',
  },
  {
    route: '/projects/ai-enhanced-edr-triage',
    title: 'Yaoting Wang | AI-Enhanced EDR Triage',
    description:
      'LLM-assisted triage pipeline on Wazuh EDR telemetry. Classifies alerts and surfaces analyst-readable context with severity scoring.',
  },
  {
    route: '/projects/internal-pentest',
    title: 'Yaoting Wang | Internal Pentest',
    description:
      'Grey-box assessment across authentication, session handling, and authorization boundaries. 14 validated findings with remediation guidance.',
  },
  {
    route: '/projects/telus-ai-hackathon',
    title: 'Yaoting Wang | TELUS AI Hackathon',
    description:
      'AI-assisted AppSec MVP using Semgrep output and LLM triage to make SAST findings more actionable for developers.',
  },
  {
    route: '/projects/threat-modelling-viva',
    title: 'Yaoting Wang | Threat Modelling (VIVA)',
    description:
      'STRIDE-based threat-modeling exercise mapping trust boundaries, prioritizing controls, and closing 12 identified threats.',
  },
]

function upsertTag(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `  ${tag}\n</head>`)
}

function withMeta(html, { title, description }) {
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
    '<meta property="og:image" content="/og-card.svg">',
  )
  nextHtml = upsertTag(
    nextHtml,
    /<meta name="twitter:card" content=".*?">/,
    '<meta name="twitter:card" content="summary_large_image">',
  )
  return nextHtml
}

const sourceHtml = fs.readFileSync(indexPath, 'utf8')

for (const entry of routeMeta) {
  const routeHtml = withMeta(sourceHtml, entry)
  const outputPath =
    entry.route === '/' ? indexPath : path.join(distDir, entry.route.replace(/^\//, ''), 'index.html')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, routeHtml, 'utf8')
}
