// P5, the rest: no scripting on a phone (the prerendered page), reduced motion (no slide, stills and crossfades), landscape (the notice, and the same place after turning back),
// pinch zoom, the stage hidden from assistive tech, the heading order and every control's name (Chrome's accessibility tree). Production build (vite preview).
//   node p5-misc.mjs <outDir> [--size=390x664] [--base=http://127.0.0.1:4196]
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { launch, swipe, until } from './lib.mjs'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:4196')
const [W, H] = flag('size', '390x664').split('x').map(Number), TAG = `${W}x${H}`
fs.mkdirSync(OUT, { recursive: true })
const rep = { size: TAG }
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

// ── no scripting, on a phone: the prerendered page is the page ──
{
  const br = await chromium.launch({ channel: 'chrome', args: GPU })
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, javaScriptEnabled: false })
  const p = await ctx.newPage(); await p.goto(`${BASE}/`, { waitUntil: 'load' }); await p.waitForTimeout(500)
  await p.screenshot({ path: path.join(OUT, `nojs-${TAG}-top.png`) })
  await p.screenshot({ path: path.join(OUT, `nojs-${TAG}-full.jpg`), fullPage: true, type: 'jpeg', quality: 70 })
  rep.nojs = await p.evaluate(() => {
    const m = document.querySelector('main.prerender'), cs = getComputedStyle(m), h1 = m.querySelector('h1')
    const sizes = [...m.querySelectorAll('p, li, a, h2')].map((e) => parseFloat(getComputedStyle(e).fontSize))
    return { visible: cs.visibility, textChars: m.textContent.length, h1: h1.textContent, h1Visible: getComputedStyle(h1).visibility, h2: [...m.querySelectorAll('h2')].map((e) => e.textContent), links: m.querySelectorAll('a').length, minFontPx: Math.min(...sizes), scrollWidth: document.documentElement.scrollWidth, bg: getComputedStyle(document.body).backgroundColor, prename: getComputedStyle(document.body).display }
  })
  await br.close()
}

// ── reduced motion: from the cover to the Index, a file from its row and back ──
{
  const { b, p, cdp, errs } = await launch(W, H)
  await p.emulateMedia({ reducedMotion: 'reduce' })
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  rep.reduced = { mode: await p.evaluate(() => window.__phone.mode) }
  await p.evaluate(() => {
    window.__tr = new Set(); window.__sl = new Set(); window.__rise = new Set()
    const f = () => { const t = document.querySelector('.ph-index').style.translate; window.__tr.add(t || '(none)'); window.__sl.add(+window.__phone.page.indexSlide.toFixed(2)); requestAnimationFrame(f) }; requestAnimationFrame(f)
  })
  await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(800)
  rep.reduced.afterSwipe = await p.evaluate(() => ({ fades: window.__phone.stage.fades, handoffs: window.__phone.stage.handoffs.map((h) => h.via), mode: window.__phone.mode, videosPlaying: [...document.querySelectorAll('video')].filter((v) => !v.paused).length }))
  await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H); await p.waitForTimeout(500)
  await p.evaluate(() => { const r = document.querySelector('.ph-ix[data-id="ED-02"]').getBoundingClientRect(); scrollBy(0, r.top - innerHeight / 2) }); await p.waitForTimeout(500)
  const bb = await p.locator('.ph-ix[data-id="ED-02"]').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await until(p, () => window.__phone.phase === 'file', undefined, 30000); await p.waitForTimeout(600)
  rep.reduced.open = await p.evaluate(() => ({ openId: window.__phone.openId, handoffs: window.__phone.stage.handoffs.map((h) => `${h.clip}:${h.via}`), videosPlaying: [...document.querySelectorAll('video')].filter((v) => !v.paused).length }))
  await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.openId, undefined, 30000); await p.waitForTimeout(800)
  rep.reduced.close = await p.evaluate(() => ({ translateValuesSeen: [...window.__tr], indexSlideValuesSeen: [...window.__sl], handoffs: window.__phone.stage.handoffs.map((h) => `${h.clip}:${h.via}`), mode: window.__phone.mode }))
  rep.reduced.errs = errs; rep.reduced.csp = await p.evaluate(() => window.__phone.csp)
  await b.close()
}

// ── landscape: the notice on paper; turning back brings the page to the same place; pinch zoom; the tree ──
{
  const { b, p, cdp, errs } = await launch(W, H)
  await cdp.send('Accessibility.enable')
  await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' })
  await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1500)
  await p.locator('.ph-navb[data-go="index"]').tap(); await until(p, (h) => Math.abs(scrollY - 5 * h) < 4, H); await p.waitForTimeout(600)
  await swipe(cdp, W, H, 'down', 0.6); await p.waitForTimeout(900)
  const before = await p.evaluate(() => ({ y: Math.round(scrollY), row: Math.round(document.querySelector('.ph-ix[data-id="SR-03"]').getBoundingClientRect().top) }))
  await p.screenshot({ path: path.join(OUT, `landscape-${TAG}-0-before.png`) })
  await p.setViewportSize({ width: H, height: W }); await p.waitForTimeout(900)
  await p.screenshot({ path: path.join(OUT, `landscape-${TAG}-1-landscape.png`) })
  const land = await p.evaluate(() => { const e = document.querySelector('.ph-land'), r = e.getBoundingClientRect(), t = e.querySelector('p').getBoundingClientRect(), cs = getComputedStyle(e); return { display: cs.display, bg: cs.backgroundColor, text: e.textContent, role: e.getAttribute('role'), rect: [Math.round(r.width), Math.round(r.height)], textCentreOffset: [Math.round(t.left + t.width / 2 - innerWidth / 2), Math.round(t.top + t.height / 2 - innerHeight / 2)], fontPx: parseFloat(getComputedStyle(e).fontSize), htmlOverflow: getComputedStyle(document.documentElement).overflow } })
  // a swipe in landscape does not move the page behind the notice
  land.yInLandscape = await p.evaluate(() => Math.round(scrollY))
  await swipe(cdp, H, W, 'down', 0.5).catch(() => {}); await p.waitForTimeout(500)
  land.yAfterSwipe = await p.evaluate(() => Math.round(scrollY)); land.pageMovedBehindNotice = land.yAfterSwipe !== land.yInLandscape
  await cdp.send('Accessibility.getFullAXTree').then(({ nodes }) => { land.axStatus = nodes.filter((n) => !n.ignored && n.role?.value === 'status').map((n) => n.name?.value) })
  await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(1200)
  const after = await p.evaluate(() => ({ y: Math.round(scrollY), row: Math.round(document.querySelector('.ph-ix[data-id="SR-03"]').getBoundingClientRect().top), landShown: getComputedStyle(document.querySelector('.ph-land')).display }))
  await p.screenshot({ path: path.join(OUT, `landscape-${TAG}-2-back.png`) })
  rep.landscape = { before, land, after, samePlace: Math.abs(after.y - before.y) <= 2 && Math.abs(after.row - before.row) <= 2 }

  // ── pinch zoom, the stage hidden, headings in order, every control named (the Index state) ──
  rep.a11y = await p.evaluate(() => {
    const meta = document.querySelector('meta[name=viewport]').content
    const hs = [...document.querySelectorAll('h1, h2, h3')].map((h) => ({ l: Number(h.tagName[1]), t: h.textContent.trim().slice(0, 40) }))
    const skips = []; for (let i = 1; i < hs.length; i++) if (hs[i].l > hs[i - 1].l + 1) skips.push(`${hs[i - 1].t} (h${hs[i - 1].l}) -> ${hs[i].t} (h${hs[i].l})`)
    return { viewportMeta: meta, pinchZoomAllowed: !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(meta), stageHidden: document.querySelector('.ph-stagebox').getAttribute('aria-hidden'), reticleHidden: document.querySelector('.ph-reticle').getAttribute('aria-hidden'), videosHidden: [...document.querySelectorAll('video')].every((v) => v.getAttribute('aria-hidden') === 'true'), h1: hs.filter((h) => h.l === 1).map((h) => h.t), headings: hs.map((h) => `h${h.l} ${h.t}`), skipsInOrder: skips }
  })
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  const controls = nodes.filter((n) => !n.ignored && ['button', 'link', 'checkbox', 'textbox', 'tab', 'combobox'].includes(n.role?.value))
  rep.a11y.controls = controls.length; rep.a11y.unnamed = controls.filter((n) => !(n.name?.value ?? '').trim()).map((n) => n.role.value + ' ' + n.backendDOMNodeId)
  rep.a11y.errs = errs
  await b.close()
}
fs.writeFileSync(path.join(OUT, `misc-${TAG}.json`), JSON.stringify(rep, null, 1))
console.log(JSON.stringify(rep, null, 1))
