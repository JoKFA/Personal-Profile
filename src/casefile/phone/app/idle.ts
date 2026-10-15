// Work that must not freeze motion (P6b): the file views and the interior are built before they are needed, but in small steps with a yield between them,
// so that no task of the main thread is longer than a frame or two even on a phone four times slower than this machine. Nothing here changes what is built or when
// it is wanted: a caller that is waiting (a tap on Open) puts its slicer in a hurry, and then the steps follow each other as fast as the browser lets them.

const port = typeof MessageChannel === 'function' ? new MessageChannel() : null
const waiting: (() => void)[] = []
if (port) port.port1.onmessage = () => { waiting.shift()?.() }

/** the next task of the event loop (the browser may draw and take input in between) */
export const nextTask = (): Promise<void> => new Promise<void>((res) => { if (port) { waiting.push(res); port.port2.postMessage(0) } else setTimeout(res, 0) })

/** an idle slot (the rest of a frame, or a quiet moment); at the latest after `timeout` ms */
export const idleSlot = (timeout = 200): Promise<void> => new Promise<void>((res) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => res(), { timeout })
  else setTimeout(res, 24)
})

/** Cuts a long job into steps: `await s.tick()` at the places where the job can stop; it yields when this step has used its budget (ms of work). */
export class Slicer {
  private t = performance.now()
  private readonly budget: number
  private readonly hurry: () => boolean
  constructor(budget = 6, hurry: () => boolean = () => false) { this.budget = budget; this.hurry = hurry }
  async tick(): Promise<void> {
    if (performance.now() - this.t < this.budget) return
    await this.yield()
  }
  /** end this step now */
  async yield(): Promise<void> {
    await (this.hurry() ? nextTask() : idleSlot())
    this.t = performance.now()
  }
}
