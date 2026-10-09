// Giving the main thread back. The archive is built under the entry's animation, so every step of the build
// is small, and the steps are separated by this: a rendering opportunity (and the animation's next frame)
// comes between one step and the next instead of after a half-second task.
export const tick = () => new Promise<void>((res) => { setTimeout(res, 0) })

/** Run a generator of small steps to its end at once (the same code serves the build that must not stop and the one that may). */
export function drain<T>(steps: Generator<void, T>): T {
  let r = steps.next()
  while (!r.done) r = steps.next()
  return r.value
}
/** Run a generator of small steps, giving the main thread back after each. */
export async function drainTicking<T>(steps: Generator<void, T>): Promise<T> {
  let r = steps.next()
  while (!r.done) { await tick(); r = steps.next() }
  return r.value
}
