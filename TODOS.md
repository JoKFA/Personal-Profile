# TODOS.md — Portfolio v2 Rebuild

Generated from /plan-eng-review + /plan-design-review (2026-04-20).
See plan doc: `~/.gstack/projects/PersoanlProfile/User-master-design-20260419-235116.md`
See DESIGN.md for visual specs. See wireframes: `public/home-wireframe.html`, `public/case-study-wireframe.html`

---

## Week 1 — Deletions + Scaffolding (Worktree A)

- [ ] **T1** Delete: `BriefingSelector`, `BriefingPill`, `BriefingContext`, `CTFLab`, `CTFTerminal`, `CertificationsList`, `LanguageToggle`, `LanguageContext`
- [ ] **T2** Delete: `src/pages/Experience.tsx`, `src/pages/Resume.tsx`
- [ ] **T3** Delete: `src/i18n/`, `public/locales/zh/`, `api/ctf/`
- [ ] **T4** Remove deps: `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `i18next-http-backend`, `xterm`, `tailwindcss`, `@tailwindcss/vite`
- [ ] **T5** Delete failing tests: `BriefingSelector.test.tsx`, `CTFTerminal.test.tsx`, `BriefingContext.test.tsx`, `e2e/briefing.spec.ts`, `e2e/ctf.spec.ts`, `src/test/test-i18n.ts`
- [ ] **T6** Rewrite `DESIGN.md` — DONE (2026-04-20, canonical tokens + component specs written)

## Week 1 — Home Page Rebuild (Worktree B)

- [ ] **T7** Rewrite `src/index.css`: CSS custom properties from DESIGN.md tokens, Inter + Fira Code imports, remove all Tailwind utility classes
- [ ] **T8** Rewrite `src/pages/Home.tsx`: hero grid + projects gallery + experience snapshot + contact
  - Hero eyebrow: `// MASc Cybersecurity · SFU · 2026`
  - Featured project card MUST span 2 cols (`grid-column: span 2`)
  - Entire project `<article>` wrapped in `<a>` (full-card link)
  - Hero signals (`// now`, `// recent`, `// studying`): static strings from `profile.ts`
- [ ] **T9** Update `src/App.tsx`:
  - Routes: `/` and `/projects/:slug` only
  - Catch-all `*` → redirect to `/`
  - Hash alias map: `#capabilities→#work`, `#experience→#experience`, `#briefing→#contact`, `#ctf→#work`
  - Framer Motion `AnimatePresence` wrapper for 200ms fade page transitions
- [ ] **T10** Update `src/components/NavBar.tsx`:
  - 3 scroll-anchor links: `work` (`/#work`) · `experience` (`/#experience`) · `contact` (`/#contact`)
  - Resume PDF ghost button (right)
  - **Mobile: hamburger drawer** — 3-line icon, full-width dark overlay, stacked links
    - `aria-label="open navigation"`, `role="dialog"` on drawer, focus trap when open
  - Strip i18n, strip language toggle, strip briefing selector
- [ ] **T11** Update `src/components/ContactForm.tsx`:
  - Loading state: button → "sending..." + `disabled`
  - Success state: form fades out → Fira Code text `// message received` + email fallback
  - Error state: inline `--error-soft` below button: `// submission failed — try felixwang1222@gmail.com`
  - Field validation: red border + inline label (empty required, invalid email)
  - **What:** Adds 3 interaction states missing from current implementation
  - **Why:** Without states, users don't know if submit worked or failed
  - **Pros:** Fixes dead-form UX, matches DESIGN.md spec, extends existing test coverage
  - **Cons:** ~20min CC work, adds Framer Motion fade to form area
  - **Depends on:** T7 (CSS tokens), T9 (App routing)

## Week 1 — Design Artifacts (parallel)

- [ ] **T12** Update `public/case-study-wireframe.html`:
  - `back link href="/#work"` (not `/`)
  - `aria-hidden="true"` on all `// label` and `01 / section` decorative spans
  - Add comment: "next project: sequential from projects.ts, wraps around"
  - **What:** Keeps wireframe accurate as implementation reference
  - **Why:** Implementer reads wireframe + DESIGN.md; mismatches cause drift
  - **Depends on:** None (standalone HTML file)

## Week 2 — Case Study Page (Worktree C)

- [ ] **T13** Rewrite `src/pages/ProjectCaseStudy.tsx`:
  - Back bar: `← back to work` → `/#work`
  - Project header: eyebrow + 56px title + summary + meta row + tags
  - Two-column body: `1fr + 280px` sidebar, 80px gap
  - Content col: 01/problem · 02/approach · 03/results (numbered highlights)
  - Sidebar (sticky desktop, below content mobile): stack tags + ghost links + timeline + context
  - Next project card: sequential by `projects.ts` order, wraps around
  - Remove: `BriefingSelector`, `pickText`, `useLanguage`, `useTranslation`
  - Page transitions: wrapped in Framer Motion (see T9)
- [ ] **T14** Collapse `src/data/projects.ts`: single `description` per project (drop 4-role blocks)
- [ ] **T15** Simplify `src/data/profile.ts`: drop `briefingOptions`, `currentFocus`, `leadershipExperience`; keep static `// now / // recent / // studying` signals
- [ ] **T16** Patch `scripts/generate-seo.mjs`: auto-derive slugs from `projects.ts`, drop `/experience` + `/resume`
- [ ] **T17** Patch `scripts/generate-prerender.mjs`: same — auto-derive, drop cut routes

## Week 2 — Tests (Worktree D)

- [ ] **T18** Simplify `src/test/render.tsx`: drop i18n/briefing/language providers, keep `MemoryRouter` only
- [ ] **T19** Add `hash-alias.test.tsx`: tests App.tsx hash handler — 5 aliases
- [ ] **T20** Adapt `ContactForm.test.tsx`: drop i18n wrapper, add 429 + 500 error branch tests
- [ ] **T21** Adapt `ProjectCard.test.tsx`: drop i18n wrapper
- [ ] **T22** Rewrite `e2e/routes.spec.ts`: `/` renders; `/projects/mcp-security-framework` renders; `/experience` + `/resume` redirect to `/`; invalid slug redirects
- [ ] **T23** Rewrite `e2e/mobile-nav.spec.ts`: hamburger toggle + 2 nav links navigate
- [ ] **T24** Add `e2e/case-study.spec.ts`: each slug renders headline + section heading
- [ ] **T25** Add `e2e/style-tokens.spec.ts`: `--bg`, `--ink`, `--accent` present on `:root`; Fira Code not on `body`
- [ ] **T26** Add unit tests for `generate-seo.mjs` and `generate-prerender.mjs`

## Week 2 — Ship

- [ ] **T27** Local verify: `bun dev`, `bun test`, `bun test:e2e`, `bun run build`
- [ ] **T28** Deploy preview on Vercel; smoke: `/`, `/projects/:slug`, `/experience` (→ redirect), invalid slug (→ redirect)
- [ ] **T29** Update `public/og-card.svg` if needed (current one may reference old palette)
- [ ] **T30** Add URL to resume PDF + LinkedIn

---

## Accessibility Checklist (before ship)

- [ ] `aria-hidden="true"` on all `// label` and `01 / section` decorative Fira Code spans
- [ ] ARIA landmarks: `<nav aria-label="site">`, `<main>`, `<footer>`, `<section aria-label="...">` per section
- [ ] Focus ring: `2px solid var(--accent)` on all interactive elements
- [ ] Mobile touch targets: all buttons/links ≥ 44px height
- [ ] Hamburger drawer: focus trap, `role="dialog"`, ESC to close
- [ ] Framer Motion: all animations wrapped in `prefers-reduced-motion` check
- [ ] Contrast audit: `--text-muted` on `--bg` = 5.1:1 ✓, `--text` = 14:1 ✓

---

## Post-Ship (v2)

- [ ] Add project screenshots / visual embeds to case study pages
- [ ] Visual anchor on case study page header (2px accent line or faded project number watermark)
- [ ] Custom domain migration (currently: vercel.app subdomain)
- [ ] Photography / personal portrait if desired
- [ ] OG card refresh with new palette
