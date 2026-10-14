// Started by App.tsx the moment it has chosen the phone shell (before React has rendered anything): the shell's chunk, the entry page's chunk
// (a first visit only) and the manifest are asked for side by side. Without this each waits for the one before it: on a slow network the entry page
// would not be painted until the shell's code had arrived and run. Nothing here is heavy: this file is in the entry chunk.
let manifest: Promise<Response> | null = null

export function warmPhone() {
  try {
    const q = new URLSearchParams(location.search)
    if (q.has('phone-dev')) return
    void import('./PhoneApp')
    const first = !/^\/projects\//.test(location.pathname) && (q.has('intro') || localStorage.getItem('yw.entry') !== '1')
    if (first) void import('./gate/PhoneGate')
    manifest = fetch('/phone/manifest.json')
    manifest.catch(() => { manifest = null })
  } catch { /* the shell asks for what it needs itself */ }
}
/** the manifest request App started (once); null when there is none */
export const takeManifest = () => { const m = manifest; manifest = null; return m }
