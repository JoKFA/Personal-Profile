// every entry: open -> window screenshot -> scroll to end -> screenshot -> close. node p3b-all.mjs <out> [WxH] [base] [ids,comma]
import fs from 'node:fs'
import { launch, until } from './lib.mjs'
const [OUT, SIZE = '390x664', BASE = 'http://127.0.0.1:5194', ONLY] = process.argv.slice(2)
const [W, H] = SIZE.split('x').map(Number)
fs.mkdirSync(OUT, { recursive: true })
const { b, p, errs } = await launch(W, H)
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready)
await p.waitForTimeout(1200)
await p.touchscreen.tap(W / 2, H * 0.4)
const ids = ONLY ? ONLY.split(',') : await p.evaluate(() => Object.keys(window.__phone.manifest.open))
const rows = []
for (const id of ids) {
  const e0 = errs.length
  await p.evaluate((id) => window.__phone.openEntry(id), id)
  await until(p, () => window.__phone.phase === 'file' && window.__phone.openId, null, 30000).catch(() => {})
  await p.waitForTimeout(1200)
  await p.screenshot({ path: `${OUT}/${id}-a.png` })
  const m = await p.evaluate(() => {
    const f = document.querySelector('.ph-file'), W = innerWidth
    const out = { sh: f.scrollHeight, ch: f.clientHeight, issues: [], small: [] }
    const dm = f.querySelector('.ph-fdemo'); const dr = dm.getBoundingClientRect()
    const demo = dm.querySelector('.dm-panel')
    if (demo) { out.demo = { w: Math.round(dr.width), h: Math.round(dr.height), sh: demo.scrollHeight, ch: demo.clientHeight } }
    for (const e of f.querySelectorAll('*')) {
      const r = e.getBoundingClientRect(); if (!r.width) continue
      if (r.right > W + 1 || r.left < -1) { if (!e.closest('svg') || e.tagName === 'svg') out.issues.push(`${e.tagName}.${(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || ''} x ${Math.round(r.left)}..${Math.round(r.right)}`) }
      if (e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
        const fs_ = parseFloat(getComputedStyle(e).fontSize) * (e.closest('svg') && e.tagName !== 'svg' ? (e.getBoundingClientRect().height / (e.getBBox ? e.getBBox().height || 1 : 1)) : 1)
        if (fs_ < 10.9 && getComputedStyle(e).visibility !== 'hidden') out.small.push(`${e.tagName}:${(e.textContent || '').trim().slice(0, 18)}:${fs_.toFixed(1)}`)
      }
    }
    out.issues = out.issues.slice(0, 6); out.small = [...new Set(out.small)].slice(0, 12)
    out.overflowX = document.querySelector('.ph-file').scrollWidth - W
    return out
  })
  await p.evaluate(() => { const f = document.querySelector('.ph-file'); f.scrollTo({ top: f.scrollHeight }) })
  await p.waitForTimeout(1400)
  await p.screenshot({ path: `${OUT}/${id}-b.png` })
  await p.evaluate(() => window.__phone.closeFile(true))
  await until(p, () => window.__phone.phase === 'settled', null, 30000).catch(() => {})
  await p.waitForTimeout(500)
  rows.push({ id, ...m, errs: errs.slice(e0) })
  console.log(JSON.stringify(rows.at(-1)))
}
fs.writeFileSync(`${OUT}/report-${SIZE}.json`, JSON.stringify(rows, null, 1))
await b.close()
