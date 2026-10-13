// URLs (plan §2.5/2.6): "/" is browsing (replaceState, never a history entry per stop); "/projects/:slug" is an open file (pushState).
import { entryById, entryBySlug } from '../../data/entries'

export const slugFromPath = (p: string) => p.match(/^\/projects\/([^/]+)\/?$/)?.[1] ?? null
export const idFromPath = (p: string) => { const s = slugFromPath(p); return s ? entryBySlug.get(s)?.id ?? null : null }
export const pathOfId = (id: string) => { const e = entryById.get(id); return e ? `/projects/${e.slug}` : '/' }
/** history state marker: entries this shell pushed itself (a button-close can go back through them) */
export const PUSHED = 'ph-file'
export const pushFile = (id: string) => history.pushState({ ph: PUSHED }, '', pathOfId(id))
export const toBrowse = () => history.replaceState(null, '', '/')
export const pushedByUs = () => (history.state as { ph?: string } | null)?.ph === PUSHED
