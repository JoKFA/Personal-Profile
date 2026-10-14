// every entry from a cold /projects/:slug (a shared link, a refresh in the file): stop picture -> open clip -> file; then close back to where it belongs. node p3b-cold.mjs <out> [base]
import fs from 'node:fs'
import { launch, until } from './lib.mjs'
const [OUT, BASE = 'http://127.0.0.1:5194'] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const { b, p, errs } = await launch(390, 664)
const idsSlugs = await (async () => { await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); return p.evaluate(async () => { const m = window.__phone.manifest; const r = await import('/src/casefile/data/entries.ts'); return Object.keys(m.open).map((id) => [id, r.entryById.get(id).slug]) }) })()
const rows = []
for (const [id, slug] of idsSlugs) {
  const e0 = errs.length
  await p.goto(`${BASE}/projects/${slug}?phone-app&phone-expose`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.phase === 'file', null, 40000).catch(() => {})
  await p.waitForTimeout(900)
  const open = await p.evaluate(() => ({ phase: window.__phone.phase, openId: window.__phone.openId, at: window.__phone.at, url: location.pathname, demo: !!document.querySelector('.ph-file.on .ph-fdemo .dm'), bodySections: document.querySelectorAll('.ph-file.on .file-tab--stacked').length, focus: document.activeElement?.className ?? '', y: Math.round(scrollY) }))
  if (id === 'X-001') await p.screenshot({ path: `${OUT}/cold-X-001.png` })
  if (id === 'SR-03') await p.screenshot({ path: `${OUT}/cold-SR-03-notreel.png` })
  await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy, null, 30000).catch(() => {}); await p.waitForTimeout(500)
  const closed = await p.evaluate(() => ({ phase: window.__phone.phase, at: window.__phone.at, url: location.pathname, y: Math.round(scrollY), stage: window.__phone.stage.current, focus: document.activeElement?.className ?? '' }))
  rows.push({ id, slug, ok: open.phase === 'file' && open.openId === id && closed.phase === 'settled' && closed.url === '/', open, closed, errs: errs.slice(e0) })
  console.log(JSON.stringify(rows.at(-1)))
}
fs.writeFileSync(`${OUT}/cold.json`, JSON.stringify(rows, null, 1))
console.log('ok', rows.filter((r) => r.ok).length, 'of', rows.length)
await b.close()
