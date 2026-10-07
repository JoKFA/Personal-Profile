// The entry's way out (spec §29), after the PV's welcome (26.4–26.9 s): the page over-exposes,
// softens and shrinks a little into a white field, the name staying; the archive appears in that
// field, held at its first frame, and slides in as the white lifts.
import gsap from 'gsap'

export interface Handover {
  /** the entry page: its `--veil` lifts off the archive, its `--wash` is the white field */
  root: HTMLElement
  /** the record on the page */
  card: HTMLElement
  /** the name lockup, which stays through the white and leaves last */
  lock: HTMLElement
  /** everything else on the page */
  fade: Element[]
  onReveal: () => void
  onStrike: () => void
  onDone: () => void
}

export function handover({ root, card, lock, fade, onReveal, onStrike, onDone }: Handover) {
  const content = [card, ...fade]
  return gsap.timeline()
    .to(root, { '--wash': 1, duration: 0.5, ease: 'power2.in' }, 0)
    // (an explicit start: from `none`, GSAP would start brightness at 0, a black flash)
    .fromTo(content, { filter: 'blur(0px) brightness(1) saturate(1)', scale: 1 }, { filter: 'blur(8px) brightness(1.3) saturate(0.5)', scale: 0.965, duration: 0.5, ease: 'power2.in' }, 0)
    .to(content, { autoAlpha: 0, duration: 0.16 }, 0.36)
    // under the full white: the archive is there, held at its first frame; then it starts to slide
    .call(onReveal, undefined, 0.5)
    .set(root, { '--veil': 0 }, 0.5)
    .call(onStrike, undefined, 0.52)
    .to(root, { '--wash': 0, duration: 0.5, ease: 'power1.out' }, 0.56)
    .to(lock, { autoAlpha: 0, duration: 0.3 }, 0.95)
    .call(onDone, undefined, 1.3)
}
