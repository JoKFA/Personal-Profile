# DESIGN.md — Yaoting Wang Portfolio v3 · "Encrypted Archive"

Canonical design system for the v3 site.
Direction: **a warm paper archive seen through a telephoto lens; security shown by behaviour, not decoration.**
Audience: Canadian HR and networking contacts. All UI copy is English.

> Visual source of truth: the approved prototype `.codex-runtime/design/casefile/`.
> Implementation spec (state machines, data model, budgets, acceptance): `docs/casefile-spec.md`.
> If this file and the prototype disagree, the prototype wins; update this file.
> Motion and camera are ported from RhineLabUI (MIT, github.com/LBEILC/RhineLabUI).

---

## Principles

1. **One world.** The archive, the file pages, and the entry all live in the same warm milk-grey space. No hard cuts, no second theme.
2. **The label is the permission.** A record the reader can read shows plaintext and an olive tab; everything else stays ciphertext. Height never encodes access.
3. **Security is felt, not explained.** Integrity check, decrypt sweep, 3-pass wipe, UEBA, and the AI guard are interactions, never jargon the reader must decode.
4. **Nothing to solve.** Everything is readable by default. "Hiring for" narrows the view; it never gates the content.
5. **Every claim has a source.** Numbers come from the resume fact database, never from the design.
6. **No clutter.** Every UI element and every line of information serves one purpose: showing who Yaoting is and what he can do in cybersecurity. If it does not help an HR reader understand that faster, it goes. Design polish and wow come after that.

## Rejected — do not bring back

- Encoding access as card height.
- A visible TOKEN / JWT / scope claim (`ai.read`, `profile.read`, …) anywhere in the UI.
- A forced role choice at entry.
- Dark neon / cyberpunk styling.
- Small text printed on 3D objects.

---

## Color Tokens

```css
:root {
  --bg:     #e7e4dd;  /* warm milk-grey page */
  --bg2:    #dedad2;  /* hover, index rows */
  --ink:    #16171a;  /* primary text, primary buttons */
  --ink2:   #4a4b48;  /* body text */
  --ink3:   #8a887f;  /* decorative labels only (2.8:1, not for meaningful text) */
  --hair:   rgba(22,23,26,.14);
  --hair2:  rgba(22,23,26,.28);
  --acc:    #74861a;  /* olive: readable, in scope, verified */
  --alert:  #d9431c;  /* denied, destroyed, threat */

  /* demo "screens" inside file pages only */
  --screen: #111413; --screen2: #181c1a; --srule: #262d29;
  --stext:  #d4ddd6; --sdim: #7a877f;
  --phos:   #b9ef3a; /* pass */
  --packet: #7cc7ff; /* data in flight */
}
```

**Rules**
- Olive means "readable / verified". Red means "denied / destroyed / threat". Nothing else uses them.
- Dark surfaces exist only as demo screens inside a file page. The world itself is never dark.
- 3D palette (paper, tabs, floor, fog) lives in `src/casefile/scene/palette.ts`; tab colours: olive = cleared case file, blue-grey `#5b7a93` = experience, paper = sealed, ink `#26241f` = restricted, red = shredded.

---

## Typography

| Font | Use |
|---|---|
| Manrope (200–800) | Names, headings, body, buttons |
| JetBrains Mono (400–600) | Labels, IDs, hashes, terminals, demos |

- Self-hosted woff2 (Latin subset). No Google Fonts request: the site tells visitors nothing leaves their browser.
- Mono is for chrome and evidence, never for paragraphs.
- Labels: Mono 500 · 10.5px · letter-spacing .14em · uppercase.
- Big numbers use Manrope 200; headings use Manrope 800.

| Element | Size | Weight |
|---|---|---|
| Entry conclusion | clamp(34px, 5.3vw, 84px) | 800 |
| File page H1 | clamp(36px, 4.1vw, 66px), uppercase | 800 |
| Panel file number | clamp(24px, 2.35vw, 36px) | 800 |
| Name lockup | clamp(22px, 2.15vw, 33px) | 800 |
| Body | 15.5–17px, line-height 1.55–1.68 | 400–500 |

---

## Space & Layout

- Gutter `--g: clamp(18px, 3.3vw, 56px)`. Top baseline `clamp(22px, 4.6vh, 48px)`, bottom baseline `clamp(22px, 3.8vh, 40px)`.
- HUD elements are pinned to the corners and the bottom centre; they must never overlap at any width (checked in E2E).
- No horizontal page scroll at any width. Touch targets ≥ 44×44.

---

## World & Camera

- 9 drawers × 32 records of paper dossiers, standing face-to-face, wrapping infinitely.
- Telephoto camera: yaw 59°, elevation 19°, distance 140, span 7.33. Opening a file pushes in to distance 72, span 5.9.
- One continuous height field breathes across the archive; selecting a record sends a ripple outward immediately.
- 3D carries shapes and short printed labels only (ID, kind, one line). All reading happens in DOM.

## Motion

- Critically damped springs everywhere; no linear tweens for spatial movement.
- Ported functions: `settlingWave`, `selectionWave`, `columnStrength`, `idleWave`, `damp` (parameters in the spec, §3).
- Signature sequences: open (lift → SHA-256 check → cover opens → page pulls out → ciphertext sweeps to plaintext), close (page returns → cover closes → card settles), destroy (3-pass overwrite 0x00 / 0xFF / random → key zeroized → page collapses).
- `prefers-reduced-motion`: no waves, springs snap, sweeps and wipes show their end state.

## Voice

- Plain English an HR reader understands on first read. Security words only where they carry meaning ("integrity verified", "re-encrypted").
- Short, declarative, first person in case files; no hype, no "passionate".
- Never claim more than the fact database allows (no inflated numbers, no named private clients).

---

## Accessibility

- Canvas is decorative; every record and file is reachable from the DOM Index and by keyboard (←→↑↓, Enter, Esc, `/`).
- File pages are dialogs with focus management.
- Meaningful text ≥ 4.5:1 contrast.
- Works without WebGL (Index + file pages).
