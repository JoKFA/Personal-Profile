// Text-level security effects. (Opening a file decrypts it for real: see cipher.ts.)
// wipe: DoD 5220.22-M style 3-pass overwrite (0x00 · 0xFF · random), then key zeroized.
import gsap from 'gsap'

const HEX = '0123456789abcdef'

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
