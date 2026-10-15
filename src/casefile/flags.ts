// The one place the site's query flags are read (scene/quality.ts reads `quality` and `dpr` beside the quality ladder it belongs to).
//
// In a production build:
//   ?intro             the entry (the fingerprint) plays again for a returning visitor        user-facing, harmless
//   ?quality=low|mid|high   a render-quality tier instead of the automatic one                   user-facing, harmless (scene/quality.ts)
// Everything else is a test or measuring hook and exists only where HOOKS is true (the dev server, `--mode bake`, a build made with VITE_HOOKS=1):
//   ?bake              the phone bake's director on the desktop archive (scene pixels only)      (LAB)
//   ?phone             the prototype lab: the same director with the prototype's page over it   (LAB)
//   ?phone-app         the phone shell on any device
//   ?phone-expose      window.__phone and the frame records
//   ?phone-reject      play() refused as if the browser had said NotAllowedError (the stills path)
// A production build ignores those four and does not even contain the code that would read them.
import { HOOKS } from './scene/lab'

const query = (): URLSearchParams => { try { return new URLSearchParams(location.search) } catch { return new URLSearchParams() } }

/** ?intro: the entry plays again */
export const introRequested = (): boolean => query().has('intro')

export interface HookFlags { bake: boolean; lab: boolean; phoneApp: boolean; expose: boolean; reject: boolean }
const OFF: HookFlags = { bake: false, lab: false, phoneApp: false, expose: false, reject: false }
export const hookFlags = (): HookFlags => {
  if (!HOOKS) return OFF
  const q = query()
  return { bake: q.has('bake'), lab: q.has('phone'), phoneApp: q.has('phone-app'), expose: q.has('phone-expose'), reject: q.has('phone-reject') }
}
