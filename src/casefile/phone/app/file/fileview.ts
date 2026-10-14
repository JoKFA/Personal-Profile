// The phone's file page (plan P3b). One FileView per opened entry. It owns a block that sits over the stage and scrolls with the DOCUMENT
// (so Safari's toolbar can minimise while a long file is read; the shell hides the reel and puts the page at the top while a file is open):
//   [the window: the drive's face, washed to line art, with the demo grown from the secure element]
//   [the panel: the stop's own panel, moved here, continuing into]
//   [the body: FileBody, stacked, on paper].
// While the open clip plays the view is driven by the open timeline (tau, the page layer's clock); once it has settled the window is a plain
// <img> of the window still inside that block, so the face scrolls away natively with the page (the fixed stage is then hidden).
// Everything animated is a function of tau or of the app clock; no CSS transition drives anything that must stay in step with the picture.
import { smooth } from '../../../motion/waves'
import type { Entry } from '../../../data/types'
import { Line, blocksOf, canSeal, seal } from '../../cipherLine'
import type { OpenShot } from '../../manifest'
import type { Fit } from '../fit'
import { COPY } from '../copy'
import type { PageDom, Panel } from '../page'
import type { Stage } from '../stage/stage'
import type { Bridge } from './FileParts'
import type { Mounted } from './mount'

const ramp = (k: number, a: number, d: number) => smooth((k - a) / d)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** the open timeline's beats (s), from the prototype (overlay.ts): the paper wash, the key's trace, the demo */
export const BEAT = { panel: [1.0, 0.5], wash: [1.12, 0.42], trace: [1.28, 0.42], traceOut: [1.72, 0.2], demoMount: 1.55, demo: [1.72, 0.25] } as const
/** the wash over the face: the board reads as line art */
export const WASH = 0.84

export interface FileEnv {
  dom: PageDom
  stage: Stage
  entry: Entry
  panel: Panel
  shot: OpenShot
  /** the picture's url for a manifest file */
  url(file: string): string
  winFit: Fit
  view: { w: number; h: number }
  /** the panel's height at the stop and as the file's head */
  heights: { stop: number; file: number }
  bridge: Bridge
  mod: typeof import('./mount')
}

/** the lines of the body that decrypt, in groups that start when the group first comes into view */
interface Group { lines: Line[]; started: boolean; el: HTMLElement }

export class FileView {
  readonly id: string
  readonly scroller: HTMLElement
  private zone: HTMLElement
  private img: HTMLImageElement
  private wash: HTMLElement
  private svg: SVGSVGElement
  private path: SVGPathElement
  private demoBox: HTMLElement
  private status: HTMLElement
  private bodyEl: HTMLElement
  private body: Mounted | null = null
  private demo: Mounted | null = null
  private env: FileEnv
  private groups: Group[] = []
  private io: IntersectionObserver | null = null
  private bodyLines: Line[] = []
  private pathLen = 1
  private coreRel = { x: 0.5, y: 0.5 }
  private Wz = 0
  private faceH = 0
  /** how tall the demo has been (it only ever makes the window taller, never shorter: no page jumping back) */
  private demoNeed = 0
  private ro: ResizeObserver | null = null
  private statusTimer: ReturnType<typeof setTimeout> | undefined
  private raf = 0
  private active: { g: Group; t0: number }[] = []
  private settled = false
  private shown = false
  private disposed = false
  private labelOn = 0
  readonly hasWash: boolean
  readonly hasDemo: boolean
  /** blocks decrypted in this file view: the panel's and the body's */
  blocks = 0
  ok = false
  verify: Line | null = null
  /** the demo's trace and decrypt-in have reached the end (for tests) */
  demoReady = false

  private constructor(env: FileEnv) {
    this.env = env; this.id = env.entry.id
    const e = env.entry
    // the restricted file is a black drive: no paper over it; its game lives below the window, on paper
    this.hasWash = e.kind !== 'restricted'
    this.hasDemo = !!e.demo && e.kind !== 'restricted'
    const d = (cls: string, parent: HTMLElement) => { const x = document.createElement('div'); x.className = cls; parent.appendChild(x); return x }
    this.scroller = document.createElement('div'); this.scroller.className = 'ph-file'; this.scroller.setAttribute('data-entry', e.id)
    this.zone = d('ph-fwin', this.scroller)
    this.img = document.createElement('img'); this.img.className = 'ph-fwin-img'; this.img.alt = ''; this.img.draggable = false; this.zone.appendChild(this.img)
    this.wash = d('ph-fwash', this.zone)
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.svg.setAttribute('class', 'ph-ftrace'); this.svg.setAttribute('aria-hidden', 'true'); this.zone.appendChild(this.svg)
    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); this.path.setAttribute('fill', 'none'); this.path.setAttribute('stroke-width', '1.3'); this.svg.appendChild(this.path)
    this.demoBox = d('ph-fdemo', this.zone)
    this.status = d('ph-fstatus', this.zone); this.status.setAttribute('role', 'status')
    this.bodyEl = d('ph-fbody', this.scroller)
    this.bodyEl.classList.toggle('ph-fb--dupsum', e.kind !== 'subject')
    this.bodyEl.classList.toggle('ph-fb--dupnums', (e.numbers?.length ?? 0) <= 3)
  }

  /** Build a file view: the body is mounted and its text sealed, the demo's core is measured. Nothing is visible yet. */
  static async create(env: FileEnv): Promise<FileView> {
    const v = new FileView(env)
    env.dom.root.appendChild(v.scroller)
    v.layout()
    v.body = env.mod.mountBody(v.bodyEl, env.entry, env.bridge)
    await v.sealBody()
    v.measureCore()
    return v
  }

  /** the screen changed (rotation, the toolbar): the window and the demo's box are laid out again */
  relayout(view: { w: number; h: number }, winFit: Fit, heights: { stop: number; file: number }) {
    const sameWidth = Math.abs(view.w - this.env.view.w) < 1
    this.env.view = view; this.env.winFit = winFit; this.env.heights = heights
    if (this.settled && sameWidth) return   // Safari's toolbar sliding in or out changes only the height: the page being read stays as it is
    this.demoNeed = 0   // the demo's own height is read again at the new width (the observer fires when its size changes)
    this.layout()
    if (this.shown) this.fitHead()
  }

  // ── geometry: the window zone, the demo's box ──
  layout() {
    const { w, h } = this.env.view, s = this.env.winFit.s, f = this.env.shot.face, H1 = this.env.heights.file
    const barH = Math.max(this.env.dom.bar.offsetHeight, 64)
    this.faceH = Math.min(f.y1, this.env.stage.el.offsetHeight) * s
    const top0 = barH + 6
    const zoneH = Math.max(this.faceH, this.demoNeed ? top0 + this.demoNeed + 14 : 0)
    this.Wz = Math.max(zoneH, h - H1)
    const st = this.scroller.style
    st.setProperty('--ph-wz', `${this.Wz}px`)
    this.zone.style.height = `${this.Wz}px`
    this.img.style.width = `${w}px`; this.img.style.height = `${this.env.stage.el.offsetHeight * s}px`
    Object.assign(this.wash.style, { height: `${zoneH}px` })
    const top = barH + 6, dh = Math.max(200, this.faceH - top - 12)
    Object.assign(this.demoBox.style, { left: '12px', top: `${top}px`, width: `${w - 24}px`, minHeight: `${dh}px` })
    this.demoBox.style.setProperty('--ph-demo-h', `${dh}px`)
    this.svg.setAttribute('width', String(w)); this.svg.setAttribute('height', String(this.Wz))
    this.drawPath()
  }

  /** the key's trace: from the die, orthogonal, to the centre of the demo's core element */
  private drawPath() {
    const { w } = this.env.view, s = this.env.winFit.s, die = this.env.shot.die
    const dx = die.x * s, dy = die.y * s
    const box = { x: 12, y: parseFloat(this.demoBox.style.top) || 70, w: w - 24, h: Math.max(parseFloat(this.demoBox.style.minHeight) || 400, this.demoNeed) }
    const cx = box.x + this.coreRel.x * box.w, cy = box.y + this.coreRel.y * box.h
    const my = (dy + cy) / 2
    const d = Math.abs(cx - dx) < 2 ? `M${dx} ${dy} V${cy}` : Math.abs(cy - dy) < 2 ? `M${dx} ${dy} H${cx}` : `M${dx} ${dy} V${my} H${cx} V${cy}`
    this.path.setAttribute('d', d)
    this.pathLen = Math.max(1, this.path.getTotalLength())
    this.path.setAttribute('stroke-dasharray', String(this.pathLen))
  }

  /** mount the demo once, hidden, to find where its core element sits (as a share of the demo's box), then take it away again */
  private measureCore() {
    if (!this.hasDemo) return
    this.demoBox.style.visibility = 'hidden'
    const m = this.env.mod.mountDemo(this.demoBox, this.env.entry, this.env.bridge)
    const core = this.demoBox.querySelector<HTMLElement | SVGElement>('[data-core]'), bx = this.demoBox.getBoundingClientRect()
    { const h = Math.ceil((this.demoBox.firstElementChild as HTMLElement | null)?.getBoundingClientRect().height ?? 0); if (h > (parseFloat(this.demoBox.style.minHeight) || 0) + 1) this.demoNeed = Math.max(this.demoNeed, h) }
    if (core && bx.width) { const r = core.getBoundingClientRect(); this.coreRel = { x: clamp((r.left + r.width / 2 - bx.left) / bx.width, 0, 1), y: clamp((r.top + r.height / 2 - bx.top) / bx.height, 0, 1) } }
    m.unmount(); this.demoBox.style.visibility = ''
    this.layout()
  }

  /** the body's lines are made into decrypting lines, sealed under the session key; the verify line is made from what was sealed */
  private async sealBody() {
    const { entry: e, panel, dom } = this.env
    const els = [...this.bodyEl.querySelectorAll<HTMLElement>('[data-redact]')].filter((x) => x.children.length === 0 && x.textContent && getComputedStyle(x).display !== 'none' && !(x.closest('.ph-fb--dupsum') && x.classList.contains('file-sum')))
    this.bodyLines = els.map((x) => Line.adopt(x))
    const unit = (el: HTMLElement) => el.closest<HTMLElement>('.file-tab--stacked, .file-act') ?? el
    const byEl = new Map<HTMLElement, Line[]>()
    els.forEach((x, i) => { const k = unit(x); (byEl.get(k) ?? byEl.set(k, []).get(k)!).push(this.bodyLines[i]) })
    this.groups = [...byEl.entries()].map(([el, lines]) => ({ el, lines, started: false }))
    // the panel's own lines, as before; the verify line counts the panel and the body together
    const payload = [COPY.fileEyebrow(e.id), e.org ?? e.title, e.summary, ...(e.numbers ?? []).slice(0, 3).flat()]
    const all = [...payload, ...this.bodyLines.map((l) => l.text)]
    this.blocks = blocksOf(all.map((t) => t.length))
    if (canSeal()) {
      try { this.ok = await (await seal(all.join('\n'))).verify() } catch { this.ok = false }
    }
    const f = panel.file!
    f.blocks = this.blocks; f.ok = this.ok
    if (canSeal()) {
      if (f.verify) { f.verify.el.remove(); dom.lines.splice(dom.lines.indexOf(f.verify), 1) }
      f.verify = new Line(panel.el, 'ph-verify', COPY.verify(this.blocks, this.ok), 'p'); dom.lines.push(f.verify)
      await f.verify.ready
    }
    await Promise.all(this.bodyLines.map((l) => l.ready))
    for (const l of this.bodyLines) l.set(0, 1)
  }

  /** a title that wraps pushes the verify line (and the summary, in the page layer) down by what it adds */
  private fitHead() {
    const { panel } = this.env, ti = panel.ti.el
    const one = parseFloat(getComputedStyle(ti).lineHeight) || ti.offsetHeight
    panel.extra = Math.max(0, Math.round(ti.offsetHeight - one))
    if (panel.file?.verify) panel.file.verify.el.style.top = `${79 + panel.extra}px`
    panel.el.style.setProperty('--ph-numgap', `${34 + panel.extra}px`)
    // a long file eyebrow (FILE YW-000 · DRAWER 01 · PROFILE & EDUCATION) must stay on one line: on a narrow screen its tracking tightens
    const ey = panel.file?.ey.el
    if (ey) { ey.style.letterSpacing = ''; if (ey.offsetHeight > 20) ey.style.letterSpacing = '.02em' }
  }

  // ── the open ──
  /** the opening begins: the panel is moved into the scroller (it stays where the stop had it), the window layers wait for their beats */
  show() {
    if (this.shown) return
    this.shown = true
    const { dom, panel } = this.env
    this.layout()
    this.scroller.insertBefore(panel.el, this.bodyEl)
    panel.el.classList.add('ph-infile')
    this.fitHead()
    const lab = dom.fileLabel; lab.textContent = ''
    const id = document.createElement('b'); id.textContent = this.env.entry.id
    const tt = document.createElement('span'); tt.textContent = this.env.entry.kind === 'service' ? (this.env.entry.org ?? this.env.entry.title) : this.env.entry.title
    lab.append(id, tt)
    this.img.src = this.env.url(this.env.shot.window.file)
    void this.img.decode().catch(() => undefined)
    this.scroller.classList.add('on', 'opening')
    this.update(0, 'opening')
  }

  /** the face is a picture inside the scroller from now on; the fixed stage steps aside and the page can scroll */
  settle() {
    if (this.settled) return
    this.settled = true
    const { dom, stage } = this.env
    this.img.classList.add('on')
    stage.box.style.visibility = 'hidden'
    // the reticle's four marks are the window's frame: they scroll with it
    for (const m of dom.marks) this.zone.appendChild(m)
    this.scroller.classList.remove('opening')
    addEventListener('scroll', this.onScroll, { passive: true })
    this.observe()
    this.onScroll()
  }

  /** closing starts: back to the top, the stage under the face again, the marks back on the reticle */
  async beginClose(reduced: boolean) {
    if (!this.settled) return
    this.settled = false
    removeEventListener('scroll', this.onScroll)
    this.io?.disconnect()
    const { dom, stage } = this.env
    if (scrollY > 1) await this.scrollTop(reduced ? 0 : 240)
    stage.box.style.visibility = ''
    this.img.classList.remove('on')
    const first = dom.reticle.firstChild
    for (const m of dom.marks) dom.reticle.insertBefore(m, first)
    this.scroller.classList.add('opening')
    this.setLabel(0)
  }

  private scrollTop(ms: number) {
    return new Promise<void>((res) => {
      const y0 = scrollY, t0 = performance.now()
      if (ms <= 0) { scrollTo(0, 0); res(); return }
      const f = (now: number) => { const k = Math.min(1, (now - t0) / ms); scrollTo(0, y0 * (1 - smooth(k))); if (k < 1) requestAnimationFrame(f); else res() }
      requestAnimationFrame(f)
    })
  }

  // ── the timeline: everything here is a function of tau (the open clip's own time, forward or counted back) ──
  update(tau: number, phase: string) {
    if (this.disposed) return
    const into = (b: readonly [number, number]) => ramp(tau, b[0], b[1])
    const { panel, heights, view } = this.env
    // the panel: from where the stop had it to where the window ends
    const e = settled(phase) ? 1 : into(BEAT.panel)
    const topStop = view.h - heights.stop, top = lerp(topStop, this.Wz, e)
    panel.el.style.transform = e >= 1 ? '' : `translateY(${top - this.Wz}px)`
    panel.el.style.minHeight = `${lerp(heights.stop, heights.file, e)}px`
    // once the stop's own lines (the small line, the Open row) have faded, the head is the file's: the numbers join the flow below the summary
    panel.el.classList.toggle('ph-headfile', settled(phase) || tau >= 0.5)
    // the paper wash over the face (not on the black drive)
    const wk = this.hasWash ? (settled(phase) ? 1 : into(BEAT.wash)) : 0
    this.wash.style.opacity = String(WASH * wk)
    // the key's trace, and the demo
    if (this.hasDemo) {
      const tk = settled(phase) ? 1 : into(BEAT.trace), out = settled(phase) ? 1 : into(BEAT.traceOut)
      this.path.setAttribute('stroke', '#c9a35a')
      this.path.setAttribute('stroke-dashoffset', String(this.pathLen * (1 - tk)))
      this.path.setAttribute('stroke-opacity', String(tk > 0 ? 0.9 * (1 - out) : 0))
      const dk = settled(phase) ? 1 : into(BEAT.demo)
      if (tau >= BEAT.demoMount && !this.demo && !this.disposed) this.mountDemo()
      if (tau < BEAT.demoMount - 0.05 && this.demo && phase === 'closing') this.unmountDemo()
      this.demoBox.style.opacity = String(dk)
      this.demoReady = dk >= 1
    }
    // the file's own sticky label is not here (it follows the scroll)
  }

  private mountDemo() {
    this.demo = this.env.mod.mountDemo(this.demoBox, this.env.entry, this.env.bridge)
    const first = this.demoBox.firstElementChild
    if (first && typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(() => { const h = Math.ceil(first.getBoundingClientRect().height), min = parseFloat(this.demoBox.style.minHeight) || 0; if (h > min + 1 && h > this.demoNeed + 1) { this.demoNeed = h; this.layout() } })
      this.ro.observe(first)
    }
  }
  private unmountDemo() { this.ro?.disconnect(); this.ro = null; this.demo?.unmount(); this.demo = null; this.demoReady = false }

  // ── the scroll: the sticky label, and the text that decrypts as it first comes into view ──
  private onScroll = () => {
    const y = scrollY, bar = this.env.dom.bar.offsetHeight
    this.setLabel(clamp((y - (this.Wz - bar - 36)) / 36, 0, 1))
  }
  private setLabel(k: number) {
    if (k === this.labelOn) return
    this.labelOn = k
    this.env.dom.fileLabel.style.opacity = String(k)
    this.env.dom.fileLabel.style.visibility = k < 0.02 ? 'hidden' : 'visible'
  }

  private observe() {
    if (this.io) this.io.disconnect()
    const reduced = this.env.bridge.reduced
    this.io = new IntersectionObserver((list) => {
      for (const it of list) {
        if (!it.isIntersecting) continue
        const g = this.groups.find((x) => x.el === it.target); if (!g || g.started) continue
        g.started = true; this.io?.unobserve(it.target)
        if (reduced) { for (const l of g.lines) l.set(1); continue }
        this.active.push({ g, t0: performance.now() }); this.run()
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 })
    for (const g of this.groups) if (!g.started) this.io.observe(g.el)
  }

  private run() {
    if (this.raf) return
    const step = (now: number) => {
      this.raf = 0
      const keep: typeof this.active = []
      for (const a of this.active) {
        const n = a.g.lines.length, gap = Math.min(0.07, 0.5 / Math.max(1, n)), dur = 0.55
        let done = true
        a.g.lines.forEach((l, i) => { const p = clamp(((now - a.t0) / 1000 - i * gap) / dur, 0, 1); l.set(p); if (p < 1) done = false })
        if (!done) keep.push(a)
      }
      this.active = keep
      if (keep.length && !this.disposed) this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  /** the "decrypted so far" count (for tests): lines whose first block is plain */
  decryptedLines() { return this.groups.filter((g) => g.started).reduce((n, g) => n + g.lines.length, 0) }

  /** a machine status under the window (the demos' `status`): HTML from the demo's own strings, cleared after `ms` */
  say(html: string, ms = 4000) {
    this.status.innerHTML = html; this.status.classList.add('on')
    clearTimeout(this.statusTimer); this.statusTimer = setTimeout(() => { this.status.classList.remove('on') }, ms)
  }

  focusHeading() {
    const h = this.env.panel.ti.el; h.tabIndex = -1; h.focus({ preventScroll: true })
  }

  /** give the panel back to its section and take everything down */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf); clearTimeout(this.statusTimer)
    this.io?.disconnect()
    removeEventListener('scroll', this.onScroll)
    const { dom, panel, stage } = this.env
    if (this.shown) {
      panel.el.classList.remove('ph-infile', 'ph-headfile'); panel.el.style.transform = ''; panel.el.style.minHeight = ''
      panel.section.appendChild(panel.el)
      const first = dom.reticle.firstChild
      for (const m of dom.marks) if (m.parentElement !== dom.reticle) dom.reticle.insertBefore(m, first)
      stage.box.style.visibility = ''
    }
    this.setLabel(0); if (this.shown) this.env.dom.fileLabel.textContent = ''
    this.unmountDemo()
    this.body?.unmount(); this.body = null
    this.img.removeAttribute('src')
    this.scroller.remove()
  }
}

const settled = (phase: string) => phase === 'file'
