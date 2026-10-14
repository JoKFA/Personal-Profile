// The hand-over between the entry page (React, Gate.tsx in phone mode) and the shell's controller (plain DOM). Either side may be ready first:
// the page can be sealed before the manifest has even arrived (the page stays on its sealed frame), and the first touch can come before the stage exists.
import { idFromPath } from '../route'

/** A first visit to "/": no `yw.entry` yet (or ?intro). A link to a file never shows the entry page (plan §2.6). */
export function isFirstVisit(): boolean {
  try {
    if (idFromPath(location.pathname)) return false
    return new URLSearchParams(location.search).has('intro') || localStorage.getItem('yw.entry') !== '1'
  } catch { return true }
}

export interface EnterOptions { skipped: boolean; reduced: boolean; sealedAt: number }
export interface EntryCtl {
  /** unlock the video pool (a call inside a pointer event) */
  prime(): void
  /** the page is sealed: play the entrance under it and take the page away; resolves when the shell is on its cover */
  enter(gate: HTMLElement, o: EnterOptions): Promise<void>
}
/** timestamps (performance.now) of one entry, for the tests and the network record */
export interface EntryLog { shownAt: number; firstPressAt: number; sealedAt: number; enterAt: number; clipWaitMs: number; via: string; firstFrameAt: number; gateGoneAt: number; coverAt: number }

export class EntryBridge {
  ctl: EntryCtl | null = null
  readonly log: EntryLog = { shownAt: 0, firstPressAt: 0, sealedAt: 0, enterAt: 0, clipWaitMs: 0, via: '', firstFrameAt: 0, gateGoneAt: 0, coverAt: 0 }
  /** the page asks for itself to be removed (React unmounts it) */
  private done: () => void = () => {}
  whenDone(f: () => void) { this.done = f }
  private pressed = false
  private sealed: { root: HTMLElement; skipped: boolean; reduced: boolean } | null = null
  private started = false
  readonly reduced: boolean
  constructor(reduced: boolean) { this.reduced = reduced }

  /** every pointerdown on the page */
  press = (first: boolean) => {
    if (first) { this.pressed = true; this.log.firstPressAt = performance.now() }
    this.ctl?.prime()
  }
  /** the seal is on screen (Gate calls this once) */
  seal = (e: { root: HTMLElement; skipped: boolean }) => {
    this.log.sealedAt = performance.now()
    // from here the visit has begun: the next one is a return visit
    try { localStorage.setItem('yw.entry', '1') } catch { /* private mode */ }
    this.sealed = { ...e, reduced: this.reduced }
    this.run()
  }
  /** the controller is built */
  attach(ctl: EntryCtl) { this.ctl = ctl; if (this.pressed) ctl.prime(); this.run() }
  private run() {
    if (this.started || !this.ctl || !this.sealed) return
    this.started = true
    const s = this.sealed
    void this.ctl.enter(s.root, { skipped: s.skipped, reduced: s.reduced, sealedAt: this.log.sealedAt }).then(() => { this.log.gateGoneAt = performance.now(); this.done() })
  }
}
