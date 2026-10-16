// Started by App.tsx the moment it has chosen the phone shell (before React has rendered anything): the shell's chunk, the entry page's chunk
// (a first visit only) and the manifest are asked for side by side. Without this each waits for the one before it: on a slow network the entry page
// would not be painted until the shell's code had arrived and run. Nothing here is heavy: this file is in the entry chunk.
import { introRequested } from '../../flags'
// The springs are shared by the desktop's archive and the phone's chunks: re-exported here, the module is in this (the entry) chunk, which both already load, and not in a chunk of its own.
export { approach, damp, spring } from '../../motion/spring'

let manifest: Promise<Response> | null = null

export function warmPhone() {
  try {
    void import('./PhoneApp')
    const first = !/^\/projects\//.test(location.pathname) && (introRequested() || localStorage.getItem('yw.entry') !== '1')
    if (first) void import('./gate/PhoneGate')
    manifest = fetch('/phone/manifest.json')
    manifest.catch(() => { manifest = null })
  } catch { /* the shell asks for what it needs itself */ }
}
// The shell's own lazy chunks are asked for from here, in the entry chunk: a dynamic import made inside a lazy chunk would pull Vite's import helper out into a chunk of its own,
// which the desktop would then load before its first paint (it is inlined in the entry, as it was before the phone shell).
export const loadPhoneGate = () => import('./gate/PhoneGate')
export const loadFileChunks = () => Promise.all([import('./file/fileview'), import('./file/mount')])
export const loadSpaceChunk = () => import('./space/PhoneSpace')
export const loadSpaceMount = () => import('./space/mount')
/** the manifest request App started (once); null when there is none */
export const takeManifest = () => { const m = manifest; manifest = null; return m }
