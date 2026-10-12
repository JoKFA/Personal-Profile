// Phone prototype: the page over the real engine (lab). Everything here is drawn from the director's clock
// (the archive's own time), never from CSS transitions, so a frame-exact film and a live run agree.
// Text decrypts the site's way (ui/cipher.ts): real AES-256-GCM ciphertext of the text, its bits shown per
// 16-character block, lit olive when the block's turn comes, then resolved into the letters.
import { seal } from '../ui/cipher'
import { smooth } from '../motion/waves'
import { damp, spring } from '../motion/spring'

const BLOCK = 16
const css = `
#ph *, #ph *::before { box-sizing: border-box; }
#ph { position: fixed; inset: 0; z-index: 60; pointer-events: none; overflow: hidden; font-family: var(--sans); color: var(--ink); }
#ph .brand { position: absolute; left: 20px; top: 20px; }
#ph .brand .a { font: 800 17px/1 var(--sans); letter-spacing: -.01em; }
#ph .brand .b { font: 700 10.5px/1 var(--sans); letter-spacing: .16em; margin-top: 6px; }
#ph .nav { position: absolute; right: 20px; top: 24px; display: flex; gap: 18px; font: 600 11.5px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; }
#ph .sheet { position: absolute; left: 0; right: 0; top: 0; background: var(--bg); }
#ph .sheet::after { content: ""; position: absolute; left: 0; right: 0; bottom: -26px; height: 26px; background: linear-gradient(var(--bg), color-mix(in srgb, var(--bg) 0%, transparent)); }
#ph .thesis { position: absolute; left: 20px; right: 20px; top: 84px; font: 800 23px/1.2 var(--sans); letter-spacing: -.02em; }
#ph .thesis.r { top: 140px; font-weight: 300; }
#ph .facts { position: absolute; left: 20px; right: 20px; top: 226px; font: 500 13px/1.45 var(--sans); color: var(--ink2); }
#ph .mk { position: absolute; left: 0; top: 0; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; background: var(--ink); }
#ph .tag { position: absolute; left: 0; top: 0; font: 700 11px/1 var(--mono); letter-spacing: .12em; white-space: nowrap; background: color-mix(in srgb, var(--bg) 92%, transparent); padding: 5px 7px; height: 21px; min-width: 190px; }
#ph .tag > div { position: absolute; left: 7px; top: 5px; }
#ph .readout { position: absolute; left: 0; top: 0; font: 700 13px/1 var(--sans); letter-spacing: .01em; text-transform: uppercase; white-space: nowrap; }
#ph .rule { position: absolute; left: 0; top: 0; height: 1px; width: 400px; background: var(--ink); opacity: .5; }
#ph .panel { position: absolute; left: 0; right: 0; top: 0; height: 260px; background: var(--bg); border-top: 1px solid var(--hair2); }
#ph .grp { position: absolute; inset: 0; padding: 16px 20px 0; --ph: 252px; }
#ph .lbl { font: 500 11px/1.35 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--label); }
#ph .title { font: 780 26px/1.15 var(--sans); letter-spacing: -.015em; margin-top: 8px; }
#ph .sum { font: 400 15px/1.45 var(--sans); color: var(--ink2); margin-top: 8px; }
#ph .small { position: absolute; left: 20px; right: 20px; top: calc(var(--ph) - 88px); font: 500 12.5px/1.4 var(--sans); color: var(--label); }
#ph .verify { position: absolute; left: 20px; right: 20px; top: 79px; font: 700 11px/1.3 var(--mono); letter-spacing: .12em; color: var(--acc-text); }
#ph .row { position: absolute; left: 20px; right: 20px; top: calc(var(--ph) - 44px); display: flex; justify-content: space-between; align-items: center; }
#ph .go { font: 600 14px/1 var(--sans); letter-spacing: .14em; text-transform: uppercase; }
#ph .ticks { display: flex; gap: 10px; font: 500 11px/1 var(--mono); color: var(--label); }
#ph .ticks span.on { color: var(--acc-text); font-weight: 700; }
#ph .nums { position: absolute; left: 20px; right: 20px; top: calc(var(--ph) - 74px); display: flex; gap: 28px; }
#ph .nums div { font: 300 30px/1 var(--sans); white-space: nowrap; }
#ph .nums small { display: block; margin-top: 6px; font: 500 11px/1.2 var(--mono); letter-spacing: .1em; color: var(--label); text-transform: uppercase; }
#ph .wash { position: absolute; left: 0; top: 0; background: var(--bg); }
#ph svg.dia { position: absolute; left: 0; top: 0; overflow: visible; }
#ph .node { position: absolute; border: 1px solid var(--hair2); background: color-mix(in srgb, #fbf8f1 92%, transparent); padding: 6px 9px; font: 500 11.5px/1.3 var(--mono); color: var(--ink); white-space: nowrap; }
#ph .node small { display: block; font-size: 11px; color: var(--label); margin-top: 2px; }
#ph .node.core { border-color: var(--acc); background: color-mix(in srgb, #eef0dc 94%, transparent); text-align: center; }
#ph .node.hot { border-color: var(--alert); background: color-mix(in srgb, #f6e3da 94%, transparent); }
#ph .zone { position: absolute; border: 1px dashed #c9a35a; }
#ph .zone span { position: absolute; left: 10px; top: 8px; font: 500 11px/1 var(--mono); letter-spacing: .1em; color: #8a6a2c; }
#ph .dhead { position: absolute; left: 20px; right: 20px; display: flex; justify-content: space-between; font: 500 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); }
#ph .steps { position: absolute; left: 20px; right: 20px; display: flex; justify-content: space-between; font: 500 11px/1 var(--mono); letter-spacing: .1em; color: var(--label); }
#ph .steps .done { color: var(--acc-text); } #ph .steps .on { color: var(--ink); font-weight: 700; }
#ph .stat { position: absolute; left: 20px; right: 20px; font: 500 12px/1.3 var(--mono); color: var(--ink); }
#ph .stat b { color: var(--alert); font-weight: 700; }
#ph .fbar { position: absolute; left: 20px; right: 20px; top: 22px; display: flex; justify-content: space-between; font: 600 11.5px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; }
#ph .cbx { position: relative; }
#ph .cbx > i { position: absolute; inset: 1px 0; background-size: 100% 100%; image-rendering: pixelated; }
`

/** A line that decrypts block by block: the real ciphertext's bits, olive at its turn, then the letters. */
class Line {
  el: HTMLElement; spans: HTMLSpanElement[] = []; covers: HTMLElement[] = []; bits: Uint8Array[] = []
  text: string
  private painted = new Map<HTMLElement, string>()
  constructor(parent: HTMLElement, cls: string, text: string) {
    this.text = text
    this.el = document.createElement('div'); this.el.className = cls; parent.appendChild(this.el)
    for (let i = 0; i < text.length; i += BLOCK) {
      const s = document.createElement('span'); s.className = 'cbx'; s.textContent = text.slice(i, i + BLOCK)
      const c = document.createElement('i'); s.appendChild(c)
      this.el.appendChild(s); this.spans.push(s); this.covers.push(c)
    }
    void seal(text).then((sd) => { for (let b = 0; b < this.spans.length; b++) this.bits[b] = sd.ct.slice(b * BLOCK, b * BLOCK + BLOCK); this.painted.clear() })
  }
  private paint(c: HTMLElement, bytes: Uint8Array | undefined, col: string) {
    const key = col + (bytes ? bytes.join(',') : '')
    if (this.painted.get(c) === key) return
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 4
    const g = cv.getContext('2d')!; g.fillStyle = col
    for (let i = 0; i < 128; i++) if (bytes && (bytes[i >> 3] >> (7 - (i & 7))) & 1) g.fillRect(i % 32, i >> 5, 1, 1)
    c.style.backgroundImage = `url(${cv.toDataURL()})`; this.painted.set(c, key)
  }
  /** p: 0 sealed … 1 plain, the blocks taking their turns in order; o: the line's opacity */
  set(p: number, o = 1) {
    this.el.style.opacity = String(o)
    if (o <= 0) return
    const n = this.spans.length
    for (let b = 0; b < n; b++) {
      const at = p * (n + 0.6) - b
      const span = this.spans[b], cover = this.covers[b]
      if (at < 1) cover.style.display = ''
      if (at <= 0) { span.style.color = 'transparent'; cover.style.opacity = '1'; this.paint(cover, this.bits[b], 'rgba(22,23,26,.55)') }
      else if (at < 0.6) { span.style.color = 'transparent'; cover.style.opacity = '1'; this.paint(cover, this.bits[b], '#74861a') }
      else { span.style.color = ''; const f = Math.max(0, 1 - (at - 0.6) / 0.4); cover.style.opacity = String(f); cover.style.display = f > 0 ? '' : 'none' }
    }
  }
}

const el = (parent: HTMLElement, cls: string, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e }
const ramp = (k: number, a: number, d: number) => smooth((k - a) / d)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** What each stop says (the site's own strings: entries.ts, story.ts). */
const STOPS: Record<string, { n: number; tag: string; eyebrow: string; title: string; sum?: string; small?: string }> = {
  'YW-000': { n: 0, tag: 'FILE YW-000 · PROFILE', eyebrow: 'Profile & education', title: 'Inside my drive: six areas' },
  'X-001': { n: 1, tag: '01 / 04 · FILE X-001', eyebrow: 'Project · AI security · 2025', title: 'MCP Security Framework', sum: 'Sandboxes any MCP server in Docker and runs 14 detectors before an AI agent is allowed near it.', small: '60+ MCP servers tested · 14 detectors' },
  'SR-01': { n: 2, tag: '02 / 04 · RECORD SR-01', eyebrow: 'Co-op · financial services · 2026', title: 'Coast Capital Savings', sum: 'Security risk assessments for internal projects and third-party vendors at a Canadian credit union.', small: '50+ risk assessments · 20+ vendor reviews' },
  'SR-02': { n: 3, tag: '03 / 04 · RECORD SR-02', eyebrow: 'Internship · startup cloud · 2025', title: 'VibesMeet LLC', sum: 'Put security checks into a startup’s CI pipeline, tightened its AWS access, and cut its monthly AWS bill by about 30%.', small: '~30% lower AWS spend · checks on every merge' },
  'X-009': { n: 4, tag: '04 / 04 · FILE X-009', eyebrow: 'Project · IoT exposure · 2026', title: 'PwnScan', sum: 'Finds every device on a network without agents, fingerprints the IoT ones, and ranks their CVEs by how likely they are to be exploited.', small: 'Top 3 in CMPT 783 · CVEs ranked by exploit risk' },
}

/** the open timeline's length: closing plays it backwards, 2.2× faster */
export const OPEN_END = 2.0, CLOSE_SPEED = 2.2
export interface ShotState {
  mode: 'stop' | 'opening' | 'open' | 'closing'
  /** seconds since the open / close cue */
  k: number
  /** the stop on screen; ready once its drive has settled */
  stop: string; ready: boolean; near: boolean
  /** the entrance: its age (Infinity once over), the file it settles on, and where that drive is on screen */
  entry: number; sel: string; anchor: { x: number; y: number } | null
  quad: { x: number; y: number }[] | null; inner: { x: number; y: number }[] | null
  dt: number
}

export function createOverlay() {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
  const root = document.createElement('div'); root.id = 'ph'; document.body.appendChild(root)
  // the cover's sheet: the thesis, and when he can start (the home's own lines)
  const sheet = el(root, 'sheet')
  const thesisA = new Line(sheet, 'thesis', 'I learned security from the network up.')
  const thesisB = new Line(sheet, 'thesis r', 'Now I assess risk at a Canadian credit union, and build tools that test AI agents.')
  const facts = new Line(sheet, 'facts', 'Master of Cybersecurity, SFU · CCNA · Security+ · Full-time from Apr 2027')
  const brand = el(root, 'brand', '<div class="a">YAOTING WANG</div><div class="b">SECURITY ANALYST</div>')
  const nav = el(root, 'nav', '<span>Index</span><span>Contact</span>')
  const marks = [0, 1, 2, 3].map(() => el(root, 'mk'))
  const rule = el(root, 'rule'), tag = el(root, 'tag'), readout = el(root, 'readout')
  const tags = Object.fromEntries(Object.entries(STOPS).map(([id, s]) => [id, new Line(tag, '', s.tag)]))
  const tagKey = new Line(tag, '', 'KEY ISSUED · X-001')

  // ── the window: the face, washed to paper, and the system drawn out of its secure element ──
  const wash = el(root, 'wash')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('dia'); svg.setAttribute('width', '390'); svg.setAttribute('height', '844'); root.appendChild(svg)
  const fbar = el(root, 'fbar', '<span>← All files</span><span style="color:var(--label)">Next →</span>')
  const dhead = el(root, 'dhead', '<span>Assessment run · packet trace</span><span style="color:var(--alert)">● Replay</span>')
  const steps = el(root, 'steps', '<span class="done">Discover</span><span class="done">Sandbox</span><span class="done">Bridge</span><span class="on">Probe</span><span>Report</span>')
  const stat = el(root, 'stat', 'PROBE <b>✗</b> read_resource returned credentials')
  const zone = el(root, 'zone', '<span>SANDBOX · ISOLATED</span>')
  const N = {
    det: el(root, 'node', 'detector<small>CE-001 · credentials</small>'),
    rep: el(root, 'node', 'report<small>awaiting findings…</small>'),
    core: el(root, 'node core', 'Safe<br>Adapter'),
    mcp: el(root, 'node', 'MCP server<small>sse → bridge</small>'),
    t1: el(root, 'node hot', 'read_resource'), t2: el(root, 'node', 'delete_range'), t3: el(root, 'node', 'generate_code'),
  }
  // node layout in the settled window (390 × 558, the secure element's centre at 214, 402)
  const BOX: Record<keyof typeof N, [number, number, number, number]> = {
    det: [22, 150, 150, 46], rep: [218, 150, 150, 46], core: [168, 378, 92, 50], mcp: [30, 474, 124, 44],
    t1: [206, 458, 152, 26], t2: [206, 490, 152, 26], t3: [206, 522, 152, 26],
  }
  // traces: orthogonal, like the board's own (they leave the secure element and end on a part)
  const P: [string, number][] = [
    ['M190 378 V300 H97 V196', 0], ['M238 378 V300 H293 V196', 0.08],
    ['M214 428 V448 H92 V474', 0.16], ['M154 496 H184 V471 H206 M184 496 V503 H206 M184 503 V535 H206', 0.26],
  ]
  const paths = P.map(([d]) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke-width', '1.3'); svg.appendChild(p); return p })
  const lens = paths.map((p) => p.getTotalLength())

  // ── the panel: one group per stop; the title sits on the same line in every one of them ──
  const panel = el(root, 'panel')
  const groups = Object.fromEntries(Object.entries(STOPS).map(([id, s]) => {
    const g = el(panel, 'grp'); if (id === 'YW-000') g.style.setProperty('--ph', '168px')
    const ey = new Line(g, 'lbl', s.eyebrow.toUpperCase()), ti = new Line(g, 'title', s.title)
    const su = s.sum ? new Line(g, 'sum', s.sum) : null, sm = s.small ? new Line(g, 'small', s.small) : null
    const row = el(g, 'row', `<span class="go">Open →</span><span class="ticks">${[0, 1, 2, 3, 4].map((i) => `<span class="${i === s.n ? 'on' : ''}">${String(i).padStart(2, '0')}</span>`).join('')}</span>`)
    return [id, { g, ey, ti, su, sm, row }]
  }))
  // the open file's own lines (X-001), in the same panel
  const fileG = el(panel, 'grp')
  const eyFile = new Line(fileG, 'lbl', 'FILE X-001 · DRAWER 02 · AI SECURITY')
  const verify = new Line(fileG, 'verify', 'AES-256-GCM · 20 BLOCKS · TAG VERIFIED')
  const nums = el(fileG, 'nums', '<div>14<small>Detectors</small></div><div>60+<small>Servers tested</small></div><div>30–90 s<small>Per target</small></div>')

  // the reader: where it stands (it springs to a new place only when the framing itself changes)
  const R = { x0: spring(0), y0: spring(0), x1: spring(0), y1: spring(0) }
  let placed = false, readoutDone = false
  // the panel rises once, with the cover; its height follows the stop (the cover says less)
  const shown = spring(0), panelH = spring(168)
  // per stop: how plain its text is (it re-encrypts when the stop is left, decrypts when its drive settles)
  const plain: Record<string, number> = Object.fromEntries(Object.keys(STOPS).map((id) => [id, 0]))

  function update(s: ShotState) {
    const { mode, k, dt } = s
    const opening = mode === 'opening' || mode === 'open', closing = mode === 'closing'
    // one timeline: opening plays it forward; closing plays it backwards, faster (re-encrypt first, then the drive)
    const tau = opening ? k : closing ? Math.max(0, OPEN_END - k * CLOSE_SPEED) : 0
    const into = (a: number, d: number) => (opening || closing ? ramp(tau, a, d) : 0)
    const q = s.quad
    // the reader's place: around the stop's drive once it has settled (the same place for every stop framed the same)
    if (q && s.near && mode === 'stop') {
      const xs = q.map((p) => p.x), ys = q.map((p) => p.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
      const hw = (Math.max(...xs) - Math.min(...xs)) / 2 * 1.1 + 12, hh = (Math.max(...ys) - Math.min(...ys)) / 2 * 1.1 + 12
      // it frames what can be seen of the drive: never under the panel or the cover's sheet
      const top = s.stop === 'YW-000' ? 300 : 76, bottom = innerHeight - (s.stop === 'YW-000' ? 168 : 252) - 14
      const to = { x0: cx - hw, y0: Math.max(top, cy - hh), x1: cx + hw, y1: Math.min(bottom, cy + hh) }
      for (const key of ['x0', 'y0', 'x1', 'y1'] as const) damp(R[key], to[key], 7, dt)
      placed = true
    }
    // the entrance's readout (ui/Hud.tsx SearchReadout, phone): a band across the frame, typed status, a hairline;
    // its four marks are the reader's: when the first stop settles they spring from the band onto the drive
    const W = innerWidth, H = innerHeight, bx = W * 0.3, by = H * 0.5, band = { x0: bx - 14, y0: by - 20, x1: bx + W * 0.62, y1: by + 20 }
    if (!placed) for (const key of ['x0', 'y0', 'x1', 'y1'] as const) R[key].value = band[key]
    const entering = !s.stop && Number.isFinite(s.entry)
    const found = s.entry >= 3.3
    const typed = (found ? 'File ' + s.sel : 'Selecting files…').slice(0, Math.max(0, Math.floor((found ? s.entry - 3.3 : s.entry - 0.1) * 26)))
    if (entering) readout.textContent = typed
    readout.style.transform = `translate(${bx}px, ${by - 7}px)`
    // it belongs to the entrance: once the reader has a drive, it is gone for good
    if (placed && (plain[s.stop] ?? 0) > 0.3) readoutDone = true
    const readK = readoutDone ? 0 : !s.stop ? (Number.isFinite(s.entry) ? Math.min(1, s.entry * 4) : 1) : Math.max(0, 1 - (plain[s.stop] ?? 0) * 3)
    readout.style.opacity = String(readK)
    const r = { x0: R.x0.value, y0: R.y0.value, x1: R.x1.value, y1: R.y1.value }
    for (const m of [tag]) m.style.visibility = placed ? 'visible' : 'hidden'
    if (s.inner) {
      const corners = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]
      // the marks lock onto the face's corners and ride them into the window's corners (the frame), and back
      const lock = opening || closing ? smooth(Math.min(1, tau / 0.16)) : 0
      const used = new Set<number>()
      corners.forEach(([x, y], i) => {
        let best = 0, bd = Infinity
        s.inner!.forEach((p, j) => { if (used.has(j)) return; const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = j } })
        used.add(best)
        const f = s.inner![best]
        marks[i].style.transform = `translate(${lerp(x, f.x, lock)}px, ${lerp(y, f.y, lock)}px)`
      })
      tag.style.transform = `translate(${r.x0 + 10}px, ${r.y1 - 30}px)`
      // the hairline: from under the readout during the entrance, from the tag's end at a stop
      const rx = placed ? r.x0 + 10 + tag.offsetWidth : bx + 40, ry = placed ? r.y1 - 20 : band.y1 + 4
      rule.style.transform = `translate(${rx}px, ${ry}px)`
    }

    // ── stops: the leaving stop's text re-encrypts at once; the arriving one decrypts as its drive settles ──
    for (const id of Object.keys(STOPS)) {
      const target = id === s.stop && s.near ? 1 : 0
      const rate = target ? 1 / 0.5 : 1 / 0.18
      plain[id] = target > plain[id] ? Math.min(target, plain[id] + rate * dt) : Math.max(target, plain[id] - rate * dt)
    }
    const out = into(0, 0.22)
    damp(shown, s.stop && s.near ? 1 : 0, 6, dt); damp(panelH, s.stop === 'YW-000' ? 168 : 252, 6, dt)
    panel.style.transform = `translateY(${H - panelH.value * shown.value}px)`
    for (const [id, g] of Object.entries(groups)) {
      const p = plain[id], vis = p > 0.001 ? 1 : 0
      g.g.style.visibility = vis ? 'visible' : 'hidden'
      tags[id].set(p * (1 - into(0, 0.18)), vis)
      g.ey.set(p * (1 - into(0.0, 0.2)), 1 - into(0.25, 0.1))
      g.ti.set(p)
      g.su?.set(p); if (g.su) g.su.el.style.transform = `translateY(${22 * into(1.0, 0.3)}px)`
      g.sm?.set(p * (1 - into(0.0, 0.22)), 1 - into(0.3, 0.12))
      g.row.style.opacity = String(Math.min(1, p * 1.5) * (1 - out))
    }
    tagKey.set(into(0.06, 0.2), into(0.06, 0.01) * (1 - into(0.62, 0.25)))
    // the tag's paper shows only while a tag is readable (no empty box in transit)
    const tagP = Math.max(0, ...Object.values(plain))
    tag.style.opacity = String((1 - into(0.55, 0.3)) * Math.min(1, tagP * 2.5))
    // the cover's sheet stays only on the cover: it seals and folds up into the name bar when the first file is asked for
    const cov = plain['YW-000']
    thesisA.set(cov, smooth(Math.min(1, cov * 3))); thesisB.set(cov, smooth(Math.min(1, cov * 3))); facts.set(cov, smooth(Math.min(1, cov * 3)))
    sheet.style.height = `${lerp(64, 262, smooth(Math.min(1, cov * 1.6))) * shown.value}px`
    brand.style.opacity = nav.style.opacity = String(1 - into(0.02, 0.3))
    rule.style.opacity = String(0.5 * (1 - out) * (s.stop || Number.isFinite(s.entry) ? 1 : 0))

    // ── the window (the settled face's bounding box) ──
    const washK = into(1.12, 0.42)
    Object.assign(wash.style, { width: '390px', height: '558px', opacity: String(0.84 * washK) })
    paths.forEach((p, i) => {
      const kk = into(1.28 + P[i][1], 0.42); p.setAttribute('stroke', kk < 1 ? '#c9a35a' : '#16171a')
      p.setAttribute('stroke-dasharray', String(lens[i])); p.setAttribute('stroke-dashoffset', String(lens[i] * (1 - kk)))
      p.setAttribute('stroke-opacity', String(kk > 0 ? 0.55 + 0.35 * kk : 0))
    })
    const nodeAt: Record<keyof typeof N, number> = { core: 1.22, det: 1.52, rep: 1.58, mcp: 1.62, t1: 1.74, t2: 1.78, t3: 1.82 }
    for (const key of Object.keys(N) as (keyof typeof N)[]) {
      const [x, y, w, h] = BOX[key], n = N[key], kk = into(nodeAt[key], 0.22)
      Object.assign(n.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, opacity: String(kk), transform: `scale(${0.94 + 0.06 * kk})` })
    }
    Object.assign(zone.style, { left: '16px', top: '446px', width: '358px', height: '108px', opacity: String(into(1.68, 0.25)) })
    dhead.style.top = '64px'; steps.style.top = '90px'; stat.style.top = '116px'
    dhead.style.opacity = String(into(1.45, 0.3)); steps.style.opacity = String(into(1.55, 0.3)); stat.style.opacity = String(into(1.9, 0.25))
    fbar.style.opacity = String(into(1.4, 0.3))
    eyFile.set(into(0.95, 0.3), into(0.9, 0.05)); verify.set(into(1.15, 0.4), into(1.1, 0.06))
    nums.style.opacity = String(into(1.35, 0.35))
  }
  return { update }
}
