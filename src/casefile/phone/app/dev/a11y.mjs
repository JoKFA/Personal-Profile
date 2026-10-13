// Chrome accessibility tree of the reel (headings and buttons in order), plus a keyboard pass and the text-size/contrast numbers.
//   node src/casefile/phone/app/dev/a11y.mjs <outDir> [--base=http://127.0.0.1:5194]
import fs from 'node:fs'
import path from 'node:path'
import { launch, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const PHQ = (process.env.PHQ ?? '&phone-expose').slice(1)   // the bake's manifest by default; PHQ='&phone-dev' selects the temporary P0 one
const BASE = flag('base', 'http://127.0.0.1:5194')
fs.mkdirSync(OUT, { recursive: true })
const { b, p, cdp, errs } = await launch(390, 664)
await p.goto(`${BASE}/?phone-app&${PHQ}`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready)
await p.waitForTimeout(1500)

const aria = await p.locator('body').ariaSnapshot()
fs.writeFileSync(path.join(OUT, 'aria-snapshot.yml'), aria)
// Chrome's own tree: every node that is not ignored, in order, reduced to role / name / level
await cdp.send('Accessibility.enable')
const { nodes } = await cdp.send('Accessibility.getFullAXTree')
const byId = new Map(nodes.map((n) => [n.nodeId, n]))
const rows = []
const walk = (id, depth) => {
  const n = byId.get(id); if (!n) return
  const role = n.role?.value, name = n.name?.value
  if (!n.ignored && ['heading', 'button', 'navigation', 'banner', 'main', 'region', 'status', 'link'].includes(role)) {
    const level = n.properties?.find((x) => x.name === 'level')?.value.value
    rows.push(`${'  '.repeat(depth)}${role}${level ? ' h' + level : ''}: ${JSON.stringify(name)}`)
  }
  for (const c of n.childIds ?? []) walk(c, n.ignored || !['generic', 'none', 'RootWebArea', 'Section', 'section'].includes(role) ? depth + 1 : depth)
}
walk(nodes[0].nodeId, 0)
fs.writeFileSync(path.join(OUT, 'ax-tree.txt'), rows.join('\n'))

// keyboard: Tab order through the page, and focus after open / close
const tabs = []
for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => { const e = document.activeElement; return (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40) })) }
// the stage is hidden from assistive tech, and the sealed text is still real text
const facts = await p.evaluate(() => ({
  stageHidden: document.querySelector('.ph-stagebox').getAttribute('aria-hidden'),
  reticleHidden: document.querySelector('.ph-reticle').getAttribute('aria-hidden'),
  videosHidden: [...document.querySelectorAll('video')].every((v) => v.getAttribute('aria-hidden') === 'true'),
  imgsAlt: [...document.querySelectorAll('.ph-img')].every((i) => i.getAttribute('alt') === ''),
  h1: [...document.querySelectorAll('h1')].map((e) => e.textContent), h2: [...document.querySelectorAll('h2')].map((e) => e.textContent),
  sealedTextReal: document.querySelector('#ph-s1 .ph-sum').textContent,
  viewportMeta: document.querySelector('meta[name=viewport]').content,
  tapHighlight: getComputedStyle(document.querySelector('.ph-go')).webkitTapHighlightColor,
  buttonSizes: [...document.querySelectorAll('.ph-root button')].map((e) => { const r = e.getBoundingClientRect(); return `${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 18)}:${Math.round(r.width)}x${Math.round(r.height)}` }),
}))
await p.locator('.ph-go[data-id="X-001"]').scrollIntoViewIfNeeded().catch(() => {})
fs.writeFileSync(path.join(OUT, 'a11y.json'), JSON.stringify({ tabOrder: tabs, ...facts, errs }, null, 1))
console.log(rows.join('\n')); console.log(JSON.stringify({ tabOrder: tabs, ...facts, errs }, null, 1))
await b.close()
