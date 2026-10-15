// A line of text that decrypts block by block on the phone's page (ported from phone/overlay.ts, which is the approved prototype).
// The text is really encrypted in this tab (AES-256-GCM, WebCrypto, a session key that never leaves it); its ciphertext bits are
// shown per 16-character block, lit olive when the block's turn comes, then resolved into the letters.
// This file does not import ui/cipher.ts (that one pulls in GSAP for the desktop's effects): the phone's chunk stays small.
// Without crypto.subtle (an insecure context) nothing is hidden: the text is simply readable, and `sealed` stays false.

import { Slicer } from './app/idle'   // P6b

export const BLOCK = 16

let sessionKey: Promise<CryptoKey> | null = null
const key = () => (sessionKey ??= crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']))

export interface Sealed { iv: Uint8Array; ct: Uint8Array; verify(): Promise<boolean> }
/** Encrypt `text` under the session key with a fresh 96-bit IV. `verify` really decrypts it and checks the GCM tag. */
export async function seal(text: string): Promise<Sealed> {
  const k = await key(), iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)))
  return { iv, ct, async verify() { try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ct)) === text } catch { return false } } }
}
export const canSeal = () => typeof crypto !== 'undefined' && !!crypto.subtle

/** How many blocks a set of texts makes: each text rounds up on its own (under 16 characters still counts as one). */
export const blocksOf = (lengths: number[]) => lengths.reduce((n, len) => n + Math.ceil(len / BLOCK), 0)

export class Line {
  readonly el: HTMLElement
  readonly text: string
  /** the 16-character blocks of the text, in order */
  readonly spans: HTMLSpanElement[] = []
  private covers: (HTMLCanvasElement | undefined)[] = []   // P6b: a block's strip is made when the block first needs one (a canvas costs about a millisecond on a phone)
  /** P6b: a line far from the screen keeps no strips (its letters are hidden, nothing is drawn); `arm()` makes them when it is near */
  lazy = false
  private lastP = 0
  private lastO = 1
  private bits: Uint8Array[] = []
  private painted = new Map<HTMLCanvasElement, string>()
  private last = ''
  /** true once the ciphertext is in hand (until then, or without crypto, the text is shown plain) */
  sealed = false
  /** resolves with the sealed text once it is encrypted (or null when this context cannot) */
  readonly ready: Promise<Sealed | null>

  /** Make an element that already holds only text (React's, say) into a line: its text node becomes the blocks. Nothing else may change that element afterwards. */
  static adopt(el: HTMLElement, lazy = false): Line {
    const text = el.textContent ?? ''
    el.textContent = ''
    return new Line(null, '', text, 'div', el, lazy)
  }

  constructor(parent: HTMLElement | null, cls: string, text: string, tag: keyof HTMLElementTagNameMap = 'div', existing?: HTMLElement, lazy = false) {
    this.text = text
    this.lazy = lazy
    if (existing) this.el = existing
    else { this.el = document.createElement(tag); this.el.className = cls; parent!.appendChild(this.el) }
    for (let i = 0; i < text.length; i += BLOCK) {
      const s = document.createElement('span'); s.className = 'ph-cbx'; s.textContent = text.slice(i, i + BLOCK)
      this.el.appendChild(s); this.spans.push(s)
      if (!lazy) this.cover(this.spans.length - 1)   // (a line that is on a page from the start has its strips from the start)
    }
    this.ready = canSeal()
      ? seal(text).then((sd) => { for (let b = 0; b < this.spans.length; b++) this.bits[b] = sd.ct.slice(b * BLOCK, b * BLOCK + BLOCK); this.sealed = true; this.painted.clear(); this.last = ''; return sd }).catch(() => null)
      : Promise.resolve(null)
  }

  private cover(b: number): HTMLCanvasElement {
    let c = this.covers[b]
    if (!c) { c = document.createElement('canvas'); c.width = 32; c.height = 4; c.setAttribute('aria-hidden', 'true'); this.spans[b].appendChild(c); this.covers[b] = c }   // P6a: the strip is drawn on the element itself (no PNG encoding per block)
    return c
  }

  /** P6b: the line is near the screen: its strips are made and drawn as they would have been */
  arm() {
    if (!this.lazy) return
    this.lazy = false; this.last = ''
    this.set(this.lastP, this.lastO)
  }

  private paint(c: HTMLCanvasElement, bytes: Uint8Array | undefined, col: string) {
    const key = col + (bytes ? bytes.join(',') : '')
    if (this.painted.get(c) === key) return
    c.width = 32   // (clears it)
    const g = c.getContext('2d')!; g.fillStyle = col
    for (let i = 0; i < 128; i++) if (bytes && (bytes[i >> 3] >> (7 - (i & 7))) & 1) g.fillRect(i % 32, i >> 5, 1, 1)
    this.painted.set(c, key)
  }

  /** p: 0 sealed … 1 plain, the blocks taking their turns in order; o: the line's opacity */
  set(p: number, o = 1) {
    this.lastP = p; this.lastO = o
    const sig = `${p.toFixed(3)}|${o.toFixed(3)}|${this.sealed}`
    if (sig === this.last) return
    this.last = sig
    this.el.style.opacity = String(o)
    if (o <= 0) return
    const n = this.spans.length
    for (let b = 0; b < n; b++) {
      const at = this.sealed ? p * (n + 0.6) - b : 2
      const span = this.spans[b]
      if (at < 0.6) {
        span.style.color = 'transparent'
        if (this.lazy) continue
        const cover = this.cover(b); cover.style.display = ''; cover.style.opacity = '1'; this.paint(cover, this.bits[b], at <= 0 ? 'rgba(22,23,26,.55)' : '#74861a')
      } else {
        span.style.color = ''
        const cover = this.covers[b]
        if (cover) { const f = Math.max(0, 1 - (at - 0.6) / 0.4); cover.style.opacity = String(f); cover.style.display = f > 0 ? '' : 'none' }
      }
    }
  }
}

/** P6b: arms the lines of a page's groups (a section, a card) when the group comes within `margin` of the screen, a few at a time between frames */
export class Armer {
  private io: IntersectionObserver | null = null
  private queue: Line[] = []
  private busy = false
  private dead = false
  private readonly groups: { el: HTMLElement; lines: Line[] }[]
  private readonly margin: string
  constructor(groups: { el: HTMLElement; lines: Line[] }[], margin = '0px 0px 120% 0px') { this.groups = groups; this.margin = margin }
  start() {
    if (this.dead || typeof IntersectionObserver !== 'function') { for (const g of this.groups) for (const l of g.lines) l.arm(); return }
    this.io = new IntersectionObserver((list) => {
      for (const it of list) {
        if (!it.isIntersecting) continue
        this.io?.unobserve(it.target)
        const g = this.groups.find((x) => x.el === it.target); if (g) this.queue.push(...g.lines)
      }
      void this.pump()
    }, { rootMargin: this.margin, threshold: 0 })
    for (const g of this.groups) this.io.observe(g.el)
  }
  /** these lines now (the ones on the screen when the page appears) */
  armNow(lines: Line[]) { for (const l of lines) l.arm() }
  private async pump() {
    if (this.busy) return
    this.busy = true
    const sl = new Slicer(8, () => true)
    while (this.queue.length && !this.dead) { this.queue.shift()!.arm(); await sl.tick() }
    this.busy = false
  }
  stop() { this.dead = true; this.io?.disconnect(); this.io = null; this.queue = [] }
}
