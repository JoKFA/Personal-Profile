# DESIGN.md — Yaoting Wang Portfolio v2

Canonical design system for the v2 rebuild.
Direction: **Hacker DNA, Editorial Execution, Student Voice**
References: Linear, Vercel, Stripe Engineering, Rauno's blog.
Anti-references: terminal-clone portfolios, neon-hacker-stock aesthetic.

> Source of truth for implementation. All tokens come from the approved wireframe
> (`public/home-wireframe.html`). If DESIGN.md conflicts with the wireframe, the
> wireframe wins — update this file.

---

## Color Tokens

```css
:root {
  --bg:           #0b0f14;   /* page background */
  --bg-soft:      #0d1117;   /* hover tint on project cards, featured card bg */
  --surface:      #0f1520;   /* elevated surfaces if needed */
  --border:       rgba(255,255,255,0.08);   /* default borders, section dividers */
  --border-strong:rgba(255,255,255,0.14);   /* nav CTA border, interactive borders */
  --text:         #e6edf3;   /* primary text, headings, emphasis */
  --text-muted:   #8b949e;   /* body text, secondary labels */
  --text-dim:     #546273;   /* section numbers, metadata, decorative labels */
  --accent:       #7ee787;   /* desaturated green — primary accent */
  --accent-dim:   rgba(126,231,135,0.14); /* hover bg on accent-bordered elements */
  --error-soft:   #ff6b6b;   /* form validation errors, inline error messages */
}
```

**Rules:**
- No other colors. Dark theme only. No light mode toggle.
- `--accent` is `#7ee787` (desaturated green). NOT `#00ff88` neon — that's the old V1.
- `--text-dim` is DECORATIVE ONLY for labels/metadata. Do not use for body text (fails WCAG).
- `--text-muted` (#8b949e) on `--bg` (#0b0f14): ~5.1:1 contrast (passes AA for normal text).
- `--text` (#e6edf3) on `--bg` (#0b0f14): ~14:1 contrast (passes AAA).

---

## Typography

**Two fonts only. No others.**

| Font | Use |
|---|---|
| Inter | Body text, headings, positioning copy, experience bullets |
| Fira Code | Labels, tags, metadata, section numbers, nav brand, nav CTA, chips, `[tag]` syntax |

**Never use Fira Code for body copy.** It is an accent font for UI chrome only.

### Type Scale

| Element | Size | Weight | Font | Letter-spacing |
|---|---|---|---|---|
| Hero name (`<h1>`) | 88px | 600 | Inter | -0.04em |
| Project title (case study `<h1>`) | 56px | 600 | Inter | -0.03em |
| Section titles | 32px | 600 | Inter | -0.02em |
| Contact heading | 56px | 600 | Inter | -0.03em |
| CS section headings (`<h2>`) | 24px | 600 | Inter | -0.02em |
| Project card title | 20px (featured: 28px) | 600 | Inter | -0.01em |
| Experience role | 17px | 500 | Inter | default |
| Body / positioning | 15px | 400 | Inter | -0.01em |
| Project summary | 19px | 400 | Inter | default |
| Hero positioning | 22px | 400 | Inter | default |
| Nav links | 13px | 400 | Inter | default |
| Eyebrow / section number | 11–12px | 400 | Fira Code | 0.08–0.12em |
| Tags `[tag]` | 10–11px | 400 | Fira Code | 0.04em |
| Nav brand | 13px | 400/500 | Fira Code | 0.02em |
| Chips | 11px | 400 | Fira Code | 0.02em |

**Line heights:** 1.6 body, 1.55 summaries, 1.4 labels, 0.95–1.05 hero name.

---

## Layout

- Single column, centered, max-width **1180px**, `padding: 0 48px` (mobile: `0 20px`)
- Left-aligned content within the centered container
- `80–100px` vertical gaps between sections
- **Sharp corners: 0px border-radius everywhere.** No exceptions.
- Section dividers: `1px solid var(--border)`, full-width

### Home Page Sections

```
NAV
HERO (120px top padding, 2-col grid: 1.6fr + 1fr)
  └─ Left: eyebrow + 88px name + positioning + chips
  └─ Right: sidebar signals (// now · // recent · // studying)
PROJECTS (id="work")
  └─ Section head: "01 / work" + "Selected projects"
  └─ Gallery: 3-col CSS grid, 1px gap, featured spans 2 cols (REQUIRED)
EXPERIENCE (id="experience")
  └─ 3-col horizontal rows: org (Fira Code) | role + bullet | period
CONTACT (id="contact")
  └─ 2-col grid: 1.2fr + 1fr
  └─ Left: big heading + copy
  └─ Right: channel list (Fira Code, border-bottom per channel)
FOOTER
```

### Case Study Page Sections

```
NAV (same as home)
BACK BAR (← back to work → /#work)
PROJECT HEADER (72px top padding)
  └─ eyebrow (Fira Code) + 56px title + summary + meta row + tags
CASE BODY (2-col grid: 1fr + 280px, 80px gap)
  └─ Content col: 01/problem · 02/approach · 03/results
     Each: Fira Code label + heading + body paragraphs + numbered highlights
  └─ Sidebar (sticky): stack tags · ghost links · timeline · context
  └─ Mobile: sidebar collapses BELOW content (depth-first)
NEXT PROJECT (full-width card, accent hover)
FOOTER
```

---

## UI Components

### Ghost Buttons / Sidebar Links
- `1px solid var(--border)` background transparent
- Hover: `border-color: var(--accent)`, `color: var(--text)`
- Fira Code, 12px, sharp corners

### Project Cards
- Background: `var(--bg)`, `1px solid var(--border)` via CSS grid gap trick
- Hover: background → `var(--bg-soft)`
- Featured card: `grid-column: span 2`, background `var(--bg-soft)` always
- Entire card is a link (`<a>` wraps `<article>`)
- No box-shadow. No rounded corners.

### Tags `[tag]`
- Fira Code 10–11px, `var(--text-dim)`
- `::before { content: "[" }` `::after { content: "]" }`
- No borders, no backgrounds — pure typographic

### Status Chip (case study)
- `1px solid var(--accent)`, `color: var(--accent)`, Fira Code 10px
- Padding: 4px 10px, sharp corners

### Section Numbers
- Pattern: `01 / work`, `02 / experience`, `03 / contact`
- Fira Code 12px, `var(--text-dim)`, letter-spacing 0.1em

### Focus Ring
- `2px solid var(--accent)` on all keyboard-focusable elements
- Offset: 2px

---

## Navigation

**3 links:** `work` · `experience` · `contact`
- `work` → `/#work` (home anchor) or stays on home
- `experience` → `/#experience` (home anchor)
- `contact` → `/#contact` (home anchor)
- All 3 are scroll-anchor links, not routes
- On case study page: all 3 links point to `/#section` (navigate home then scroll)
- Right: `resume.pdf →` ghost button (Fira Code, opens in new tab)
- Nav brand: `yaoting.wang / portfolio` in Fira Code

---

## Contact Form States

| State | What user sees |
|---|---|
| Default | Fields + textarea + submit button |
| Loading (after submit) | Button text → "sending..." + disabled |
| Success | Form area fades out → Fira Code text: `// message received` + email as fallback |
| Error (network/500) | Inline below button: `// submission failed — try felixwang1222@gmail.com` in `--error-soft` |
| Validation (bad input) | Red border + inline label on invalid field |

---

## Motion

Motion is allowed where it reinforces identity or adds function. The only hard rules
are performance and accessibility — everything else is a judgement call.

### Rules (non-negotiable)

- Wrap all Framer Motion / JS-driven animations in `prefers-reduced-motion` check
- Animate only `transform`, `opacity`, `filter`, `clip-path`, `outline` — never `width`,
  `height`, `top`, `left`, `margin`, `box-shadow` (layout / paint thrash)
- No animation longer than 600ms on first paint; no looping animation that runs forever
  without purpose (the status-strip pulse is the ceiling — one tiny dot, 2.4s)
- No simultaneous animations at first load — pick ONE signature moment, stagger everything else
- Intersection-observer gated: off-screen elements must not animate
- Must hit 60fps on mid-tier mobile (Moto G / iPhone 11 baseline). Use DevTools paint flashing
  to verify. If it paints a large area continuously, it's out.
- Total animated JS payload (framer-motion + anything custom) stays under 40KB gzipped

### Defaults

- **Scroll reveal:** opacity 0 → 1, translateY 12px → 0, 400ms ease-out
- **Card hover:** 0.2s ease, transform + outline only
- **Link hover:** 0.15s ease, color / opacity only
- **Signature moment (max one per session):** e.g., name scramble on first load, 80-150ms total

### What's encouraged

- Interactive surfaces that respond to input (terminal REPL, command palette, hover reveals)
- Micro-motion that signals state (focus rings, pulsing "live" dot, accent appearing on hover)
- Canvas or WebGL is fine IF it's gated to user interaction (not always-on backgrounds)

### What to avoid

- Matrix rain, cursor trails, particle backgrounds that run forever
- Typewriter effect on static body copy (it's slower to read than just showing the text)
- Entrance animations on every section (a signature moment is fine; a carnival isn't)

---

## Accessibility

- `--text-muted` (#8b949e) on `--bg`: 5.1:1 (AA pass for normal text, 14px+)
- `--text` (#e6edf3) on `--bg`: 14:1 (AAA)
- `--text-dim` (#546273) on `--bg`: ~2.8:1 — DECORATIVE ONLY (Fira Code labels, not readable content)
- `--accent` (#7ee787) on `--bg`: ~8.4:1 (AA pass — safe for focus rings and accents)
- Minimum touch target: 44px height on all interactive elements (mobile)
- All interactive elements keyboard-navigable
- ARIA landmarks: `<nav>`, `<main>`, `<footer>`, `<section>` with labels
- Images (if added in v2): `alt` text required

---

## What NOT to do

- No `#00ff88` neon green — that's V1, dead
- No Fira Code as body font — accent only
- No border-radius on anything
- No box-shadows
- No decorative blobs, waves, or SVG dividers
- No centered text (use left-aligned throughout)
- No icon-in-circle decoration
- No colored left-border on cards
- No `system-ui` or `-apple-system` as primary font — Inter loads from Google Fonts
