// Public routes and their SEO copy, read straight from the archive data (Node ≥ 22.18 strips
// TypeScript types on import). Adding an entry to src/casefile/data/entries.ts adds its route,
// sitemap line and prerendered page.
import { CERTIFICATIONS, CONTACT, ENTRIES, SUBJECT } from '../src/casefile/data/entries.ts'
import { SELECTED, THESIS } from '../src/casefile/data/story.ts'

const pages = ENTRIES.filter((e) => (e.kind === 'case' || e.kind === 'service' || e.kind === 'education' || e.kind === 'restricted') && e.seo)

/** Canonical origin: absolute URLs are required for share cards (LinkedIn, iMessage, Slack). An env value
 *  that points at a *.vercel.app alias (the project's old address) is ignored: the canonical is the domain. */
const fromEnv = (process.env.VITE_SITE_URL || process.env.SITE_URL || '').replace(/\/$/, '')
const aliasHost = (u) => { try { return new URL(u).hostname.endsWith('.vercel.app') } catch { return true } }
export const SITE_URL = fromEnv && !aliasHost(fromEnv) ? fromEnv : 'https://yaotingw.com'
export const OG_IMAGE = { path: '/og-card.jpg', width: 1200, height: 630, alt: 'Yaoting Wang, Security Analyst: portfolio home' }

export const routes = [
  { route: '/', entry: SUBJECT, title: SUBJECT.seo.title, description: SUBJECT.seo.description },
  ...pages.map((e) => ({ route: `/projects/${e.slug}`, entry: e, title: e.seo.title, description: e.seo.description })),
]
export const entries = ENTRIES
export { CERTIFICATIONS, CONTACT, SELECTED, THESIS }
