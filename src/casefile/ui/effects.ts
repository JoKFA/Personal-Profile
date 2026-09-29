// Text-level security effects.
// redact / reveal: after RhineLabUI src/document-decryption.ts (MIT): each wrapped line gets an
// ink bar that retracts in reading order, without replacing the text itself.
// scramble: a short ciphertext flicker on headings (GSAP ScrambleTextPlugin, free since 2025).
// wipe: DoD 5220.22-M style 3-pass overwrite (0x00 · 0xFF · random), then key zeroized.
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

gsap.registerPlugin(ScrambleTextPlugin)

const HEX = '0123456789abcdef'

/** Cover every text line under `root` matching `selector` with an ink bar. Returns a reveal(). */
export function redact(root: HTMLElement, selector = '[data-redact]') {
  const bars: HTMLElement[] = []
  root.querySelectorAll<HTMLElement>(selector).forEach((target) => {
    const box = target.getBoundingClientRect()
    if (!box.width) return
    const lines: { x: number; y: number; r: number; b: number }[] = []
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue
      const range = document.createRange(); range.selectNodeContents(n)
      for (const rc of range.getClientRects()) {
        if (!rc.width) continue
        const x = rc.left - box.left, y = rc.top - box.top, r = rc.right - box.left, b = rc.bottom - box.top
        const line = lines.find((l) => Math.abs(l.y - y) < 6)
        if (line) { line.x = Math.min(line.x, x); line.r = Math.max(line.r, r); line.b = Math.max(line.b, b) } else lines.push({ x, y, r, b })
      }
    }
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
    for (const l of lines) {
      const bar = document.createElement('span')
      bar.className = 'cx-redact'; bar.setAttribute('aria-hidden', 'true')
      bar.style.cssText = `left:${l.x - 1}px;top:${l.y - 1}px;width:${l.r - l.x + 2}px;height:${l.b - l.y + 2}px`
      target.appendChild(bar); bars.push(bar)
    }
  })
  return {
    reveal(reduced: boolean, duration = 0.9) {
      if (reduced) { bars.forEach((b) => b.remove()); return Promise.resolve() }
      return new Promise<void>((res) => {
        gsap.to(bars, {
          scaleX: 0, transformOrigin: 'right center', duration: 0.42, ease: 'power3.inOut',
          stagger: { each: duration / Math.max(bars.length, 1), from: 'start' },
          onComplete: () => { bars.forEach((b) => b.remove()); res() },
        })
      })
    },
    /** The reverse: bars grow back over each line, top to bottom. */
    conceal(reduced: boolean, duration = 0.45) {
      if (reduced) return Promise.resolve()
      return new Promise<void>((res) => {
        gsap.fromTo(bars, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 0.18, ease: 'power3.inOut', stagger: { each: duration / Math.max(bars.length, 1) }, onComplete: () => res() })
      })
    },
    dispose() { bars.forEach((b) => b.remove()) },
  }
}

/** Scramble `el` into `text`. Pass the real text: under React StrictMode the element may already hold a scrambled frame. */
export function scramble(el: HTMLElement | null, text: string, reduced: boolean, duration = 0.8) {
  if (!el) return () => {}
  if (reduced) { el.textContent = text; return () => {} }
  const tw = gsap.to(el, { duration, scrambleText: { text, chars: HEX, revealDelay: 0.2, speed: 0.6 } })
  return () => { tw.kill(); el.textContent = text }
}

/**
 * DoD-style 3-pass overwrite (0x00 · 0xFF · random), shown as a red scan line that runs down
 * `root` once per pass; each text line is overwritten as the line crosses it. Labels marked
 * [data-keep] are left alone so the page stays legible as a page. Then the key is zeroized.
 */
export const WIPE_PASSES = ['overwrite 0x00', 'overwrite 0xFF', 'overwrite random'] as const
export async function wipe(root: HTMLElement, reduced: boolean, onStep: (step: number) => void, onPass: (pass: number) => void) {
  const nodes: { n: Text; t: string; y: number }[] = []
  const top = root.getBoundingClientRect().top
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent?.trim() && !n.parentElement?.closest('[data-keep], .lbl, button') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const r = document.createRange(); r.selectNodeContents(n)
    nodes.push({ n: n as Text, t: n.textContent!, y: r.getBoundingClientRect().top - top })
  }
  const height = Math.min(root.scrollHeight || root.getBoundingClientRect().height, innerHeight * 1.2)
  const line = document.createElement('span'); line.className = 'wipe-line'; root.appendChild(line)
  const chars: (string | null)[] = ['0', 'F', null]
  const fill = (t: string, ch: string | null) => [...t].map((c) => (/\s/.test(c) ? c : ch ?? HEX[Math.floor(Math.random() * 16)])).join('')
  const hold = (ms: number) => (reduced ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)))
  for (let p = 0; p < chars.length; p++) {
    onStep(p); onPass(p)
    if (reduced) { for (const x of nodes) x.n.textContent = fill(x.t, chars[p]); continue }
    await new Promise<void>((res) => {
      const state = { y: -10 }
      gsap.to(state, { y: height + 10, duration: 0.72, ease: 'power1.inOut', onUpdate: () => {
        line.style.transform = `translateY(${state.y}px)`
        for (const x of nodes) if (x.y < state.y) x.n.textContent = fill(x.t, chars[p])
      }, onComplete: () => res() })
    })
    await hold(340)                      // each pass stays on screen long enough to read
  }
  line.remove()
  onStep(3)                              // key zeroized
  await hold(1500)
}
