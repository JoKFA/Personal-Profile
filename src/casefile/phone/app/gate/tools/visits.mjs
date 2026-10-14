// The other ways in (plan 2.6): a return visit has no entry page; a link to a file never shows it; ?intro shows it again; reduced motion cross-fades;
// a refused play() (?phone-reject) falls back to stills and the entrance becomes a cross-fade to the cover. Real time, Chrome, mobile emulation.
//   node visits.mjs <outDir> [--base=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { launch, until } from '../../dev/lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const BASE = (rest.find((x) => x.startsWith('--base=')) ?? '--base=http://127.0.0.1:4196').slice(7)
fs.mkdirSync(OUT, { recursive: true })
const res = []
const touch = (cdp, type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })

async function visit(name, { query = '', gate = false, setEntry = false, reduced = false, hold = false, urlPath = '/' }) {
  const { b, ctx, p, cdp, errs } = await launch(390, 664, { gate })
  if (setEntry) await ctx.addInitScript(() => localStorage.setItem('yw.entry', '1'))
  if (reduced) await p.emulateMedia({ reducedMotion: 'reduce' })
  const t0 = Date.now()
  await p.goto(`${BASE}${urlPath}?phone-app&phone-expose${query}`, { waitUntil: 'load' })
  const r = { name, gateShown: false }
  await p.waitForTimeout(1500)
  r.gateShown = await p.evaluate(() => !!document.querySelector('.ph-gate'))
  if (hold || reduced) {
    if (hold) {
      const [x, y, w, h] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
      await touch(cdp, 'touchStart', x + w / 2, y + h / 2)
      await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0, undefined, 60000); await touch(cdp, 'touchEnd')
    } else {
      // reduced motion: the page opens on the sealed print and waits for Continue
      r.reducedSealedShown = await p.evaluate(() => ({ btn: document.querySelector('.ph-gate .gate-skip .t1')?.textContent, phase: document.querySelector('.ph-gate')?.dataset.phase }))
      await p.screenshot({ path: path.join(OUT, `${name}-0-reduced-page.png`) })
      await p.locator('.ph-gate .gate-skip').tap()
    }
    await until(p, () => window.__phone.entry.coverAt > 0, undefined, 60000)
    r.entry = await p.evaluate(() => ({ ...window.__phone.entry }))
  } else await until(p, () => window.__phone && window.__phone.ready, undefined, 60000)
  await p.waitForTimeout(1200)
  r.after = await p.evaluate(() => ({ gate: !!document.querySelector('.ph-gate'), mode: window.__phone.mode, rejects: window.__phone.stage.rejects, fades: window.__phone.stage.fades, phase: window.__phone.phase, at: window.__phone.at, path: location.pathname, yw: localStorage.getItem('yw.entry'), csp: window.__phone.csp.length, entering: window.__phone.dom.root.hasAttribute('data-entering'), scrollLocked: document.documentElement.classList.contains('ph-entry'), panelOpacity: getComputedStyle(window.__phone.dom.sheet).opacity }))
  await p.screenshot({ path: path.join(OUT, `${name}-1-after.png`) })
  r.errs = errs; r.ms = Date.now() - t0
  res.push(r); await b.close()
}
await visit('return', { setEntry: true })
await visit('deeplink', { gate: true, urlPath: '/projects/mcp-security-framework' })
await visit('intro-forced', { setEntry: true, query: '&intro', hold: true })
await visit('reject', { gate: true, query: '&phone-reject', hold: true })
await visit('reduced', { gate: true, reduced: true })
fs.writeFileSync(path.join(OUT, 'visits.json'), JSON.stringify(res, null, 1))
console.log(JSON.stringify(res, null, 1))
