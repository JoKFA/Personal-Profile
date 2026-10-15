// P5 / E1: the main path on the production build (vite preview, with the CSP), in real time, Chrome (channel:'chrome'), isMobile + touch, DPR 3:
//   entry page (hold) -> cover -> 01..04 (swipes) -> Index (the bar's button) -> read it (swipes) -> open a file that is not a selected one -> read it -> back (to the same place in the Index) -> Contact
//   -> every link (its request, or for mailto: its href) -> text size and contrast at each state, the Chrome accessibility tree at each state, 0.5 s contact sheet.
//   node p5-e1.mjs <outDir> [--size=390x664] [--base=http://127.0.0.1:4196] [--file=X-004] [--tag=name]
import fs from 'node:fs'
import path from 'node:path'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196'), FILE = flag('file', 'X-004')
const [W, H] = flag('size', '390x664').split('x').map(Number), TAG = flag('tag', `${W}x${H}`)
fs.mkdirSync(OUT, { recursive: true })

const { b, ctx, p, cdp, errs } = await launch(W, H, { gate: true })
const frames = []
cdp.on('Page.screencastFrame', (f) => { frames.push({ ts: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}) })
const csp = []; p.on('console', (m) => { if (/Content Security Policy|securitypolicy/i.test(m.text())) csp.push(m.text().slice(0, 200)) })
const requests = []; ctx.on('request', (r) => requests.push({ url: r.url().slice(0, 140), type: r.resourceType() }))
await cdp.send('Accessibility.enable')
const rep = { tag: TAG, size: `${W}x${H}`, steps: {}, links: [], checks: {}, ax: {} }
const t0 = Date.now(); const at = () => Date.now() - t0
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const tapAt = async (x, y) => { await p.touchscreen.tap(x, y) }
const center = async (sel) => { const bb = await p.locator(sel).first().boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, bb } }
const shot = (n) => p.screenshot({ path: path.join(OUT, `shot-${TAG}-${n}.png`) })
const phone = () => p.evaluate(() => ({ phase: window.__phone.phase, at: window.__phone.at, busy: window.__phone.busy, y: Math.round(scrollY), openId: window.__phone.openId }))

/** Chrome's accessibility tree, reduced to what a reader walks: landmarks, headings, controls, in order, with names */
const ax = async (name) => {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const byId = new Map(nodes.map((n) => [n.nodeId, n])), rows = []
  const keep = new Set(['heading', 'button', 'navigation', 'banner', 'main', 'region', 'status', 'link', 'dialog', 'list', 'listitem', 'term', 'definition', 'StaticText'])
  const walk = (id, depth) => {
    const n = byId.get(id); if (!n) return
    const role = n.role?.value, nm = n.name?.value
    const show = !n.ignored && keep.has(role) && !(role === 'StaticText' && (!nm || depth > 7 || rows.length > 400))
    if (show && role !== 'StaticText') { const lv = n.properties?.find((x) => x.name === 'level')?.value.value; rows.push(`${'  '.repeat(Math.min(depth, 8))}${role}${lv ? ' h' + lv : ''}: ${JSON.stringify((nm ?? '').slice(0, 80))}`) }
    for (const c of n.childIds ?? []) walk(c, show ? depth + 1 : depth)
  }
  walk(nodes[0].nodeId, 0)
  rep.ax[name] = rows.length
  fs.writeFileSync(path.join(OUT, `ax-${TAG}-${name}.txt`), rows.join('\n'))
}

/** text no smaller than 11 px, and its contrast against the paper under it (WCAG), for what is on screen now */
const readable = (name) => p.evaluate((name) => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
  const rgba = (s) => {
    const c = s.match(/color\(srgb ([^)]+)\)/)   // (a mixed colour is reported as color(srgb r g b / a), 0..1)
    if (c) { const [rgb, al] = c[1].split('/'); const v = rgb.trim().split(/\s+/).map(parseFloat); return [v[0] * 255, v[1] * 255, v[2] * 255, al ? parseFloat(al) : 1] }
    const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]
    const a = m[1].split(/[,/]\s*|\s+/).map((x) => parseFloat(x)); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]
  }
  const paper = [231, 228, 221]
  const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0.5) return c }; return paper }
  const small = [], low = []; let n = 0, worst = 99
  for (const e of document.querySelectorAll('.ph-root *')) {
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue
    const cs = getComputedStyle(e), r = e.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.6 || r.width < 1 || r.bottom < 0 || r.top > innerHeight || e.closest('[aria-hidden="true"]')) continue
    let op = 1; for (let a = e; a; a = a.parentElement) op *= Number(getComputedStyle(a).opacity); if (op < 0.6) continue
    n++
    const fs = parseFloat(cs.fontSize); if (fs < 11) small.push(`${e.className || e.tagName} ${fs}px "${e.textContent.trim().slice(0, 24)}"`)
    const fg = rgba(cs.color), bg = bgOf(e), L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    worst = Math.min(worst, ratio); if (ratio < 4.5) low.push(`${e.className || e.tagName} ${ratio.toFixed(2)} "${e.textContent.trim().slice(0, 24)}"`)
  }
  return { name, texts: n, under11px: small, under4_5: low, worstContrast: Math.round(worst * 100) / 100 }
}, name)

await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })

// ── the entry page: hold the print until it is sealed ──
await p.waitForSelector('.ph-gate .fp-hold'); await p.waitForTimeout(1200)
await ax('0-gate'); rep.checks.gate = await readable('gate')
const [px, py, pw, ph] = await p.evaluate(() => document.querySelector('.ph-gate').dataset.print.split(',').map(Number))
rep.steps.holdAt = at(); await touch('touchStart', px + pw / 2, py + ph / 2)
await until(p, () => window.__phone && window.__phone.entry.sealedAt > 0); await touch('touchEnd')
await until(p, () => window.__phone.entry.coverAt > 0); await p.waitForTimeout(1200)
rep.steps.coverAt = at(); await ax('1-cover'); rep.checks.cover = await readable('cover')

// ── the reel: 01..04 ──
for (let i = 1; i <= 4; i++) {
  await swipe(cdp, W, H); await until(p, (n) => window.__phone.at === n && window.__phone.phase === 'settled', i); await p.waitForTimeout(1100)
  rep.steps[`stop${i}At`] = at(); if (i === 1 || i === 4) { await ax(`2-stop0${i}`); rep.checks[`stop${i}`] = await readable(`stop0${i}`) }
}

// ── the Index: the bar's button, then read it ──
const ixBtn = await center('.ph-navb[data-go="index"]'); await tapAt(ixBtn.x, ixBtn.y)
await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H); await p.waitForTimeout(900)
rep.steps.indexAt = at(); await ax('3-index'); rep.checks.indexTop = await readable('index top'); await shot('index-top')
rep.rows = await p.evaluate(() => [...document.querySelectorAll('.ph-ix')].map((e) => ({ id: e.dataset.id, h: Math.round(e.getBoundingClientRect().height * 10) / 10 })))
rep.rowMinHeight = Math.min(...rep.rows.map((r) => r.h))
await swipe(cdp, W, H, 'down', 0.5); await p.waitForTimeout(900)   // free reading inside the sheet: no snap back
rep.steps.indexReadY = (await phone()).y; rep.checks.indexMid = await readable('index mid'); await shot('index-mid')
await swipe(cdp, W, H, 'down', 0.5); await p.waitForTimeout(700)

// ── a file that is not a selected one, from its row ──
await p.evaluate((id) => { const r = document.querySelector(`.ph-ix[data-id="${id}"]`).getBoundingClientRect(); scrollBy(0, r.top - innerHeight / 2 + r.height / 2) }, FILE); await p.waitForTimeout(700)
const beforeY = (await phone()).y, rowTopBefore = await p.evaluate((id) => Math.round(document.querySelector(`.ph-ix[data-id="${id}"]`).getBoundingClientRect().top), FILE)
const row = await center(`.ph-ix[data-id="${FILE}"]`)
await p.evaluate(() => { window.__sl = []; const f = () => { window.__sl.push([Math.round(performance.now()), +window.__phone.page.indexSlide.toFixed(3), window.__phone.phase]); if (window.__sl.length < 600) requestAnimationFrame(f) }; requestAnimationFrame(f) })
rep.steps.tapRowAt = at(); rep.tapPoint = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return { x, y, hit: e ? `${e.className || e.tagName} ${e.closest('[data-id]')?.dataset.id ?? ''}` : null, y0: Math.round(scrollY) } }, [row.x, row.y])
await tapAt(row.x, row.y)
try { await until(p, () => window.__phone.phase === 'file', undefined, 20000) } catch (e) { rep.tapFailed = { state: await phone(), hitNow: await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.className || e.tagName}` : null }, [row.x, row.y]) }; fs.writeFileSync(path.join(OUT, `e1-${TAG}-FAILED.json`), JSON.stringify(rep, null, 1)); throw e }
await p.waitForTimeout(900)
rep.steps.fileAt = at(); rep.slide = await p.evaluate(() => { const s = window.__sl; const t0 = s[0][0]; const done = s.find((x) => x[1] >= 0.98); return { toGoneMs: done ? done[0] - t0 : null, samples: s.length, phases: [...new Set(s.map((x) => x[2]))] } })
rep.file = await p.evaluate(() => ({ openId: window.__phone.openId, path: location.pathname, focus: document.activeElement?.className + ' | ' + (document.activeElement?.textContent || '').trim().slice(0, 40) }))
await ax('4-file'); rep.checks.file = await readable('file head'); await shot('file')
await swipe(cdp, W, H, 'down', 0.7); await p.waitForTimeout(900); rep.checks.fileRead = await readable('file read')
await swipe(cdp, W, H, 'up', 0.9); await p.waitForTimeout(900)
const back = await center('.ph-back'); rep.steps.backTapAt = at(); await tapAt(back.x, back.y)
await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 20000); await p.waitForTimeout(1200)
const afterY = (await phone()).y
const rowTopAfter = await p.evaluate((id) => Math.round(document.querySelector(`.ph-ix[data-id="${id}"]`).getBoundingClientRect().top), FILE)
rep.back = { beforeY, afterY, rowTopBefore, rowTopAfter, sameRowOffsetPx: Math.abs(rowTopAfter - rowTopBefore), innerHeight: await p.evaluate(() => innerHeight), indexSlideBack: await p.evaluate(() => +window.__phone.page.indexSlide.toFixed(3)), focus: await p.evaluate(() => `${document.activeElement?.className} ${document.activeElement?.dataset?.id ?? ''}`), path: await p.evaluate(() => location.pathname) }
await ax('5-back-in-index'); await shot('back-in-index')

// ── Contact: the bar's button, the facts, the four links ──
const ctBtn = await center('.ph-navb[data-go="contact"]'); await tapAt(ctBtn.x, ctBtn.y)
await p.waitForFunction(() => { const r = document.querySelector('.ph-contact h2').getBoundingClientRect(); return r.top > 0 && r.top < 260 }, undefined, { timeout: 8000 }); await p.waitForTimeout(1000)
rep.steps.contactAt = at(); await ax('6-contact'); rep.checks.contact = await readable('contact'); await shot('contact')
rep.contact = await p.evaluate(() => ({ facts: [...document.querySelectorAll('.ph-dl dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]), linkHeights: [...document.querySelectorAll('.ph-cta')].map((a) => Math.round(a.getBoundingClientRect().height)), mailSelectable: getComputedStyle(document.querySelector('.ph-mail')).userSelect, mailText: document.querySelector('.ph-mail').textContent }))
// every link: a stub answers the outside world (nothing leaves the machine); the request or the href is the record
await ctx.route(/^https:\/\/(www\.)?(linkedin|github)\.com\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }))
for (const label of ['Email', 'LinkedIn', 'GitHub', 'Résumé']) {
  const a = p.locator('.ph-cta', { hasText: label }).first()
  const href = await a.getAttribute('href'), target = await a.getAttribute('target'), rel = await a.getAttribute('rel')
  const rec = { label, href, target, rel }
  if (href.startsWith('mailto:')) {
    // a tap on a mailto link would start the phone's mail app: the click is observed and its default is cancelled
    const c = await center('.ph-cta:has(.n:text("Email"))')
    const pr = p.evaluate(() => new Promise((res) => { const a = [...document.querySelectorAll('.ph-cta')].find((x) => x.textContent.includes('Email')); a.addEventListener('click', (e) => { e.preventDefault(); res(a.href) }, { once: true }) }))
    await tapAt(c.x, c.y); rec.clickedHref = await pr
  } else {
    const c = await center(`.ph-cta:has(.n:text("${label}"))`)
    const [np] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), tapAt(c.x, c.y)])
    await np.waitForLoadState('load').catch(() => {}); rec.openedUrl = np.url()
    if (label === 'Résumé') { const resp = await ctx.request.get(new URL(href, BASE).href); rec.status = resp.status(); rec.contentType = resp.headers()['content-type'] }
    await np.close()
  }
  rep.links.push(rec)
}
await p.waitForTimeout(600)
await cdp.send('Page.stopScreencast')

// ── the record ──
rep.csp = [...csp, ...(await p.evaluate(() => window.__phone.csp))]; rep.errs = errs
rep.requestsOf = requests.filter((r) => /linkedin|github|resume|mailto/i.test(r.url)).map((r) => `${r.type} ${r.url}`)
rep.totalMs = at()
const d = path.join(OUT, `screencast-${TAG}`); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true })
frames.forEach((s, i) => fs.writeFileSync(path.join(d, `s-${String(i).padStart(4, '0')}-${s.ts.toFixed(4)}.jpg`), Buffer.from(s.data, 'base64')))
rep.frames = frames.length; rep.firstTs = frames[0]?.ts
fs.writeFileSync(path.join(OUT, `e1-${TAG}.json`), JSON.stringify(rep, null, 1))
console.log(JSON.stringify({ tag: TAG, steps: rep.steps, rowMinHeight: rep.rowMinHeight, slide: rep.slide, back: rep.back, links: rep.links.map((l) => ({ label: l.label, href: l.href, opened: l.openedUrl ?? l.clickedHref, status: l.status })), csp: rep.csp.length, errs: errs.length, checks: Object.fromEntries(Object.entries(rep.checks).map(([k, v]) => [k, { texts: v.texts, under11: v.under11px.length, low: v.under4_5.length, worst: v.worstContrast }])) }, null, 1))
await b.close()
