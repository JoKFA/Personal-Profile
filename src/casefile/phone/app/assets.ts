// Where the pictures come from: the bake's manifest (public/phone/manifest.json). Sizes are always read from the manifest.
import type { PhoneManifest } from '../manifest'
import { hookFlags } from '../../flags'
import { takeManifest } from './early'

/** the test hooks the shell honours (flags.ts lists them; a production build has none of them) */
export interface Flags {
  /** window.__phone and the frame records, for the tests and the dev tools */
  expose: boolean
  /** play() is refused as if the browser had said NotAllowedError (the stills + crossfade path) */
  reject: boolean
}
export const readFlags = (): Flags => { const f = hookFlags(); return { expose: f.expose, reject: f.reject } }

export interface Loaded { m: PhoneManifest; url(file: string): string }

export async function loadManifest(): Promise<Loaded> {
  const base = new URL('/phone/', location.origin)
  const early = takeManifest()   // (the request App started when it chose the shell, if there is one)
  const res = (early && await early.catch(() => null)) || await fetch(new URL('manifest.json', base))
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
