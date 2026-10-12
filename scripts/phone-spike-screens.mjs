// P0.3 item 4: the master canvas scaled to width on ten viewport sizes (cover and window states) + where the bottom panel would cover.
// node scripts/phone-spike-screens.mjs <outDir> [--assets=frozen] [--base=...]
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const [OUT, ...rest] = process.argv.slice(2)
const flag = (n, d) => { const a = rest.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d }
const BASE = flag('base', 'http://127.0.0.1:5194'), ASSETS = flag('assets', '')
fs.mkdirSync(OUT, { recursive: true })
const SIZES = [[375, 667, 'iPhone SE (full screen)'], [390, 844, 'iPhone 13/14 (full screen)'], [430, 932, 'iPhone Pro Max (full screen)'], [360, 800, 'Android (full screen)'], [412, 915, 'Android (full screen)'],
  [375, 548, 'iPhone SE, Safari toolbars'], [390, 664, 'iPhone 13/14, Safari toolbars'], [430, 740, 'Pro Max, Safari toolbars'], [360, 640, 'Android Chrome, toolbars'], [412, 780, 'Android Chrome, toolbars']]
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] })
const rows = []
for (const [w, h, label] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/?phone-spike${ASSETS ? '&assets=' + ASSETS : ''}`, { waitUntil: 'load' })
  await p.waitForFunction(() => window.__spike && window.__spike.ready)
  await p.addStyleTag({ content: '.sp-bar{display:none}' })
  const m = await p.evaluate(() => window.__spike.manifest)
  const s = w / 390, visH = h / s   // visible master height
  const ret = (n) => m.assets[n].reticle, win = m.assets['window-X-001']
  const annotate = (panelMaster, extra) => p.evaluate(([ph, s, ex]) => {
    document.querySelectorAll('.dbg').forEach((e) => e.remove())
    const d = document.createElement('div'); d.className = 'dbg'
    d.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${ph * s}px;background:rgba(200,40,40,.18);border-top:1.5px dashed #c82828;z-index:20;pointer-events:none`
    document.body.appendChild(d)
    if (ex) { const e = document.createElement('div'); e.className = 'dbg'; e.style.cssText = `position:fixed;left:0;right:0;top:${ex * s}px;height:0;border-top:1.5px dashed #2850c8;z-index:20;pointer-events:none`; document.body.appendChild(e) }
  }, [panelMaster, s, extra])
  const out = { size: `${w}x${h}`, label, scale: +s.toFixed(3), visibleMasterH: +visH.toFixed(0), cropped: +Math.max(0, 866 - visH).toFixed(0) }
  for (const [state, panel, name] of [['cover', 168, 'stop-YW-000'], ['x001', 252, 'stop-X-001']]) {
    await p.evaluate((st) => window.__spike.show(st), state)
    const r = ret(name), panelTop = visH - panel
    out[state] = { reticleBottom: +r.y1.toFixed(0), panelTop: +panelTop.toFixed(0), reticleUnderPanelPx: +Math.max(0, r.y1 - panelTop).toFixed(0), reticleCenterY: +((r.y0 + r.y1) / 2).toFixed(0), reticleCenterCovered: (r.y0 + r.y1) / 2 > panelTop }
    await annotate(panel); await p.screenshot({ path: path.join(OUT, `${w}x${h}-${state}.png`) })
  }
  await p.evaluate(() => window.__spike.show('window'))
  const dieY = win.die[1]
  out.window = { windowBottomMaster: 558, windowBottomVisible: 558 <= visH, windowBottomPx: +(558 * s).toFixed(0), viewportPx: h, dieY, dieVisible: dieY < visH, pageSpaceBelowWindowPx: +(h - 558 * s).toFixed(0) }
  await annotate(0, 558); await p.screenshot({ path: path.join(OUT, `${w}x${h}-window.png`) })
  rows.push(out); await ctx.close()
}
await b.close()
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(rows, null, 1))
for (const r of rows) console.log(r.size.padEnd(8), r.label.padEnd(30), 'scale', r.scale, 'visibleH', r.visibleMasterH, 'cropped', r.cropped, '| cover: reticle bottom', r.cover.reticleBottom, 'panel top', r.cover.panelTop, 'under', r.cover.reticleUnderPanelPx, '| x001: bottom', r.x001.reticleBottom, 'panel top', r.x001.panelTop, 'under', r.x001.reticleUnderPanelPx, 'centreCovered', r.x001.reticleCenterCovered, '| window room below', r.window.pageSpaceBelowWindowPx)
