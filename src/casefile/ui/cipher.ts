// Block decryption. Opening a file decrypts it for real: the file's visible text is encrypted in
// this tab with AES-256-GCM (WebCrypto, a session key that never leaves the browser), shown as its
// own ciphertext, and decrypted block by block in counter order. Each 16-character block shows its
// ciphertext bits until its turn; when it comes, the bits light olive (readable) and resolve into
// the letters. The GCM tag is checked at the end. Closing the file encrypts it again under a fresh
// IV, so the same text never shows the same ciphertext twice.
//
// A block is 16 characters and stands for one 16-byte AES block. The two agree for ASCII only: a
// character outside it takes more bytes, so the correspondence is approximate and never claimed to
// be byte for byte.
//
// The text nodes are split into block spans for the run and put back afterwards (the very same
// nodes), so React never sees a node it does not own. A run is stopped with `restore()`, which is
// synchronous: call it before React unmounts or re-renders what the run covers.
import gsap from 'gsap'

let sessionKey: Promise<CryptoKey> | null = null
const key = () => (sessionKey ??= crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']))

export const BLOCK = 16
export interface Sealed { iv: Uint8Array; ct: Uint8Array; verify(): Promise<boolean> }
/** Encrypt `text` under the session key with a fresh 96-bit IV. `verify` really decrypts and checks the tag. */
export async function seal(text: string): Promise<Sealed> {
  const k = await key(), iv = crypto.getRandomValues(new Uint8Array(12))
  const pt = new TextEncoder().encode(text)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, pt))
  return {
    iv, ct,
    async verify() {
      try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ct)) === text } catch { return false }
    },
  }
}

/** The text nodes under `target` that carry words (the whitespace between elements is layout, not text), not yet split into blocks. */
function wordNodes(target: HTMLElement) {
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT), nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim() && !n.parentElement?.closest('.cb-cover, .cb')) nodes.push(n as Text)
  return nodes
}
/** How many blocks a text makes: every text node rounds up on its own (under 16 characters still counts as one). */
export const blocksOf = (lengths: number[]) => lengths.reduce((n, len) => n + Math.ceil(len / BLOCK), 0)

/**
 * The same check without the show (reduced motion): the text is really encrypted and decrypted, the
 * tag verified, and nothing on the page moves.
 */
export async function checkText(targets: HTMLElement[]) {
  const texts = targets.flatMap((t) => wordNodes(t).map((n) => n.textContent!))
  const sealed = await seal(texts.join(''))
  return { blocks: blocksOf(texts.map((t) => t.length)), ok: await sealed.verify() }
}

/**
 * Ciphertext bits as a crisp, sparse strip: square cells on a fixed grid, 1-bits drawn, 0-bits a faint
 * tick (or nothing). `rows` fixes the strip's height so a line of text becomes a line of data.
 */
function bitField(bytes: Uint8Array, w: number, h: number, cell: number, tone: 'ink' | 'acc', gap = 1, rowsFixed = 0, offAlpha = 0.07) {
  const dpr = Math.min(3, Math.max(1, devicePixelRatio || 1)), c = document.createElement('canvas')
  const step = cell + gap, cols = Math.max(1, Math.floor(w / step)), rows = rowsFixed || Math.max(1, Math.floor(h / step))
  c.width = Math.round(cols * step * dpr); c.height = Math.round(rows * step * dpr)
  const g = c.getContext('2d')!, bits = bytes.length * 8
  const on = tone === 'ink' ? 'rgba(22, 23, 26, .5)' : 'rgba(92, 107, 18, .95)'
  const off = tone === 'ink' ? `rgba(22, 23, 26, ${offAlpha})` : `rgba(92, 107, 18, ${offAlpha * 2})`
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const b = (r * cols + q) % bits, v = (bytes[b >> 3] >> (7 - (b & 7))) & 1
    g.fillStyle = v ? on : off
    g.fillRect(Math.round(q * step * dpr), Math.round(r * step * dpr), Math.max(1, Math.round(cell * dpr)), Math.max(1, Math.round(cell * dpr)))
  }
  return { url: c.toDataURL(), w: cols * step, h: rows * step }
}

interface Block { span: HTMLSpanElement; covers: HTMLElement[]; bytes: Uint8Array }

/**
 * Split the text under `targets` into 16-character block spans, encrypt it, and cover each block with
 * its ciphertext bits. `start` is the state the run begins in: 'cipher' (covered, to be decrypted) or
 * 'plain' (readable, to be encrypted; its bits come from this call's own fresh IV).
 *
 * `decrypt(ms)` reveals block by block in reading order and resolves with the tag check (null if the
 * run was stopped first); `encrypt(ms)` covers again, last block first; `halt()` stops the motion;
 * `restore()` stops it and puts the original text nodes (and the targets' own style) back.
 */
export async function cipherText(targets: HTMLElement[], start: 'cipher' | 'plain' = 'cipher') {
  const blocks: Block[] = [], restores: (() => void)[] = [], covers: HTMLElement[] = []
  let text = ''
  for (const target of targets) {
    const nodes = wordNodes(target)
    if (nodes.length && getComputedStyle(target).position === 'static') {
      // (through the style object: the site's CSP does not allow writing the style attribute itself)
      const had = target.hasAttribute('style'), prev = target.style.position
      target.style.position = 'relative'
      restores.push(() => { target.style.position = prev; if (!had && !target.getAttribute('style')) target.removeAttribute('style') })
    }
    for (const node of nodes) {
      const t = node.textContent!, frag = document.createDocumentFragment(), spans: HTMLSpanElement[] = []
      for (let i = 0; i < t.length; i += BLOCK) {
        const s = document.createElement('span'); s.className = start === 'cipher' ? 'cb enc' : 'cb'; s.textContent = t.slice(i, i + BLOCK)
        frag.appendChild(s); spans.push(s)
      }
      node.parentNode!.replaceChild(frag, node)
      restores.push(() => { const first = spans[0]; if (first.parentNode) { first.parentNode.insertBefore(node, first); spans.forEach((s) => s.remove()) } })
      for (const s of spans) blocks.push({ span: s, covers: [], bytes: new Uint8Array(BLOCK) })
      text += t
    }
  }
  const sealed = await seal(text)
  // each block's own 16 ciphertext bytes (the k-th AES block, in counter order)
  blocks.forEach((b, k) => { for (let j = 0; j < BLOCK; j++) b.bytes[j] = sealed.ct[(k * BLOCK + j) % sealed.ct.length] })
  // covers: one per line box of each block, drawn at the block's own size
  for (const b of blocks) {
    const host = targets.find((t) => t.contains(b.span))!
    const hb = host.getBoundingClientRect(), fs = parseFloat(getComputedStyle(b.span).fontSize) || 15
    const big = fs >= 24, cell = big ? Math.max(3, Math.round(fs * 0.085)) : 2, gap = big ? 2 : 1, rows = big ? 3 : 2
    for (const r of b.span.getClientRects()) {
      if (r.width < 2) continue
      const h = rows * (cell + gap), f = bitField(b.bytes, r.width, h, cell, 'ink', gap, rows, 0.05)
      const c = document.createElement('span'); c.className = start === 'cipher' ? 'cb-cover' : 'cb-cover off'; c.setAttribute('aria-hidden', 'true')
      c.style.cssText = `left:${r.left - hb.left}px;top:${r.top - hb.top + (r.height - f.h) / 2}px;width:${f.w}px;height:${f.h}px;background-image:url(${f.url})`
      c.dataset.acc = bitField(b.bytes, r.width, h, cell, 'acc', gap, rows, 0.05).url
      host.appendChild(c); b.covers.push(c); covers.push(c)
    }
  }
  const show = (b: Block, on: boolean) => {
    b.span.classList.toggle('enc', on)
    for (const c of b.covers) c.classList.toggle('off', !on)
  }
  const head = (b: Block) => { for (const c of b.covers) { c.style.backgroundImage = `url(${c.dataset.acc})`; c.classList.add('head') } }
  let tween: gsap.core.Tween | null = null, pending: ((ok: boolean | null) => void) | null = null
  const halt = () => { tween?.kill(); tween = null; const p = pending; pending = null; p?.(null) }
  return {
    blocks: blocks.length, bytes: sealed.ct.length,
    /** reveal block by block in reading order over `ms`; resolves with the tag check, or null if stopped */
    decrypt(ms: number) {
      if (!blocks.length) return sealed.verify()
      return new Promise<boolean | null>((res) => {
        const st = { k: 0 }; let done = 0
        pending = res
        tween = gsap.to(st, {
          k: blocks.length, duration: ms / 1000, ease: 'none',
          onUpdate: () => {
            const upto = Math.floor(st.k)
            // the block whose turn it is lights olive for a beat, then its letters come through
            if (upto < blocks.length) head(blocks[upto])
            for (; done < upto; done++) show(blocks[done], false)
          },
          onComplete: () => { for (; done < blocks.length; done++) show(blocks[done], false); pending = null; void sealed.verify().then(res) },
        })
      })
    },
    /** cover again, last block first, at an even pace over `ms` */
    encrypt(ms: number) {
      return new Promise<void>((res) => {
        const st = { k: blocks.length }; let at = blocks.length
        for (const c of covers) c.classList.remove('head')
        tween = gsap.to(st, { k: 0, duration: ms / 1000, ease: 'none', onUpdate: () => { for (; at > Math.ceil(st.k); ) show(blocks[--at], true) }, onComplete: () => { for (; at > 0; ) show(blocks[--at], true); res() } })
      })
    },
    halt,
    restore() { halt(); covers.forEach((c) => c.remove()); restores.reverse().forEach((r) => r()); restores.length = 0 },
  }
}
export type TextRun = Awaited<ReturnType<typeof cipherText>>

/**
 * The drive's face as a grid of AES blocks over the projected demo: each cell carries 16 ciphertext
 * bytes; cells decrypt in counter order (row by row), lighting olive for a beat as they go.
 */
export async function cipherFace(stage: HTMLElement, label: string, cols = 8, rows = 5, start: 'cipher' | 'plain' = 'cipher') {
  const sealed = await seal(label.padEnd(cols * rows * BLOCK, '·'))
  const grid = document.createElement('div'); grid.className = 'cg'; grid.setAttribute('aria-hidden', 'true')
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  const cells: { el: HTMLElement; acc: string }[] = []
  for (let k = 0; k < cols * rows; k++) {
    const bytes = sealed.ct.subarray(k * BLOCK, k * BLOCK + BLOCK)
    // one AES block per cell: 128 bits as a 16 × 8 chip of 2-px cells
    const ink = bitField(bytes, 16 * 4, 8 * 4, 2, 'ink', 2, 8, 0.08), acc = bitField(bytes, 16 * 4, 8 * 4, 2, 'acc', 2, 8, 0.08)
    const el = document.createElement('i'); el.style.backgroundImage = `url(${ink.url})`; el.style.backgroundSize = `${ink.w}px ${ink.h}px`
    if (start === 'plain') el.classList.add('off')
    grid.appendChild(el); cells.push({ el, acc: acc.url })
  }
  if (start === 'plain') grid.classList.add('clear')
  stage.appendChild(grid)
  let tween: gsap.core.Tween | null = null, pending: (() => void) | null = null, late: ReturnType<typeof setTimeout> | null = null
  const halt = () => { tween?.kill(); tween = null; const p = pending; pending = null; p?.() }
  return {
    decrypt(ms: number) {
      return new Promise<void>((res) => {
        const st = { k: 0 }; let done = 0
        pending = res
        tween = gsap.to(st, {
          k: cells.length, duration: ms / 1000, ease: 'none',
          onUpdate: () => {
            const upto = Math.floor(st.k)
            if (upto < cells.length) { const c = cells[upto]; c.el.style.backgroundImage = `url(${c.acc})`; c.el.classList.add('head') }
            if (upto > 0) grid.classList.add('clear')
            for (; done < upto; done++) cells[done].el.classList.add('off')
          },
          onComplete: () => { cells.forEach((c) => c.el.classList.add('off')); grid.classList.add('clear'); late = setTimeout(() => grid.remove(), 200); pending = null; res() },
        })
      })
    },
    /** cover the demo again: blocks come back last first, at an even pace over `ms` */
    encrypt(ms: number) {
      return new Promise<void>((res) => {
        const st = { k: cells.length }; let at = cells.length
        pending = res
        tween = gsap.to(st, {
          k: 0, duration: ms / 1000, ease: 'none',
          onUpdate: () => { for (; at > Math.ceil(st.k); ) cells[--at].el.classList.remove('off') },
          onComplete: () => { for (; at > 0; ) cells[--at].el.classList.remove('off'); grid.classList.remove('clear'); pending = null; res() },
        })
      })
    },
    halt,
    remove() { halt(); if (late) clearTimeout(late); grid.remove() },
  }
}
export type FaceRun = Awaited<ReturnType<typeof cipherFace>>
