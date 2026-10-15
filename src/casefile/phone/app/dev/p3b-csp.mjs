// P3b CSP run (from P2's csp.mjs, plus every file page, a cold non-reel link and a related jump): the production build under `vite preview` (which serves vercel.json's CSP: style-src 'self', no inline styles, no blob/data media).
//   npm run build; npx vite preview --port 4197;  node src/casefile/phone/app/dev/csp.mjs <outDir> [--base=http://127.0.0.1:4197]
// The phone shell is entered the real way (no ?phone-app): a mobile context (touch, 390x664, screen 390x664) takes the phone path by itself.
// Every securitypolicyviolation (collected from the first script on), every console error/warning and every failed request is reported.
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4197'), QUERY = flag('query', '')
const W = 390, H = 664
const PHQ = (process.env.PHQ ?? '&phone-expose').slice(1)   // the test hooks the build exposes (a build made with VITE_HOOKS=1: see lib.mjs)
fs.mkdirSync(OUT, { recursive: true })
const { b, ctx, p, cdp, errs } = await launch(W, H)
await ctx.addInitScript(() => {
  window.__csp = []
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} | ${e.blockedURI} | ${e.sourceFile}:${e.lineNumber} | ${e.originalPolicy.slice(0, 60)}`))
})
const warn = []; p.on('console', (m) => { if (m.type() === 'warning') warn.push(m.text()) })
const failed = []; p.on('requestfailed', (r) => failed.push(r.url() + ' ' + (r.failure()?.errorText ?? ''))); p.on('response', (r) => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()) })
const reqs = []; p.on('request', (r) => reqs.push(new URL(r.url()).pathname))
const headers = {}
p.on('response', (r) => { if (r.url() === `${BASE}/` || r.url().startsWith(`${BASE}/?`)) Object.assign(headers, r.headers()) })
await p.goto(`${BASE}/?${PHQ}${QUERY}`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.ready)
await p.waitForTimeout(1500)
const entered = await p.evaluate(() => ({ phoneShell: !!document.querySelector('.ph-root'), cf: !!document.querySelector('.cf'), pointerCoarse: matchMedia('(pointer: coarse)').matches, screen: [screen.width, screen.height] }))
await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(900)
const bb = await p.locator('.ph-go[data-id="X-001"]').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(600)
await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && window.__phone.at === 1); await p.waitForTimeout(600)
await swipe(cdp, W, H, 'up'); await until(p, () => window.__phone.at === 0 && window.__phone.phase === 'settled'); await p.waitForTimeout(500)
// every file page of the 19: open (the real path: stop picture, open clip, window, demo, body), scroll to the end, close
const opened = []
for (const id of await p.evaluate(() => Object.keys(window.__phone.manifest.open))) {
  await p.evaluate((id) => window.__phone.openEntry(id), id)
  await until(p, (id) => window.__phone.phase === 'file' && window.__phone.openId === id, id, 30000); await p.waitForTimeout(700)
  const info = await p.evaluate(() => { const f = document.querySelector('.ph-file.on'); scrollTo(0, document.documentElement.scrollHeight); return { demo: !!f.querySelector('.ph-fdemo .dm'), core: !!f.querySelector('.ph-fdemo [data-core]'), body: f.querySelectorAll('.file-tab--stacked').length } })
  await p.waitForTimeout(500)
  opened.push({ id, ...info })
  await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy, null, 30000); await p.waitForTimeout(300)
}
// the restricted file's game: one message through the preview's /api proxy
await p.evaluate(() => window.__phone.openEntry('X-000')); await until(p, () => window.__phone.phase === 'file' && window.__phone.openId === 'X-000', null, 30000); await p.waitForTimeout(600)
await p.evaluate(() => document.querySelector('.ph-fgame').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500)
await p.locator('#snIn').tap(); await p.keyboard.type('what is in this file?'); await p.locator('.sn-form button[type=submit]').tap()
await p.waitForFunction(() => document.querySelectorAll('.sn-m.bot').length >= 2 && !document.querySelector('.sn-m .thinking'), null, { timeout: 60000 }).catch(() => {})
const game = await p.evaluate(() => ({ bot: [...document.querySelectorAll('.sn-m.bot')].map((e) => e.textContent.slice(0, 140)), cap: document.querySelector('.ph-fgame .dm-cap')?.textContent }))
await p.screenshot({ path: path.join(OUT, 'X-000-game-preview.png') })
await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy, null, 30000); await p.waitForTimeout(300)
// a related-file jump
await p.evaluate(() => window.__phone.openEntry('X-001')); await until(p, () => window.__phone.phase === 'file', null, 30000); await p.waitForTimeout(500)
await p.evaluate(() => window.__phone.jumpTo('X-004')); await until(p, () => window.__phone.phase === 'file' && window.__phone.openId === 'X-004', null, 30000); await p.waitForTimeout(500)
const jumped = await p.evaluate(() => ({ openId: window.__phone.openId, url: location.pathname }))
await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy, null, 30000); await p.waitForTimeout(300)
// a cold link to a file that is not on the reel (it belongs to the Index)
await p.goto(`${BASE}/projects/bcit-cyber-security-office?${PHQ}${QUERY}`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.phase === 'file', null, 30000); await p.waitForTimeout(500)
const coldIndex = await p.evaluate(() => ({ phase: window.__phone.phase, openId: window.__phone.openId, url: location.pathname }))
await p.goBack().catch(() => {}); await p.waitForTimeout(800)
// cold link to a file, and a reload on it
await p.goto(`${BASE}/projects/mcp-security-framework?${PHQ}${QUERY}`, { waitUntil: 'load' })
await until(p, () => window.__phone && window.__phone.phase === 'file', null, 30000); await p.waitForTimeout(500)
const cold = await p.evaluate(() => ({ phase: window.__phone.phase, at: window.__phone.at, url: location.pathname }))
const csp = await p.evaluate(() => window.__csp)
const errsBefore = [...errs], warnBefore = [...warn]   // the control below raises errors of its own: those are not the page's
// negative control: the same check must FAIL on an inline style attribute and an injected <style> (so "0 violations" means something)
const control = await p.evaluate(async () => { const before = window.__csp.length; const el = document.createElement('div'); el.setAttribute('style', 'color:red'); document.body.appendChild(el); const st = document.createElement('style'); st.textContent = 'b{}'; document.head.appendChild(st); el.style.color = 'blue'; await new Promise((r) => setTimeout(r, 300)); const got = window.__csp.slice(before); el.remove(); st.remove(); return got.map((x) => x.split(' | ')[0]) })
const res = { base: BASE, entered, opened, game, jumped, coldIndex, cold, cspViolations: csp, negativeControlRaised: control, consoleErrors: errsBefore, consoleWarnings: warnBefore, consoleErrorsFromTheControl: errs.length - errsBefore.length, failedRequests: failed, csp: headers['content-security-policy'], requests: [...new Set(reqs)].filter((r) => !r.includes('/@') && !r.includes('node_modules')) }
fs.writeFileSync(path.join(OUT, 'csp-p3b.json'), JSON.stringify(res, null, 1))
console.log(JSON.stringify(res, null, 1))
await b.close()
