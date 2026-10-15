// P6a: browser details on the production build (vite preview): tap highlight, pressed and focus marks, safe areas (47 / 34 px insets), the small viewport (nothing is laid out again when the toolbar slides),
// the pooled videos' attributes, overscroll, text-size-adjust, text fields.
//   node p6-browser.mjs <outDir> [--size=390x844] [--base=http://127.0.0.1:4196] [--top=47] [--bottom=34]
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), [W, H] = flag('size', '390x844').split('x').map(Number), TAG = `${W}x${H}`
const TOP = Number(flag('top', 47)), BOT = Number(flag('bottom', 34))
fs.mkdirSync(OUT, { recursive: true })
const rep = { size: TAG, insets: { top: TOP, bottom: BOT } }
const { b, p, cdp, errs } = await launch(W, H, { gate: true })
let insetsOk = true
try { await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: TOP, bottom: BOT, left: 0, right: 0 } }) } catch (e) { insetsOk = false; rep.insetsError = String(e).slice(0, 120) }
rep.insetsEmulated = insetsOk
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1500)
rep.envSeen = await p.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'; document.body.appendChild(d); const cs = getComputedStyle(d); const r = [cs.paddingTop, cs.paddingBottom]; d.remove(); return r })

/** every visible text-bearing element and every control: is any of it inside the top or bottom inset? */
const insetScan = async (name, bottom = true) => {
  await p.evaluate(() => { const sh = new CSSStyleSheet(); sh.replaceSync('.ph-root *, .ph-gate * { pointer-events: auto !important }'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh]; window.__scanSheet = sh })   // (elementsFromPoint skips pointer-events:none: the gate's lines are)
  const r = await insetScan0(name, bottom)
  await p.evaluate(() => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== window.__scanSheet) })
  return r
}
const insetScan0 = (name, bottom = true) => p.evaluate(([name, TOP, BOT, bottom]) => {   // (a file page scrolls: what crosses the bottom edge continues; only resting UI is held to the bottom inset)
  const bad = []; const H = innerHeight; let checked = 0
  for (const e of document.querySelectorAll('.ph-root *, .ph-gate *')) {
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.3 || e.closest('[aria-hidden="true"]')) continue
    const own = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()), ctl = e.matches('button, a, input, select, textarea')
    if (!own && !ctl) continue
    let op = 1; for (let a = e; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity); if (op < 0.3) continue
    if (e.classList.contains('ph-door')) continue   // (the cover panel's invisible whole-panel button)
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > H) continue
    // what is covered by something else (a row scrolled under the bar) is not seen
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c.includes('color(') ? 1 : 0; const a = m[1].split(/[,/]\s*|\s+/); return a.length > 3 ? parseFloat(a[3]) : 1 }
    const paints = (x) => x.matches('img, canvas, video') || alpha(getComputedStyle(x).backgroundColor) >= 0.5 || ([...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && alpha(getComputedStyle(x).color) > 0)
    let vis = false
    for (const x of document.elementsFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(H - 1, Math.max(0, r.top + r.height / 2)))) { if (x === e || e.contains(x) || x.contains(e)) { vis = true; break } if (x.closest('.ph-root, .ph-gate') && paints(x)) break }
    if (!vis) continue
    checked++
    if (r.top < TOP - 0.5 && r.bottom > 0) bad.push(`under the notch: ${e.className || e.tagName} "${(e.textContent || '').trim().slice(0, 20)}" top ${Math.round(r.top)}`)
    if (bottom && r.bottom > H - BOT + 0.5 && r.top < H) bad.push(`under the home indicator: ${e.className || e.tagName} "${(e.textContent || '').trim().slice(0, 20)}" bottom ${Math.round(r.bottom)}`)
  }
  return { name, violations: [...new Set(bad)].slice(0, 12), count: bad.length, checked }
}, [name, TOP, BOT, bottom])
rep.insetScans = []
rep.insetScans.push(await insetScan('gate idle'))
await p.screenshot({ path: path.join(OUT, `safe-${TAG}-1-gate.png`) })
const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
rep.gateLayout = await p.evaluate(() => { const g = document.querySelector('.ph-gate'); const r = document.querySelector('.ph-gate .gate-skip').getBoundingClientRect(); return { print: g.dataset.print, paddingTop: getComputedStyle(g).paddingTop, paddingBottom: getComputedStyle(g).paddingBottom, skip: [Math.round(r.top), Math.round(r.bottom)] } })
await touch('touchStart', px + pw / 2, py + ph / 2)
await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-cap2'); const a = document.querySelectorAll('.ph-gate .fp-mi .a')[3]; return e && getComputedStyle(e).opacity === '1' && a && getComputedStyle(a).opacity === '1' }, undefined, { polling: 16, timeout: 20000 })
await touch('touchEnd'); await p.waitForTimeout(150)
rep.insetScans.push(await insetScan('gate profile')); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-2-gate-profile.png`) })
await touch('touchStart', px + pw / 2, py + ph / 2)
await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0); await touch('touchEnd')
await until(p, () => window.__phone.entry.coverAt > 0); await p.waitForTimeout(1500)
rep.insetScans.push(await insetScan('cover')); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-3-cover.png`) })
await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(1100)
rep.insetScans.push(await insetScan('stop 01')); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-4-stop01.png`) })

// ── the small viewport: scroll the reel, the Index and a file; the layout must not be laid out again when the toolbar slides ──
await p.evaluate(() => {
  window.__lay = { h: new Set(), ph: new Set(), changes: 0, vh: new Set() }
  const root = document.querySelector('.ph-root')
  new MutationObserver(() => { window.__lay.changes++; window.__lay.ph.add(root.style.getPropertyValue('--ph-h')) }).observe(root, { attributes: true, attributeFilter: ['style'] })
  const f = () => { window.__lay.h.add(innerHeight); window.__lay.vh.add(Math.round(visualViewport.height)); window.__lay.raf = requestAnimationFrame(f) }
  requestAnimationFrame(f)
})
await swipe(cdp, W, H); await until(p, () => window.__phone.at === 2 && window.__phone.phase === 'settled'); await p.waitForTimeout(900)
await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => scrollY > 4 * h, H); await p.waitForTimeout(900)
for (let i = 0; i < 5; i++) { await swipe(cdp, W, H, 'down', 0.55); await p.waitForTimeout(500) }
rep.insetScans.push(await insetScan('index (scrolled)')); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-5-index.png`) })
await p.locator('.ph-navb[data-go="contact"]').tap(); await p.waitForTimeout(1800)
rep.insetScans.push(await insetScan('contact')); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-6-contact.png`) })
await p.evaluate(() => { const r = document.querySelector('.ph-ix[data-id="X-004"]').getBoundingClientRect(); scrollBy(0, r.top - innerHeight / 2) }); await p.waitForTimeout(700)
const bb = await p.locator('.ph-ix[data-id="X-004"]').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
await until(p, () => window.__phone.phase === 'file', undefined, 30000); await p.waitForTimeout(1200)
rep.insetScans.push(await insetScan('file window', false)); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-7-file.png`) })
for (let i = 0; i < 9; i++) { await swipe(cdp, W, H, 'down', 0.6); await p.waitForTimeout(450) }
rep.insetScans.push(await insetScan('file body (end)', false)); await p.screenshot({ path: path.join(OUT, `safe-${TAG}-8-file-end.png`) })
// the toolbar slides (Safari's innerHeight grows while the small viewport stays): innerHeight is faked, a resize event sent; a real change of the small viewport follows for contrast
await p.evaluate(() => { window.__lay.changes0 = window.__lay.changes; window.__ihd = Object.getOwnPropertyDescriptor(window, 'innerHeight'); Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => 720 }); dispatchEvent(new Event('resize')) }); await p.waitForTimeout(400)
rep.toolbarSlide = await p.evaluate(() => ({ writesCausedByTheSlide: window.__lay.changes - window.__lay.changes0, layoutHeight: document.querySelector('.ph-root').style.getPropertyValue('--ph-h'), viewH: window.__phone.view.h }))
await p.evaluate(() => { Object.defineProperty(window, 'innerHeight', window.__ihd) })
rep.viewport = await p.evaluate(() => { cancelAnimationFrame(window.__lay.raf); return { innerHeightsSeen: [...window.__lay.h], visualViewportHeightsSeen: [...window.__lay.vh], layoutHeightsSet: [...window.__lay.ph], styleWritesOnRoot: window.__lay.changes, svhProbe: document.querySelector('.ph-svh').offsetHeight, viewH: window.__phone.view.h } })
await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 30000); await p.waitForTimeout(800)

// ── the rest of the list ──
rep.videos = await p.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ playsinline: v.hasAttribute('playsinline') && v.playsInline, webkitPlaysinline: v.hasAttribute('webkit-playsinline'), muted: v.muted && v.hasAttribute('muted'), defaultMuted: v.defaultMuted, controls: v.controls, hasControlsAttr: v.hasAttribute('controls'), disablePiP: v.disablePictureInPicture, disableRemote: v.disableRemotePlayback, controlslist: v.getAttribute('controlslist'), airplay: v.getAttribute('x-webkit-airplay'), autoplay: v.autoplay, pointerEvents: getComputedStyle(v).pointerEvents, ariaHidden: v.getAttribute('aria-hidden'), preload: v.preload })))
rep.page = await p.evaluate(() => { const h = getComputedStyle(document.documentElement), bd = getComputedStyle(document.body); const m = document.querySelector('meta[name=viewport]').content; return { viewportMeta: m, fitCover: /viewport-fit=cover/.test(m), overscrollHtml: h.overscrollBehaviorY, overscrollBody: bd.overscrollBehaviorY, textSizeAdjust: h.webkitTextSizeAdjust || h.textSizeAdjust } })
rep.tapHighlight = await p.evaluate(() => { const bad = [], all = [...document.querySelectorAll('.ph-root *, .ph-gate *, html, body')]; for (const e of all) { const c = getComputedStyle(e).webkitTapHighlightColor; if (c !== 'rgba(0, 0, 0, 0)') bad.push(`${e.className || e.tagName}: ${c}`) } return { checked: all.length, notTransparent: [...new Set(bad)].slice(0, 10), count: bad.length } })
rep.errs = errs; rep.csp = await p.evaluate(() => window.__phone.csp)
fs.writeFileSync(path.join(OUT, `browser-${TAG}.json`), JSON.stringify(rep, null, 1))
console.log(JSON.stringify(rep, null, 1))
await b.close()
