// A line of text that decrypts block by block on the phone's page (ported from phone/overlay.ts, which is the approved prototype).
// The text is really encrypted in this tab (AES-256-GCM, WebCrypto, a session key that never leaves it); its ciphertext bits are
// shown per 16-character block, lit olive when the block's turn comes, then resolved into the letters.
// This file does not import ui/cipher.ts (that one pulls in GSAP for the desktop's effects): the phone's chunk stays small.
// Without crypto.subtle (an insecure context) nothing is hidden: the text is simply readable, and `sealed` stays false.

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
  private covers: HTMLElement[] = []
  private bits: Uint8Array[] = []
  private painted = new Map<HTMLElement, string>()
  private last = ''
  /** true once the ciphertext is in hand (until then, or without crypto, the text is shown plain) */
  sealed = false
  /** resolves with the sealed text once it is encrypted (or null when this context cannot) */
  readonly ready: Promise<Sealed | null>

  constructor(parent: HTMLElement, cls: string, text: string, tag: keyof HTMLElementTagNameMap = 'div') {
    this.text = text
    this.el = document.createElement(tag); this.el.className = cls; parent.appendChild(this.el)
    for (let i = 0; i < text.length; i += BLOCK) {
      const s = document.createElement('span'); s.className = 'ph-cbx'; s.textContent = text.slice(i, i + BLOCK)
      const c = document.createElement('i'); c.setAttribute('aria-hidden', 'true'); s.appendChild(c)
      this.el.appendChild(s); this.spans.push(s); this.covers.push(c)
    }
    this.ready = canSeal()
      ? seal(text).then((sd) => { for (let b = 0; b < this.spans.length; b++) this.bits[b] = sd.ct.slice(b * BLOCK, b * BLOCK + BLOCK); this.sealed = true; this.painted.clear(); this.last = ''; return sd }).catch(() => null)
      : Promise.resolve(null)
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
    const sig = `${p.toFixed(3)}|${o.toFixed(3)}|${this.sealed}`
    if (sig === this.last) return
    this.last = sig
    this.el.style.opacity = String(o)
    if (o <= 0) return
    const n = this.spans.length
    for (let b = 0; b < n; b++) {
      const at = this.sealed ? p * (n + 0.6) - b : 2
      const span = this.spans[b], cover = this.covers[b]
      if (at < 1) cover.style.display = ''
      if (at <= 0) { span.style.color = 'transparent'; cover.style.opacity = '1'; this.paint(cover, this.bits[b], 'rgba(22,23,26,.55)') }
      else if (at < 0.6) { span.style.color = 'transparent'; cover.style.opacity = '1'; this.paint(cover, this.bits[b], '#74861a') }
      else { span.style.color = ''; const f = Math.max(0, 1 - (at - 0.6) / 0.4); cover.style.opacity = String(f); cover.style.display = f > 0 ? '' : 'none' }
    }
  }
}
