// P2 acceptance walk, real time, Chrome (channel:'chrome'), isMobile + touch, DPR 3.
//   node src/casefile/phone/app/dev/walk.mjs <outDir> [--base=http://127.0.0.1:5194] [--sizes=375x548,...] [--query=&phone-reject]
// Per size: cover -> 01 (touch swipe) -> back -> 01 -> open X-001 -> close, screenshots of every state, plus layout checks
// (panel over reticle, clipped text, horizontal overflow, text size) and the shell's own state at each step.
import fs from 'node:fs'
import path from 'node:path'

const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d }
const BASE = flag('base', 'http://127.0.0.1:5194'), QUERY = flag('query', ''), TAGN = flag('tag', ''), REAL = !rest.includes('--dev')   // the bake's public/phone/manifest.json by default; --dev: the temporary P0 manifest
const SIZES = flag('sizes', '375x548,390x664,390x750,430x740,360x640,412x780,412x860').split(',').map((s) => s.split('x').map(Number))
fs.mkdirSync(OUT, { recursive: true })

import { launch, swipe, state, until, checks } from './lib.mjs'

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('walk.mjs')) {
  const report = []
  for (const [W, H] of SIZES) {
    const tag = `${W}x${H}${TAGN}`, dir = path.join(OUT, tag); fs.mkdirSync(dir, { recursive: true })
    const { b, p, cdp, errs } = await launch(W, H)
    const log = []
    const shot = async (name) => { await p.screenshot({ path: path.join(dir, `${name}.png`) }); log.push(name) }
    try {
      await p.goto(`${BASE}/?phone-app${REAL ? '&phone-expose' : '&phone-dev'}${QUERY}`, { waitUntil: 'load' })
      await until(p, () => window.__phone && window.__phone.ready)
      await p.waitForTimeout(1300)
      const R = { size: tag, steps: {} }
      await shot('1-cover'); R.cover = await checks(p, 0)
      // cover -> 01: a real swipe; the pan clip plays, the panel decrypts when it lands
      const t0 = Date.now()
      await swipe(cdp, W, H)
      await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled')
      R.steps.coverTo01 = { ms: Date.now() - t0, ...(await state(p)) }
      await p.waitForTimeout(900)
      await shot('2-stop01'); R.s01 = await checks(p, 1)
      // and back
      await swipe(cdp, W, H, 'up')
      await until(p, () => window.__phone.at === 0 && window.__phone.phase === 'settled')
      await p.waitForTimeout(900)
      await shot('3-back-on-cover')
      await swipe(cdp, W, H)
      await until(p, () => window.__phone.at === 1 && window.__phone.phase === 'settled')
      await p.waitForTimeout(900)
      // open X-001: tap the real button
      const bb = await p.locator('.ph-go[data-id="X-001"]').boundingBox()
      await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
      await until(p, () => window.__phone.phase === 'opening')
      await p.waitForTimeout(500); await shot('4-opening-0.5s')
      await p.waitForTimeout(600); await shot('5-opening-1.1s')
      await until(p, () => window.__phone.phase === 'file')
      await p.waitForTimeout(400)
      await shot('6-file'); R.steps.file = await state(p)
      R.file = await p.evaluate(() => ({ verify: window.__phone.dom.panels.get('X-001').file?.verify?.text, blocks: window.__phone.dom.panels.get('X-001').file?.blocks, ok: window.__phone.dom.panels.get('X-001').file?.ok, back: document.activeElement?.className }))
      await p.locator('.ph-back').tap()
      await until(p, () => window.__phone.phase === 'closing')
      await p.waitForTimeout(500); await shot('7-closing-0.5s')
      await until(p, () => window.__phone.phase === 'settled' && window.__phone.at === 1)
      await p.waitForTimeout(900)
      await shot('8-closed'); R.steps.closed = await state(p)
      R.stills = await p.evaluate(() => window.__phone.stage.stills.alive)
      R.mode = await p.evaluate(() => window.__phone.mode)
      R.handoffs = await p.evaluate(() => window.__phone.stage.handoffs.map((h) => ({ clip: h.clip, via: h.via, latencyMs: +h.latencyMs.toFixed(1) })))
      R.csp = await p.evaluate(() => window.__phone.csp)
      R.errs = errs
      report.push(R)
      console.log(tag, 'ok', R.steps.coverTo01.ms + 'ms', 'overlapPanel cover/01:', R.cover.overlapPanel, R.s01.overlapPanel, 'issues', R.cover.issues.length + R.s01.issues.length, 'errs', errs.length)
    } catch (e) {
      console.log(tag, 'FAILED', String(e).slice(0, 300)); report.push({ size: tag, failed: String(e), log, errs }); await shot('failed').catch(() => {})
    } finally { await b.close() }
  }
  fs.writeFileSync(path.join(OUT, `walk${TAGN}.json`), JSON.stringify(report, null, 1))
}
