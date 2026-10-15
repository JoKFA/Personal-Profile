// The profile body under the interior decrypts the way a file's body does (file/fileview.ts): its text is sealed under the session key, shown as
// ciphertext bits per 16-character block, and each group resolves into its letters when it first comes into view.
import { Line } from '../../cipherLine'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
interface Group { lines: Line[]; started: boolean; el: HTMLElement }

export class BodyDecrypt {
  lines: Line[] = []
  private groups: Group[] = []
  private io: IntersectionObserver | null = null
  private active: { g: Group; t0: number }[] = []
  private raf = 0
  private dead = false
  private root: HTMLElement
  private reduced: boolean
  constructor(root: HTMLElement, reduced: boolean) { this.root = root; this.reduced = reduced }

  /** the leaf text elements (data-redact) become lines; unmounting the React tree afterwards is safe, nothing else changes them */
  async seal() {
    const els = [...this.root.querySelectorAll<HTMLElement>('[data-redact]')].filter((x) => x.children.length === 0 && x.textContent)
    this.lines = els.map((x) => Line.adopt(x))
    const unit = (el: HTMLElement) => el.closest<HTMLElement>('.file-tab--stacked, .file-act') ?? el
    const by = new Map<HTMLElement, Line[]>()
    els.forEach((x, i) => { const k = unit(x); const a = by.get(k) ?? []; a.push(this.lines[i]); by.set(k, a) })
    this.groups = [...by.entries()].map(([el, lines]) => ({ el, lines, started: false }))
    await Promise.all(this.lines.map((l) => l.ready))
    for (const l of this.lines) l.set(this.reduced ? 1 : 0, 1)
    if (!this.reduced) this.observe()
  }

  private observe() {
    this.io = new IntersectionObserver((list) => {
      for (const it of list) {
        if (!it.isIntersecting) continue
        const g = this.groups.find((x) => x.el === it.target)
        if (!g || g.started) continue
        g.started = true; this.io?.unobserve(it.target)
        this.active.push({ g, t0: performance.now() }); this.run()
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 })
    for (const g of this.groups) this.io.observe(g.el)
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
      if (keep.length && !this.dead) this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  dispose() { this.dead = true; cancelAnimationFrame(this.raf); this.io?.disconnect() }
}
