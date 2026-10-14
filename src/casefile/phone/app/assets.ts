// Where the pictures come from: the bake's manifest (public/phone/manifest.json). ?phone-dev selects the temporary manifest built from the
// P0 spike's assets (public/phone-dev/, see dev/make-dev-manifest.mjs) until the bake exists. Sizes are always read from the manifest.
import type { PhoneManifest } from '../manifest'

export interface Flags {
  /** ?phone-dev: the temporary manifest, and window.__phone for the tests */
  dev: boolean
  /** ?phone-reject: play() is refused as if the browser had said NotAllowedError (tests the stills + crossfade path) */
  reject: boolean
  /** ?phone-expose: window.__phone and the frame records for the tests, with whichever manifest is in use */
  expose: boolean
  /** ?phone-app: the phone shell on any device (tests on a desktop browser) */
  force: boolean
}
export const readFlags = (): Flags => {
  const q = new URLSearchParams(location.search)
  return { dev: q.has('phone-dev'), expose: q.has('phone-dev') || q.has('phone-expose'), reject: q.has('phone-reject'), force: q.has('phone-app') }
}

export interface Loaded { m: PhoneManifest; url(file: string): string }

export async function loadManifest(dev: boolean): Promise<Loaded> {
  const dir = dev ? '/phone-dev/' : '/phone/'
  const base = new URL(dir, location.origin)
  const res = await fetch(new URL('manifest.json', base))
  if (!res.ok) throw new Error(`manifest ${res.status}`)
  const m = await res.json() as PhoneManifest   // an SPA fallback page is not JSON: this throws, and the shell shows its failure notice
  if (!m || m.version !== 1 || !m.stops) throw new Error('manifest: unexpected shape')
  return { m, url: (file) => new URL(file, base).pathname }
}

export const stillKey = (id: string) => `stop:${id}`
export const windowKey = (id: string) => `window:${id}`
export const panKey = (a: string, b: string) => `pan:${a}>${b}`
export const openKey = (id: string) => `open:${id}`
export const closeKey = (id: string) => `close:${id}`
export const entranceKey = 'entrance'
