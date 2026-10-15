// P6a: the typography and contrast sweep over every state of the phone shell, machine-checked on the production build (vite preview):
//   text >= 11 px (DOM text; the canvas's own text is set in the code, see the table's note), meaningful text >= 4.5:1 against the paper under it, and no text over scene pixels without a paper plate.
// States: the entry page (idle, read, profile, seal), the cover, the 5 stops, every file page (the window at its first full frame, then the body to its end), the interior (one station),
// the Index, Contact, the landscape notice. Text fields in the files: their font size.
//   node p6-sweep.mjs <outDir> [--size=390x664] [--base=http://127.0.0.1:4196] [--only=X-001,SR-01]
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), [W, H] = flag('size', '390x664').split('x').map(Number), TAG = `${W}x${H}`, ONLY = flag('only', '')
fs.mkdirSync(OUT, { recursive: true })
const { b, p, cdp, errs } = await launch(W, H, { gate: true })
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const rows = []

/** what is on screen now: every visible text, its size, its contrast, and whether a paper plate is under it */
const scan = async (state) => {
  await p.evaluate(() => { const sh = new CSSStyleSheet(); sh.replaceSync('.ph-root *, .ph-gate *, .ph-land * { pointer-events: auto !important }'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh]; window.__scanSheet = sh })
  const r = await scan0(state)
  await p.evaluate(() => { document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== window.__scanSheet) })
  return r
}
const scan0 = (state) => p.evaluate((state) => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const rgba = (s) => {
    const c = s.match(/color\(srgb ([^)]+)\)/)
    if (c) { const [rgb, al] = c[1].split('/'); const v = rgb.trim().split(/\s+/).map(parseFloat); return [v[0] * 255, v[1] * 255, v[2] * 255, al ? parseFloat(al) : 1] }
    const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]
    const a = m[1].split(/[,/]\s*|\s+/).map((x) => parseFloat(x)); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]
  }
  const paper = [231, 228, 221]
  const mix = (fg, bg) => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1]
  // the paper plate under an element: the nearest ancestor (inside the shell) with a background that is at least 85% opaque; none = the scene shows through
  const plateOf = (e) => { for (let n = e; n && !n.classList?.contains('ph-root') && n !== document.body; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] >= 0.85) return mix(c, paper) } return null }
  const paints = (x) => { if (x.matches('img, canvas, video')) return true; if (rgba(getComputedStyle(x).backgroundColor)[3] >= 0.5) return true; return [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && getComputedStyle(x).color !== 'rgba(0, 0, 0, 0)' }
  const seen = (e, r) => {
    const stack = document.elementsFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)))
    for (const x of stack) { if (x === e || e.contains(x) || x.contains(e)) return true; if (x.closest('.ph-root, .ph-gate, .ph-land') && paints(x)) return false }
    return false
  }
  const small = new Set(), low = new Set(), scene = new Set(), sizes = []; let n = 0, worst = 99, sealed = 0
  const fields = []
  for (const e of document.querySelectorAll('.ph-root *, .ph-gate *, .ph-land *')) {
    if (e.matches('input, textarea, select')) { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); if (r.width > 0) fields.push(`${e.tagName.toLowerCase()} ${cs.fontSize}`) }
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue
    const cs = getComputedStyle(e), r = e.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || e.closest('.sr-only')) continue
    let op = 1; for (let a = e; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity); if (op < 0.6) continue
    // covered by something else (a row under the bar, a hidden view): not seen. (All pointer-events are switched on for the scan, and a layer with no paint of its own does not cover: see below.)
    if (!seen(e, r)) continue
    n++
    const label = `${e.className?.toString().slice(0, 28) || e.tagName} "${e.textContent.trim().slice(0, 22)}"`
    // (text inside an SVG is set in the drawing's units: its size on the screen is the font size times the scale of the drawing)
    const isSvg = e instanceof SVGElement, ctm = isSvg && e.getScreenCTM ? e.getScreenCTM() : null, sc = ctm ? Math.hypot(ctm.a, ctm.b) : 1
    const fs = parseFloat(cs.fontSize) * sc; sizes.push(fs); if (fs < 11) small.add(`${label} ${Math.round(fs * 100) / 100}px`)
    // a block of a line still sealed (the scroll-linked decrypt: transparent letters under the ciphertext bits) is judged by the colour it will resolve to
    let fg = rgba(isSvg ? cs.fill : cs.color); if (isSvg) fg[3] *= Number(cs.fillOpacity); if (fg[3] === 0 && e.classList.contains('ph-cbx')) { fg = rgba(getComputedStyle(e.parentElement).color); sealed++ }
    let plate = plateOf(e), bg = plate ?? paper
    // an SVG text sits on the shape drawn under it (a tape, a node): that shape's paint, over the plate, is its background
    if (isSvg) {
      const c = e.getBoundingClientRect(), st = document.elementsFromPoint(c.left + c.width / 2, c.top + c.height / 2)
      for (const x of st) { if (x === e || !(x instanceof SVGGeometryElement) || x.ownerSVGElement !== e.ownerSVGElement) continue; const xs = getComputedStyle(x); const pf = rgba(xs.fill), ps = rgba(xs.stroke); const pt = pf[3] > 0 && xs.fill !== 'none' ? [pf[0], pf[1], pf[2], pf[3] * Number(xs.fillOpacity)] : (xs.stroke !== 'none' && ps[3] > 0 ? [ps[0], ps[1], ps[2], ps[3] * Number(xs.strokeOpacity)] : null); if (pt) { bg = mix(pt, bg); break } }
    }
    const f2 = fg[3] < 1 ? mix(fg, bg) : fg
    const L1 = lum(f2), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const big = fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 700), need = big ? 3 : 4.5   // (WCAG large text: 3:1)
    if (!big) worst = Math.min(worst, ratio); if (ratio < need) low.add(`${label} ${ratio.toFixed(2)} (needs ${need})`)
    if (!plate && !e.closest('.ph-gate, .ph-land')) scene.add(label)
  }
  return { state, texts: n, minPx: n ? Math.round(Math.min(...sizes) * 100) / 100 : null, worstContrast: Math.round(worst * 100) / 100, under11: [...small].slice(0, 8), lowContrast: [...low].slice(0, 8), overScene: [...scene].slice(0, 8), sealedBlocks: sealed, fields }
}, state)
const add = async (state) => { const r = await scan(state); rows.push(r); return r }

await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1500)
// ── the entry page ──
await add('gate · idle')
const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
await touch('touchStart', px + pw / 2, py + ph / 2)
await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-sub1'); return e && getComputedStyle(e).opacity === '1' }, undefined, { polling: 16, timeout: 20000 }); await add('gate · read')
await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-cap2'); const a = document.querySelectorAll('.ph-gate .fp-mi .a')[3]; return e && getComputedStyle(e).opacity === '1' && a && getComputedStyle(a).opacity === '1' }, undefined, { polling: 16, timeout: 20000 }); await add('gate · profile')
await p.waitForFunction(() => { const e = document.querySelector('.ph-gate .fp-cap3'); return e && getComputedStyle(e).opacity === '1' }, undefined, { polling: 16, timeout: 20000 }); await p.waitForTimeout(150); await add('gate · seal')
await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0); await touch('touchEnd')
await until(p, () => window.__phone.entry.coverAt > 0); await p.waitForTimeout(1500)
// ── the cover and the five stops ──
await add('cover')
for (let i = 1; i <= 4; i++) { await swipe(cdp, W, H); await until(p, (n) => window.__phone.at === n && window.__phone.phase === 'settled', i); await p.waitForTimeout(1100); await add(`stop 0${i}`) }
// ── the Index and Contact ──
await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H); await p.waitForTimeout(900); await add('index (top)')
for (let i = 0; i < 4; i++) { await swipe(cdp, W, H, 'down', 0.6); await p.waitForTimeout(450); await add(`index (${i + 1})`) }
await p.locator('.ph-navb[data-go="contact"]').tap(); await p.waitForTimeout(1800); await add('contact')
// ── every file page ──
const ids = await p.evaluate(() => Object.keys(window.__phone.manifest.open))
for (const id of ids) {
  if (ONLY && !ONLY.split(',').includes(id)) continue
  await p.evaluate((id) => window.__phone.openEntry(id), id)
  try { await until(p, () => window.__phone.phase === 'file', undefined, 40000) } catch { rows.push({ state: `file ${id}`, error: 'did not open' }); continue }
  await p.waitForTimeout(2800)
  await add(`file ${id} · window`)
  // the demo's other states (a Before / After, Flat / Segmented switch): scanned too, then back
  const alts = await p.evaluate(() => [...document.querySelectorAll('.ph-fdemo .seg button')].map((b, i) => [i, b.textContent.trim(), b.getAttribute('aria-pressed') === 'false']).filter((x) => x[2]))
  for (const [i, name] of alts) { await p.evaluate((i) => document.querySelectorAll('.ph-fdemo .seg button')[i].click(), i); await p.waitForTimeout(1600); await add(`file ${id} · window (${name})`) }
  if (alts.length) { await p.evaluate(() => document.querySelectorAll('.ph-fdemo .seg button')[0].click()); await p.waitForTimeout(600) }
  const total = await p.evaluate(() => document.documentElement.scrollHeight)
  let y = 0, k = 0
  while (y + H < total - 4 && k < 14) { y = Math.min(total - H, y + Math.round(H * 0.8)); await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(260); await add(`file ${id} · body ${++k}`) }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300)
  await p.evaluate(() => window.__phone.closeFile(true)); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 40000).catch(() => {}); await p.waitForTimeout(900)
}
// ── the interior (the profile drive's door; the intro; the first station; one station held) ──
if (!ONLY || ONLY.split(',').includes('YW-000')) {
  try {
    await p.evaluate(() => window.__phone.goTo(0)); await until(p, () => window.__phone.at === 0 && window.__phone.phase === 'settled'); await p.waitForTimeout(1500)
    const mode = (m, ms = 90000) => p.waitForFunction((m) => { const s = window.__phone.space; return s && m.includes(s.mode) }, m, { timeout: ms })
    await p.locator('.ph-door').tap(); await mode(['door'], 15000); await p.waitForTimeout(500); await add('interior · door')
    await mode(['intro'], 30000); await p.waitForTimeout(1200); await add('interior · intro')
    await mode(['rest', 'station'], 120000); await p.waitForTimeout(1500); await add('interior · first station')
    await p.locator('.ph-sp-steps button').nth(2).evaluate((e) => e.click()); await mode(['held'], 15000); await p.waitForTimeout(900); await add('interior · step 3 held')
  } catch (e) { rows.push({ state: 'interior', error: 'did not run: ' + String(e).slice(0, 160) }) }
}
// ── the landscape notice ──
await p.setViewportSize({ width: H, height: W }); await p.waitForTimeout(900); await add('landscape notice')
await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(900)
fs.writeFileSync(path.join(OUT, `sweep-${TAG}.json`), JSON.stringify({ size: TAG, rows, errs, csp: await p.evaluate(() => window.__phone.csp), canvasText: 'the entry page paints the marks\' numbers on its canvas at 11 px (Gate.tsx, phone)' }, null, 1))
const bad = rows.filter((r) => r.error || r.under11?.length || r.lowContrast?.length || r.overScene?.length)
console.log(`${rows.length} states, ${bad.length} with a finding, ${errs.length} console errors`)
for (const r of bad.slice(0, 40)) console.log(r.state, r.error ?? '', 'under11', JSON.stringify(r.under11), 'low', JSON.stringify(r.lowContrast), 'scene', JSON.stringify(r.overScene))
await b.close()
