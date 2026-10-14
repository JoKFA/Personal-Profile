// real touch scrolling inside a file (CDP touch events), the sticky bar, the stage hand-over, Back (history) and rotation. node p3b-touch.mjs <out> [base]
import fs from 'node:fs'
import { launch, swipe, until } from './lib.mjs'
const [OUT, BASE = 'http://127.0.0.1:5194'] = process.argv.slice(2)
fs.mkdirSync(OUT, { recursive: true })
const W = 390, H = 664
const { b, p, cdp, errs } = await launch(W, H)
await p.goto(`${BASE}/?phone-app&phone-expose`, { waitUntil: 'load' }); await until(p, () => window.__phone && window.__phone.ready); await p.waitForTimeout(1000)
await swipe(cdp, W, H); await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled'); await p.waitForTimeout(700)
const R = {}
R.before = await p.evaluate(() => ({ y: scrollY, at: window.__phone.at, stage: window.__phone.stage.current, marks: window.__phone.marks().map((m) => [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10]) }))
await p.screenshot({ path: `${OUT}/restore-before.png` })
const bb = await p.locator('.ph-go[data-id="X-001"]').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(800)
const st = () => p.evaluate(() => { const f = document.querySelector('.ph-file.on'); const lab = document.querySelector('.ph-barfile'); return { top: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight, reelPos: getComputedStyle(document.querySelector('.ph-reel')).position, snap: getComputedStyle(document.documentElement).scrollSnapType, stageHidden: getComputedStyle(document.querySelector('.ph-stagebox')).visibility, label: getComputedStyle(lab).opacity, labelText: lab.textContent, focus: document.activeElement?.className } })
R.atOpen = await st()
for (let i = 0; i < 3; i++) { await swipe(cdp, W, H, 'down', 0.7); await p.waitForTimeout(500) }
R.afterThreeSwipes = await st()
await p.screenshot({ path: `${OUT}/touch-scrolled.png` })
for (let i = 0; i < 6; i++) { await swipe(cdp, W, H, 'up', 0.9); await p.waitForTimeout(250) }
R.backToTop = await st()
// Back (the browser's history: iOS edge swipe): no close clip, the end state at once
await p.evaluate(() => { scrollTo(0, 400) }); await p.waitForTimeout(300)
const t0 = Date.now(); await p.goBack(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy); R.backMs = Date.now() - t0
R.afterBack = await p.evaluate(() => ({ phase: window.__phone.phase, at: window.__phone.at, url: location.pathname, stage: window.__phone.stage.current, stageVisible: getComputedStyle(document.querySelector('.ph-stagebox')).visibility, focus: document.activeElement?.className, fileScrollers: document.querySelectorAll('.ph-file.on').length }))
await p.screenshot({ path: `${OUT}/touch-after-back.png` })
R.afterBackY = await p.evaluate(() => ({ y: scrollY, at: window.__phone.at, stage: window.__phone.stage.current, marks: window.__phone.marks().map((m) => [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10]) }))
await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/restore-after-back.png` })
// Forward: opens it again
await p.goForward(); await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(800)
R.afterForward = await st()
// rotation while the file is open: landscape shows the paper notice, portrait again returns
await p.setViewportSize({ width: H, height: W }); await p.waitForTimeout(500)
R.landscape = await p.evaluate(() => ({ land: document.querySelector('.ph-root').hasAttribute('data-land'), phase: window.__phone.phase }))
await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(800)
R.portraitAgain = await p.evaluate(() => { const f = document.querySelector('.ph-file.on'); return { phase: window.__phone.phase, scroller: !!f, wz: getComputedStyle(f).getPropertyValue('--ph-wz') } })
await p.screenshot({ path: `${OUT}/touch-rotated-back.png` })
// the in-page button: close with the clip, and the reel is exactly where it was
await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy); await p.waitForTimeout(900)
R.afterButton = await p.evaluate(() => ({ y: scrollY, at: window.__phone.at, stage: window.__phone.stage.current, marks: window.__phone.marks().map((m) => [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10]) }))
await p.screenshot({ path: `${OUT}/restore-after-button.png` })
// Safari's toolbar: the viewport grows while a long file is read (664 -> 750 -> 664); the page being read stays, and the close restores the reel at the same share
{
  const bb2 = await p.locator('.ph-go[data-id="X-001"]').boundingBox(); await p.touchscreen.tap(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2)
  await until(p, () => window.__phone.phase === 'file'); await p.waitForTimeout(900)
  await p.evaluate(() => scrollTo(0, 900)); await p.waitForTimeout(400)
  const rd = () => p.evaluate(() => ({ y: Math.round(scrollY), wz: getComputedStyle(document.querySelector('.ph-file.on')).getPropertyValue('--ph-wz'), h: innerHeight, viewH: window.__phone.view.h }))
  const a = await rd()
  await p.setViewportSize({ width: W, height: 750 }); await p.waitForTimeout(600)
  const b2 = await rd()
  await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(600)
  const c = await rd()
  R.toolbar = { opened: a, grown: b2, back: c }
  await p.setViewportSize({ width: W, height: 750 }); await p.waitForTimeout(400)
  await p.locator('.ph-back').tap(); await until(p, () => window.__phone.phase === 'settled' && !window.__phone.busy); await p.waitForTimeout(700)
  R.toolbar.closedAt750 = await p.evaluate(() => ({ y: Math.round(scrollY), at: window.__phone.at, h: innerHeight, viewH: window.__phone.view.h, share: scrollY / innerHeight }))
  await p.screenshot({ path: `${OUT}/toolbar-closed-750.png` })
}
R.errs = errs
console.log(JSON.stringify(R, null, 1))
fs.writeFileSync(`${OUT}/touch.json`, JSON.stringify(R, null, 1))
await b.close()
