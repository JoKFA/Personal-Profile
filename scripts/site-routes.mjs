// Public routes and their SEO copy, read straight from the archive data (Node ≥ 22.18 strips
// TypeScript types on import). Adding an entry to src/casefile/data/entries.ts adds its route,
// sitemap line and prerendered page.
import { ENTRIES, SUBJECT } from '../src/casefile/data/entries.ts'

const pages = ENTRIES.filter((e) => (e.kind === 'case' || e.kind === 'service' || e.kind === 'restricted') && e.seo)

/** Canonical origin: absolute URLs are required for share cards (LinkedIn, iMessage, Slack). */
export const SITE_URL = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://personal-profile-alpha-cyan.vercel.app').replace(/\/$/, '')
export const OG_IMAGE = { path: '/og-card.jpg', width: 1200, height: 630 }

export const routes = [
  { route: '/', entry: SUBJECT, title: SUBJECT.seo.title, description: SUBJECT.seo.description },
  ...pages.map((e) => ({ route: `/projects/${e.slug}`, entry: e, title: e.seo.title, description: e.seo.description })),
]
export const entries = ENTRIES
