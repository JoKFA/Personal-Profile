// The phone's page layer: the DOM (a normal document of sections over the fixed stage) and the animation of its text.
// Everything that moves is driven from a clock in JS (the media clock while a clip plays, the app clock otherwise), never CSS transitions.
// The look is the approved prototype (phone/overlay.ts): reticle marks, tag, hairline, the cover's sheet, a panel per stop that
// decrypts when its drive settles and seals again when it leaves; the open file re-keys the same panel.
import { entryById } from '../../data/entries'
import { smooth } from '../../motion/waves'
import { Line, blocksOf, canSeal, seal } from '../cipherLine'
import { COPY, type StopCopy } from './copy'
import type { Rect } from '../manifest'

/** the open timeline's length (s): closing plays it backwards, 2.2x faster (overlay.ts) */
export const OPEN_END = 2.0, CLOSE_SPEED = 2.2
export type Phase = 'settled' | 'panning' | 'opening' | 'file' | 'closing'

const el = <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent.appendChild(e); return e
}
const ramp = (k: number, a: number, d: number) => smooth((k - a) / d)
export interface Pt { x: number; y: number }

export interface FileParts { ey: Line; verify: Line | null; nums: HTMLElement; blocks: number; ok: boolean }
export interface Panel {
  id: string; section: HTMLElement; el: HTMLElement
  ey: Line; ti: Line; su: Line | null; sm: Line | null
  row: HTMLElement; open: HTMLButtonElement | null; ticks: HTMLButtonElement[]
  file: FileParts | null
}

export interface PageDom {
  root: HTMLElement
  bar: HTMLElement; brand: HTMLElement; nav: HTMLElement; back: HTMLButtonElement; indexBtn: HTMLButtonElement; contactBtn: HTMLButtonElement
  main: HTMLElement
  sections: HTMLElement[]
  sheet: HTMLElement
  panels: Map<string, Panel>
  reticle: HTMLElement; marks: HTMLElement[]; tag: HTMLElement; rule: HTMLElement
  land: HTMLElement
  lines: Line[]
  /** the cover sheet's three lines */
  sheetLines: Line[]
}

/** Build the whole page. `canOpen(id)`: does this stop have an open clip (otherwise its Open button is hidden). */
export function buildPage(host: HTMLElement, stops: StopCopy[], canOpen: (id: string) => boolean): PageDom {
  const root = el(host, 'div', 'ph-root')
  const lines: Line[] = []
  const line = (parent: HTMLElement, cls: string, text: string, tag: keyof HTMLElementTagNameMap = 'div') => { const l = new Line(parent, cls, text, tag); lines.push(l); return l }

  // fixed layers: the stage is added by the stage itself (first child), then the reticle
  const reticle = el(root, 'div', 'ph-reticle'); reticle.setAttribute('aria-hidden', 'true')
  const marks = [0, 1, 2, 3].map(() => el(reticle, 'i', 'ph-mk'))
  const rule = el(reticle, 'i', 'ph-rule'), tag = el(reticle, 'div', 'ph-tag')

  // the top bar: the name, Index, Contact; while a file is open it holds "← All files"
  const bar = el(root, 'header', 'ph-bar')
  const brand = el(bar, 'h1', 'ph-brand'); el(brand, 'span', 'ph-a', COPY.brand); el(brand, 'span', 'ph-b', COPY.role)
  const nav = el(bar, 'nav', 'ph-nav'); nav.setAttribute('aria-label', 'Sections')
  const indexBtn = el(nav, 'button', 'ph-navb', COPY.index); indexBtn.type = 'button'; indexBtn.dataset.go = 'index'
  const contactBtn = el(nav, 'button', 'ph-navb', COPY.contact); contactBtn.type = 'button'; contactBtn.dataset.go = 'contact'
  const back = el(bar, 'button', 'ph-back', COPY.back); back.type = 'button'


  // the reel: a normal document, each section about a screen tall, snapping
  const main = el(root, 'main', 'ph-reel')
  const sections: HTMLElement[] = []
  const panels = new Map<string, Panel>()
  let sheet!: HTMLElement
  const sheetLines: Line[] = []
  stops.forEach((s, i) => {
    const sec = el(main, 'section', 'ph-sec' + (i === 0 ? ' ph-cover' : '')); sec.id = `ph-s${i}`; sections.push(sec)
    if (i === 0) {
      sheet = el(sec, 'div', 'ph-sheet')
      sheetLines.push(line(sheet, 'ph-thesis', COPY.thesisLead, 'p'), line(sheet, 'ph-thesis ph-r', COPY.thesisRest, 'p'), line(sheet, 'ph-facts', COPY.availability, 'p'))
    }
    const p = el(sec, 'div', 'ph-panel' + (i === 0 ? ' ph-pc' : ' ph-ps'))
    const ey = line(p, 'ph-lbl', s.eyebrow, 'p'), ti = line(p, 'ph-title', s.title, 'h2')
    ti.el.id = `ph-t${i}`; sec.setAttribute('aria-labelledby', ti.el.id)
    const su = s.sum ? line(p, 'ph-sum', s.sum, 'p') : null, sm = s.small ? line(p, 'ph-small', s.small, 'p') : null
    const row = el(p, 'div', 'ph-row')
    const open = i > 0 && canOpen(s.id) ? el(row, 'button', 'ph-go', COPY.open) : null
    if (open) { open.type = 'button'; open.setAttribute('aria-label', `Open ${s.title}`); open.dataset.id = s.id }
    const tk = el(row, 'span', 'ph-ticks')
    // the five ticks repeat in every file panel (they are the prototype's; the cover's one-line panel has none); assistive tech and the Tab key get one group, the first stop's
    if (i === 1) { tk.setAttribute('role', 'group'); tk.setAttribute('aria-label', 'Jump to a stop') } else tk.setAttribute('aria-hidden', 'true')
    const ticks = [0, 1, 2, 3, 4].map((n) => {
      const b = el(tk, 'button', 'ph-tick' + (n === s.n ? ' on' : ''), String(n).padStart(2, '0')); b.type = 'button'; b.dataset.stop = String(n)
      if (i !== 1) b.tabIndex = -1
      b.setAttribute('aria-label', n === 0 ? 'Go to the profile' : `Go to stop ${n}`); if (n === s.n) b.setAttribute('aria-current', 'true')
      return b
    })
    panels.set(s.id, { id: s.id, section: sec, el: p, ey, ti, su, sm, row, open, ticks, file: null })
  })
  // Index and Contact: a placeholder section (P5 fills it)
  const idx = el(main, 'section', 'ph-sec ph-index'); idx.id = `ph-s${stops.length}`; sections.push(idx)
  const hi = el(idx, 'h2', 'ph-h', COPY.index); hi.id = `ph-t${stops.length}`; idx.setAttribute('aria-labelledby', hi.id)
  el(idx, 'h2', 'ph-h', COPY.contact)

  const land = el(root, 'div', 'ph-land'); land.setAttribute('role', 'status'); el(land, 'p', '', COPY.landscape)
  return { root, bar, brand, nav, back, indexBtn, contactBtn, main, sections, sheet, panels, reticle, marks, tag, rule, land, lines, sheetLines }
}

/** The file's own lines for a stop (built once, when it is first asked for): the file eyebrow, the verify line, the numbers. */
export async function prepareFile(dom: PageDom, id: string): Promise<FileParts | null> {
  const panel = dom.panels.get(id); if (!panel) return null
  if (panel.file) return panel.file
  const e = entryById.get(id); if (!e) return null
  const nums = el(panel.el, 'div', 'ph-nums')
  for (const [v, l] of (e.numbers ?? []).slice(0, 3)) { const d = el(nums, 'div', '', v); el(d, 'small', '', l) }
  const eyText = COPY.fileEyebrow(id)
  const ey = new Line(panel.el, 'ph-lbl ph-fileey', eyText, 'p'); dom.lines.push(ey)
  // what is sealed and checked on this open: the file's eyebrow, title, summary and its numbers (the long body joins it in P3)
  const payload = [eyText, e.org ?? e.title, e.summary, ...(e.numbers ?? []).slice(0, 3).flat()]
  const blocks = blocksOf(payload.map((t) => t.length))
  let ok = false, verify: Line | null = null
  if (canSeal()) {
    try { ok = await (await seal(payload.join('\n'))).verify() } catch { ok = false }
    verify = new Line(panel.el, 'ph-verify', COPY.verify(blocks, ok), 'p'); dom.lines.push(verify)
  }
  await Promise.all([ey.ready, verify?.ready])
  panel.file = { ey, verify, nums, blocks, ok }
  return panel.file
}

export interface PageFrame {
  phase: Phase
  /** the stop on screen (its drive settled, or the one being left/arrived at while panning) */
  stop: string
  /** is the stop's drive at rest (true) or is a pan running */
  settled: boolean
  /** open timeline time (s): forward while opening, counted back while closing */
  tau: number
  dt: number
  /** 0..1: the paper rises at a return visit */
  rise: number
}

/** The text's animation; owns the springs. update() returns true while anything is still moving. */
export class PageLayer {
  private plain: Record<string, number> = {}
  private tags = new Map<string, Line>()
  private tagKey: Line
  private placed = false
  private lastKey = ''
  private dom: PageDom
  private ids: string[]
  private keyId = ''

  constructor(dom: PageDom, stops: StopCopy[]) {
    this.dom = dom
    this.ids = stops.map((s) => s.id)
    for (const s of stops) { this.plain[s.id] = 0; const l = new Line(dom.tag, '', s.tag); dom.lines.push(l); this.tags.set(s.id, l) }
    this.tagKey = new Line(dom.tag, '', COPY.keyIssued('X-001')); dom.lines.push(this.tagKey)
  }

  /** the tag line "KEY ISSUED · id" is built once per id (rebuilt when the opened stop changes) */
  private setKey(id: string) {
    if (this.keyId === id) return
    this.keyId = id
    this.tagKey.el.remove(); this.dom.lines.splice(this.dom.lines.indexOf(this.tagKey), 1)
    this.tagKey = new Line(this.dom.tag, '', COPY.keyIssued(id)); this.dom.lines.push(this.tagKey)
  }

  /** is a stop's text fully readable (used by tests) */
  plainOf(id: string) { return this.plain[id] ?? 0 }
  /** make a stop readable at once (a cold open: its panel is already there when the page appears) */
  setPlain(id: string, v: number) { this.plain[id] = v }

  /** the four marks follow `corners` (screen px); the tag and hairline sit at the reticle rect's lower left */
  placeMarks(corners: Pt[], anchor: Rect, opacity: number) {
    const d = this.dom
    corners.forEach((c, i) => { d.marks[i].style.transform = `translate(${c.x}px, ${c.y}px)` })
    d.tag.style.transform = `translate(${anchor.x0 + 10}px, ${anchor.y1 - 30}px)`
    d.rule.style.transform = `translate(${anchor.x0 + 10 + 190}px, ${anchor.y1 - 20}px)`
    d.reticle.style.opacity = String(opacity)
    this.placed = true
  }

  update(f: PageFrame): boolean {
    const d = this.dom
    const { phase, tau, dt } = f
    const opening = phase === 'opening' || phase === 'file', closing = phase === 'closing'
    const into = (a: number, dd: number) => (opening || closing ? ramp(tau, a, dd) : 0)
    let moving = false
    this.setKey(f.stop)
    // the paper rises once, at a return visit
    if (f.rise < 1) {
      const e = smooth(f.rise)
      for (const p of d.panels.values()) { p.el.style.transform = `translateY(${(1 - e) * 36}px)`; p.el.style.opacity = String(e) }
      d.sheet.style.transform = `translateY(${(1 - e) * 36}px)`; d.sheet.style.opacity = String(e)
      moving = true
    } else if (this.lastKey !== 'risen') {
      for (const p of d.panels.values()) { p.el.style.transform = ''; p.el.style.opacity = '' }
      d.sheet.style.transform = ''; d.sheet.style.opacity = ''
    }
    this.lastKey = f.rise < 1 ? '' : 'risen'

    // per stop: the one that has its drive at rest (or is open) decrypts; the others seal at once (overlay.ts)
    for (const id of this.ids) {
      const target = id === f.stop && (f.settled || opening || closing) ? 1 : 0
      const rate = target ? 1 / 0.5 : 1 / 0.18
      const cur = this.plain[id]
      this.plain[id] = target > cur ? Math.min(target, cur + rate * dt) : Math.max(target, cur - rate * dt)
      if (this.plain[id] !== target) moving = true
    }
    for (const [id, g] of d.panels) {
      const p = this.plain[id], mine = id === f.stop
      const I = mine ? into : () => 0
      const tg = this.tags.get(id)!
      tg.set(p * (1 - I(0, 0.18)), p > 0.001 ? 1 : 0)
      g.ey.set(p * (1 - I(0, 0.2)), 1 - I(0.25, 0.1))
      g.ti.set(p)
      if (g.su) { g.su.set(p); g.su.el.style.transform = mine ? `translateY(${22 * I(1.0, 0.3)}px)` : '' }
      g.sm?.set(p * (1 - I(0, 0.22)), 1 - I(0.3, 0.12))
      g.row.style.opacity = String(Math.min(1, p * 1.5) * (1 - I(0, 0.22)))
      const file = g.file
      if (file) {
        const on = mine && (opening || closing)
        file.ey.set(on ? I(0.95, 0.3) : 0, on ? I(0.9, 0.05) : 0)
        file.verify?.set(on ? I(1.15, 0.4) : 0, on ? I(1.1, 0.06) : 0)
        file.nums.style.opacity = on ? String(I(1.35, 0.35)) : '0'
      }
    }
    this.tagKey.set(into(0.06, 0.2), into(0.06, 0.01) * (1 - into(0.62, 0.25)))
    // the tag's paper shows only while a tag is readable
    const tagP = Math.max(0, ...Object.values(this.plain))
    d.tag.style.opacity = String((1 - into(0.55, 0.3)) * Math.min(1, tagP * 2.5))
    d.tag.style.visibility = this.placed ? 'visible' : 'hidden'
    d.rule.style.opacity = String(0.5 * (1 - into(0, 0.22)) * Math.min(1, tagP * 2.5))

    // the cover's sheet reads while the cover is the stop (its three lines decrypt with the cover's panel)
    const cov = this.plain[this.ids[0]]
    for (const l of d.sheetLines) l.set(cov, smooth(Math.min(1, cov * 3)))
    // the bar's name and links make room for the file's own bar
    const barK = 1 - into(0.02, 0.3)
    d.brand.style.opacity = d.nav.style.opacity = String(barK)
    d.brand.style.visibility = d.nav.style.visibility = barK < 0.02 ? 'hidden' : 'visible'
    const backK = into(1.4, 0.3)
    d.back.style.opacity = String(backK); d.back.style.visibility = backK < 0.02 ? 'hidden' : 'visible'
    return moving
  }
}

