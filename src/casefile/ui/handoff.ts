// The entry's hand-over (spec §26.10): the record on screen folds to a point of light, the page's
// veil lifts off the archive, and the light falls into it where the wave starts.
import gsap from 'gsap'

export interface Handover {
  /** the entry page: its `--veil` lifts off the archive */
  root: HTMLElement
  /** the record that folds into the light */
  card: HTMLElement
  /** the light (a fixed-position element) */
  dot: HTMLElement
  /** the name lockup, which leaves last */
  lock: HTMLElement
  /** everything else on the page, which fades first */
  fade: Element[]
  originAt: () => { x: number; y: number } | null
  onReveal: () => void
  onStrike: () => void
  onDone: () => void
}

export function handover({ root, card, dot, lock, fade, originAt, onReveal, onStrike, onDone }: Handover) {
  const c = card.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2
  const fall = { k: 0 }
  gsap.set(dot, { x: cx, y: cy })
  return gsap.timeline()
    .to(fade, { autoAlpha: 0, duration: 0.25 }, 0)
    .to([...card.children], { autoAlpha: 0, duration: 0.18 }, 0)
    .to(card, { scaleY: 0.004, duration: 0.28, ease: 'power3.in' }, 0.08)
    .to(card, { scaleX: 0.003, duration: 0.24, ease: 'power3.in' }, 0.32)
    .set(dot, { autoAlpha: 1 }, 0.48).set(card, { autoAlpha: 0 }, 0.58)
    .call(onReveal, undefined, 0.5)
    .to(root, { '--veil': 0, duration: 0.5 }, 0.58)
    .to(lock, { autoAlpha: 0, duration: 0.25 }, 0.8)
    .to(fall, { k: 1, duration: 0.65, ease: 'power2.in', onUpdate: () => {
      const o = originAt() ?? { x: innerWidth * 0.4, y: innerHeight * 0.45 }
      gsap.set(dot, { x: cx + (o.x - cx) * Math.sin(fall.k * Math.PI / 2), y: cy + (o.y - cy) * fall.k * fall.k })
    } }, 0.65)
    .call(onStrike, undefined, 1.3)
    .to(dot, { autoAlpha: 0, scale: 1.8, duration: 0.2 }, 1.3)
    .call(onDone, undefined, 1.8)
}
