// The words over the interior's scene (phone): only the chips marked `phone: true` in space/content.ts. Each is a solid paper plate (no blur, no
// fade of the paper) with a hairline to its anchor, which ends in a small ink pip. Where the anchor is comes from the baked per-frame data at the
// presented frame (the page layer leads the picture by half a frame, so positions are interpolated); what a chip says comes from the same
// content the desktop reads. Every plate is kept inside the region (never over the top bar, never over the sheet) and clear of the other plates.
import type { SpaceStation } from '../../manifest'
import { anchorAt, chipOpacity, pAt, phoneChips, placeChip, leaderEnd, type Box } from './model'

const NS = 'http://www.w3.org/2000/svg'
export interface Fit { s: number; tx: number; ty: number }
interface El { root: HTMLElement; lbl: HTMLElement; txt: HTMLElement; line: SVGLineElement; pip: SVGRectElement; w: number; h: number; text: string }

export class ChipLayer {
  readonly root: HTMLElement
  private svg: SVGSVGElement
  private els: El[] = []
  private st: SpaceStation | null = null
  /** the plates placed last frame: for tests (a chip must be inside the region and clear of the others) */
  boxes: { chip: number; box: Box; anchor: { x: number; y: number }; side: string; opacity: number }[] = []

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div'); this.root.className = 'ph-sp-chips'; this.root.setAttribute('aria-hidden', 'true')
    this.svg = document.createElementNS(NS, 'svg'); this.svg.setAttribute('class', 'ph-sp-leaders'); this.root.appendChild(this.svg)
    parent.appendChild(this.root)
  }

  /** the chips of one station (built when the station changes) */
  setStation(st: SpaceStation | null) {
    if (this.st === st) return
    this.st = st
    for (const e of this.els) { e.root.remove(); e.line.remove(); e.pip.remove() }
    this.els = []; this.boxes = []
    if (!st) return
    for (const { def } of phoneChips(st)) {
      const root = document.createElement('div'); root.className = 'ph-sp-chip'; root.dataset.tone = def.tone ?? ''
      const lbl = document.createElement('span'); lbl.className = 'ph-sp-chip-l'; lbl.textContent = def.label
      const txt = document.createElement('b')
      root.append(lbl, txt); this.root.appendChild(root)
      const line = document.createElementNS(NS, 'line'); line.setAttribute('class', 'ph-sp-leader'); this.svg.appendChild(line)
      const pip = document.createElementNS(NS, 'rect'); pip.setAttribute('class', 'ph-sp-pip'); pip.setAttribute('width', '5'); pip.setAttribute('height', '5'); this.svg.appendChild(pip)
      this.els.push({ root, lbl, txt, line, pip, w: 0, h: 0, text: '' })
    }
  }

  /**
   * One frame. `pos` is the clip frame position (fractional), `live`: the station's own sequence is on screen (not a flight, not the intro),
   * `region` the screen rect the plates may use, `fit` the stage's transform (master px -> screen px).
   */
  update(pos: number, live: boolean, fit: Fit, region: Box, atEnd = false) {
    const st = this.st
    if (!st) return
    const list = phoneChips(st)
    const p = atEnd ? 1 : pAt(st, pos)
    const placed: Box[] = []
    this.boxes = []
    list.forEach(({ sc, def }, n) => {
      const e = this.els[n]
      const a = anchorAt(sc, atEnd ? sc.x.length - 1 : pos)
      const vis = live && a.on ? chipOpacity(def, p) : 0
      const show = vis >= 0.01
      const op = vis.toFixed(3)
      if (e.root.style.opacity !== op) { e.root.style.opacity = op; e.root.style.visibility = show ? 'visible' : 'hidden' }
      e.line.style.visibility = e.pip.style.visibility = show ? 'visible' : 'hidden'
      e.line.style.opacity = e.pip.style.opacity = op
      const text = def.text(p)
      if (text !== e.text) { e.text = text; e.txt.textContent = text; e.w = e.root.offsetWidth; e.h = e.root.offsetHeight }
      if (!show) return
      if (!e.w) { e.w = e.root.offsetWidth; e.h = e.root.offsetHeight }
      const anchor = { x: a.x * fit.s + fit.tx, y: a.y * fit.s + fit.ty }
      const put = placeChip(anchor, { w: e.w, h: e.h }, def.side ?? 'up', region, placed)
      placed.push(put.box)
      e.root.style.transform = `translate(${put.box.l.toFixed(1)}px, ${put.box.t.toFixed(1)}px)`
      const end = leaderEnd(put.box, anchor)
      e.line.setAttribute('x1', end.x.toFixed(1)); e.line.setAttribute('y1', end.y.toFixed(1)); e.line.setAttribute('x2', anchor.x.toFixed(1)); e.line.setAttribute('y2', anchor.y.toFixed(1))
      e.pip.setAttribute('x', (anchor.x - 2.5).toFixed(1)); e.pip.setAttribute('y', (anchor.y - 2.5).toFixed(1))
      this.boxes.push({ chip: sc.chip, box: put.box, anchor, side: put.side, opacity: vis })
    })
  }

  hide() { for (const e of this.els) { e.root.style.opacity = '0'; e.root.style.visibility = 'hidden'; e.line.style.visibility = e.pip.style.visibility = 'hidden' } this.boxes = [] }
  dispose() { this.root.remove() }
}
