// Builds the interior once the archive is on screen (spec §8). It borrows the archive's renderer and
// environment, so there is no second context and no second environment map to filter; the rest of the
// build is cut into steps with a frame between them, so the entrance is never held for more than one.
import type { Archive } from '../scene/archive'
import { createClock } from './clock'
import { createSpace } from './scene'

/** yield to the browser: a frame (or, in a hidden tab, a short timeout so the build still finishes) */
const frame = () => new Promise<void>((res) => { const t = setTimeout(res, 120); requestAnimationFrame(() => { clearTimeout(t); res() }) })

export async function bootSpace(archive: Archive, reduced: boolean) {
  const host = archive.host
  const space = await createSpace({ renderer: host.renderer, environment: host.environment }, host.quality, frame)
  return { space, clock: createClock({ reduced }) }
}
