// The entry (spec §30): the visitor's browser fingerprint, drawn as a real fingerprint and read by a
// scan line → its four readings, each with what an attacker does with it → sealed: the readings turn
// to cipher, the print is pulled into the 16 × 16 bits of its SHA-256 → the white field the archive
// slides into (handoff.ts). One canvas and a few positioned labels, all driven by one clock `t`.
// On a phone (`phone` given, plan M1 P4) the same page is *held*: the visitor's finger reads the print and drives `t` on a compressed clock (see HOLD).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Visitor } from '../visitor'
import { handover } from './handoff'
import { buildMorph, buildPrint, clamp, eio, eout, lerp, mulberry32, paintPrint, seg, sha256, sstep, type Inked, type Morph, type Print } from './fingerprint/print'
import '../styles/gate.css'
import '../styles/fingerprint.css'

const HEX = '0123456789abcdef'
const PAPER = '#e7e4dd', INK = '#16171a', THREAT = '#a33b22', OLIVE = '#5c6b12'
/** seconds */
const T = {
  read: [0.35, 2.75], cap1: 0.5, sub1: 1.85, prof: 2.9,
  seal: 4.4, sealScan: [4.4, 4.95], cap3: 4.6, morph: 5.0, labelsOut: [5.15, 5.55], hash: [5.5, 5.95],
  // (the scene is built in small steps from the first frame, while all this plays: onBuild)
  title: 5.95, end: 6.6,
} as const
/** The phone's hold-to-verify mode: the same page, a different clock (nothing here exists on the desktop). */
export interface PhoneDrive {
  /** the line under the print */
  label: string
  /** every pointerdown on the page (the first one unlocks the video pool) */
  onPress(first: boolean): void
  /** the seal is on screen and the page stays on it: the host takes the page over from here */
  onSealed(e: { root: HTMLElement; skipped: boolean }): void
}
/** Holding: [from t, to t, seconds of holding it takes], 2.0 s from the first touch to the seal; then the sealed page rests briefly and leaves. */
const HOLD: [number, number, number][] = [[0, T.prof, 0.75], [T.prof, T.seal, 0.55], [T.seal, 6.15, 0.7]]
const HOLD_END = HOLD[HOLD.length - 1][1]
/** the phone's bracket stands this far under the print, so that the hold line sits between the print and the bracket's lower marks, clear of both */
const BRACKET_BELOW = 30
/** no touch for this long and the page plays itself at the desktop's pace */
const IDLE_S = 3
const holdRate = (tt: number) => { for (const [a, b, d] of HOLD) if (tt < b) return (b - a) / d; return 1 }
const PHASES: [string, number][] = [['Read', T.read[0]], ['Profile', T.prof], ['Seal', T.seal]]
const AIMS = ['Match a known exploit', 'Time a phishing email', 'Write the lure in your language', 'Fit a fake sign-in to your screen']
const LABELS = ['System', 'Local time', 'Language', 'Display']

function language(tag: string) {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag } catch { return tag }
}

interface Layout {
  /** a phone-width screen (type and the sentence follow the phone's rules) */
  W: number; H: number; phone: boolean
  /** the four readings sit under the print in a 2 × 2 grid (a phone, or no room for a column beside it) */
  /** columns of the stacked readings: 2 × 2, or one row of four where the window is wide */
  stack: boolean; cols: number; g: number; top: number
  /** the phone's short layout: the head is squeezed and Skip stands on the small line's row (so the print keeps the room the way out had) */
  tight: boolean
  print: { cx: number; cy: number; w: number; h: number }; labelX: number; labelTop: number; capBottom: number
  lat: { cx: number; cy: number; size: number }
}
function layout(hold = false, below?: number, tightRow = false): Layout {
  const W = innerWidth, H = innerHeight, phone = W < 760, g = Math.max(16, Math.min(56, W * 0.033)), top = Math.max(22, Math.min(48, H * 0.046))
  let print: Layout['print'] = { cx: 0, cy: 0, w: 0, h: 0 }, labelX = 0, labelTop = 0, capBottom = 0, stack = phone, layoutCols = 2, squeezed = false
  if (!phone) {
    // the print sits between the name (top left) and the sentence (bottom left) and touches neither
    const y0 = top + Math.max(96, H * 0.13), capTop = H - Math.max(118, H * 0.14)
    const ph = Math.min(H * 0.66, 700, capTop - 46 - y0), pw = ph * 0.7, labW = 290, gap = Math.max(90, W * 0.06)
    const left = Math.max(g + 290, (W - (pw + gap + labW)) / 2 + 30)
    print = { cx: left + pw / 2, cy: y0 + ph / 2, w: pw, h: ph }
    labelX = left + pw + gap; capBottom = H - 26
    // the column needs 290 px and a margin to its right; without them the readings go under the print
    stack = W < 1100 || W - labelX < 320
  }
  if (stack) {
    // top to bottom: name, print, the four readings, the sentence, the way out
    // (the phone's hold line sits between the print's brackets and the readings: 18 px more under the print; `below` is what the page then measures it needs under the print)
    let y0 = top + 92, cb = H - 84
    const cols = !phone && W >= 960 ? 4 : 2, rows = cols === 4 ? 112 : 2 * 80, extra = hold ? 18 : 0
    // (a short phone: the head and the foot give up room before the print does: the name is 49 px tall, the exhibit line sits 40 px over the print, the way out is 44 px)
    // (and when even that leaves the print under its usual size, the way out joins the small line's row: the sentence stands on the bottom margin)
    if (hold && below !== undefined && (tightRow || cb - y0 - below < 170)) { y0 = 97; cb = tightRow ? H - 22 : H - 76; squeezed = true }
    // (a short window may shrink the print below a phone's floor: the readings must stay off the sentence)
    const phFit = clamp(cb - 108 - 16 - rows - 20 - extra - y0, phone ? 170 : 120, Math.min(H * 0.42, W * 1.05))
    // (a phone that cannot hold all of it at the print's usual size gives the print what is left, down to 100 px: nothing may touch the sentence)
    const ph = hold && below !== undefined ? Math.min(phFit, Math.max(100, cb - y0 - below)) : phFit, pw = ph * 0.7
    layoutCols = cols
    print = { cx: W / 2, cy: y0 + ph / 2, w: pw, h: ph }
    labelX = g; labelTop = y0 + ph + 20 + extra; capBottom = cb
  }
  return { W, H, phone, stack, tight: squeezed, cols: layoutCols, g, top, print, labelX, labelTop, capBottom, lat: { cx: print.cx, cy: print.cy, size: print.w * 0.92 } }
}

export function Gate({ visitor, reduced, sceneReady, onBuild, onReveal, onStrike, onDone, phone }: {
  visitor: Visitor; reduced: boolean; sceneReady: boolean
  /** the phone shell: hold to verify (plan M1 P4); the desktop never passes it */
  phone?: PhoneDrive
  /** the entry is on screen: the archive can start to be built, a step at a time, under it */
  onBuild: () => void; onReveal: () => void
  /** `skipped`: the visitor left the entry before it had finished */
  onStrike: (skipped: boolean) => void; onDone: () => void
}) {
  const root = useRef<HTMLDivElement>(null), skipBtn = useRef<HTMLButtonElement>(null)
  const st = useRef<{ leaving: boolean; waiting: boolean; skipped?: boolean }>({ leaving: false, waiting: false })
  const leaveRef = useRef<() => void>(() => {})
  const sceneReadyRef = useRef(sceneReady)
  useEffect(() => { sceneReadyRef.current = sceneReady; if (sceneReady && st.current.waiting) leaveRef.current() }, [sceneReady])

  // what this browser tells every site, and the print's key: what stays the same between visits (not the clock)
  const { values, hex } = useMemo(() => {
    const lang = visitor.langs.split(',').map((s) => s.trim()).filter(Boolean)[0] ?? 'en'
    const browser = visitor.browser.replace(/^(Microsoft|Google|Mozilla|Apple)\s+/, '')
    const dpr = Math.round((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) * 100) / 100
    const values = [`${visitor.os} · ${browser}`, `${visitor.time} · ${visitor.city}`, language(lang), `${visitor.screen} · ${dpr}×`]
    return { values, hex: sha256([visitor.os, visitor.browser, visitor.tz, visitor.langs, visitor.screen, dpr].join('|')) }
  }, [visitor])

  useLayoutEffect(() => {
    const r = root.current!, cv = r.querySelector<HTMLCanvasElement>('.fp-canvas')!, ctx = cv.getContext('2d')!
    const q = <E extends HTMLElement = HTMLElement>(s: string) => r.querySelector<E>(s)!
    const mis = [...r.querySelectorAll<HTMLElement>('.fp-mi')], valEls = mis.map((m) => m.querySelector<HTMLElement>('.v')!)
    const bits: number[] = []; for (let k = 0; k < 64; k++) { const v = parseInt(hex[k], 16); for (let b = 3; b >= 0; b--) bits.push((v >> b) & 1) }
    const groups = hex.match(/.{8}/g)!, hashText = groups.slice(0, 4).join(' ') + '\n' + groups.slice(4).join(' ')
    let L: Layout, P: Print, ink: Inked, morph: Morph, grain: CanvasPattern | null = null
    let labelY: number[] = [], scanAt: number[] = []
    let t = reduced ? T.end : 0, last = performance.now(), raf = 0, started = false, done = false
    // the phone's hold: where the finger is (the print is read outward from it), whether it is down, and the idle clock
    const PH = phone
    let pressed = false, pid = -1, auto = false, touchAt = performance.now(), shownAt = 0, appear = 0, pressedOnce = false
    let reach: { x: number; y: number; max: number } | null = null
    let bracketHalf = 0
    let numPos: { x: number; y: number }[] = []

    const scanY = (tt: number) => { const pr = L.print, k = eio(seg(tt, T.read[0], T.read[1])); return lerp(pr.cy - pr.h / 2 - 18, pr.cy + pr.h / 2 + 18, k) }
    const timeForScan = (y: number) => { for (let i = 0; i <= 400; i++) { const tt = lerp(T.read[0], T.read[1], i / 400); if (scanY(tt) >= y) return tt } return T.read[1] }
    const reachR = (tt: number) => (reach ? reach.max * eio(seg(tt, T.read[0], T.read[1])) : 0)
    const timeForReach = (x: number, y: number) => { const d = Math.hypot(x - reach!.x, y - reach!.y); for (let i = 0; i <= 400; i++) { const tt = lerp(T.read[0], T.read[1], i / 400); if (reachR(tt) >= d) return tt } return T.read[1] }
    /** the print is read outward from here (the finger, kept inside the print) */
    const setReach = (x: number, y: number) => {
      const pr = L.print, l = pr.cx - pr.w / 2, tp = pr.cy - pr.h / 2, cx = clamp(x, l, l + pr.w), cy = clamp(y, tp, tp + pr.h)
      reach = { x: cx, y: cy, max: Math.max(Math.hypot(cx - l, cy - tp), Math.hypot(l + pr.w - cx, cy - tp), Math.hypot(cx - l, tp + pr.h - cy), Math.hypot(l + pr.w - cx, tp + pr.h - cy)) + 12 }
      scanAt = P.minutiae.map((m) => timeForReach(m.x, m.y))
    }
    const fr = () => Math.floor(t * 24)
    const resolve = (text: string, p: number, salt: number, frame: number) => {
      let s = ''
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (ch === ' ' || i < Math.floor(p * text.length)) { s += ch; continue }
        s += HEX[(parseInt(hex[(i * 7 + salt * 13 + frame) % 64], 16) + i) % 16]
      }
      return s
    }
    const cipherOf = (text: string, salt: number) => { let s = ''; for (let i = 0; i < text.length; i++) s += text[i] === ' ' ? ' ' : HEX[(parseInt(hex[(i * 5 + salt * 11) % 64], 16) + i * 3) % 16]; return s }
    const show = (el: HTMLElement, a: number, dy = 0) => { el.style.opacity = String(a); el.style.visibility = a > 0.001 ? 'visible' : 'hidden'; el.style.translate = dy ? `0 ${dy}px` : '' }
    const wipe = (el: HTMLElement, p: number) => { el.style.clipPath = p >= 1 ? 'none' : `inset(-20% ${100 - p * 100}% -20% 0)` }

    /** the small lines leave room for Skip on their row (the tight phone layout), or have the sentence's width */
    function narrowSubs(narrow: boolean) {
      const w = narrow ? L.W - 2 * L.g - skipBtn.current!.offsetWidth + 4 : 0
      for (const c of ['.fp-sub1', '.fp-sub3']) q(c).style.width = w ? `${w}px` : ''
    }
    /** what the phone's page needs under the print, measured: the hold line's room, two rows of readings (8 px apart), 8 px, the sentence and its small line */
    function below(narrow: boolean) {
      narrowSubs(narrow)
      const cols = 2, colW = Math.min(300, (L.W - L.g * 2 - 14 * (cols - 1)) / cols)
      mis.forEach((el, i) => { el.style.width = colW + 'px'; el.querySelector('.v')!.textContent = values[i] })
      const row = Math.max(...mis.map((el) => el.offsetHeight))
      const capH = Math.max(...['.fp-cap1', '.fp-cap2', '.fp-cap3'].map((c) => q(c).offsetHeight)), subH = Math.max(...['.fp-sub1', '.fp-sub3'].map((c) => q(c).offsetHeight))
      return 20 + 18 + 2 * row + 8 + 8 + capH + 12 + subH
    }
    function rebuild() {
      const dpr = Math.min(2, devicePixelRatio || 1)
      L = layout(!!PH)
      if (PH && L.stack) { L = layout(true, below(false)); if (L.tight) L = layout(true, below(true), true) }
      cv.width = Math.round(L.W * dpr); cv.height = Math.round(L.H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      P = buildPrint(hex, L.print); ink = paintPrint(P, dpr, INK); morph = buildMorph(P, L.lat)
      const gc = document.createElement('canvas'); gc.width = gc.height = 160
      const gctx = gc.getContext('2d')!, img = gctx.createImageData(160, 160), rnd = mulberry32(7)
      for (let i = 0; i < img.data.length; i += 4) { const v = 255 - rnd() * 34; img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 6; img.data[i + 3] = 255 }
      gctx.putImageData(img, 0, 0); grain = ctx.createPattern(gc, 'repeat')
      place()
    }
    // positions once per layout; styles per frame
    function place() {
      const { print: pr, phone, stack, H, g } = L
      r.classList.toggle('fp-stack', stack)
      r.dataset.print = [pr.cx - pr.w / 2, pr.cy - pr.h / 2, pr.w, pr.h].map(Math.round).join(',')
      // (the phone's brackets, for the tests: left, top, right, bottom of the corner marks)
      q('.fp-exh-l').textContent = stack ? visitor.id : `${visitor.id} · Browser fingerprint`
      q('.fp-exh-r').textContent = stack ? `${P.whorl ? 'Whorl' : 'Loop'} · ${visitor.ms} ms` : `Pattern · ${P.whorl ? 'whorl' : 'loop'} · ${visitor.ms} ms`
      const exh = q('.fp-exh'); exh.style.width = pr.w + 'px'; exh.style.transform = `translate(${pr.cx - pr.w / 2}px, ${pr.cy - pr.h / 2 - (PH ? 40 : stack ? 30 : 34)}px)`
      mis.forEach((el, i) => { el.querySelector('.v')!.textContent = values[i] })
      const order = P.minutiae.map((m, i) => ({ m, i })).sort((a, b) => a.m.y - b.m.y)
      labelY = []
      if (!stack) {
        // a column beside the print, each label level with its minutia where there is room
        let y = -Infinity
        mis.forEach((el) => { el.style.width = '' })
        for (const { m, i } of order) { y = Math.max(m.y - 12, y + 92); labelY[i] = y }
        const over = Math.max(...labelY) + 70 - (H - 150); if (over > 0) labelY = labelY.map((v) => v - over)
        mis.forEach((el, i) => { el.style.transform = `translate(${L.labelX}px, ${labelY[i]}px)` })
      } else {
        // a grid under the print, centred on the screen: 2 × 2 (it fills a phone's width), or one row of four
        const cols = L.cols, colW = Math.min(300, (L.W - g * 2 - 14 * (cols - 1)) / cols), x0 = (L.W - (colW * cols + 14 * (cols - 1))) / 2
        mis.forEach((el) => { el.style.width = colW + 'px' })
        const hs = mis.map((el) => el.offsetHeight), row0 = Math.max(...order.slice(0, cols).map(({ i }) => hs[i]))
        order.forEach(({ i }, k) => { labelY[i] = L.labelTop + (k < cols ? 0 : row0 + (PH ? 8 : 16)); mis[i].style.transform = `translate(${x0 + (k % cols) * (colW + 14)}px, ${labelY[i]}px)` })
      }
      if (PH) setReach(reach?.x ?? L.print.cx, reach?.y ?? L.print.cy); else scanAt = P.minutiae.map((m) => timeForScan(m.y))
      // the sentence, anchored from the bottom
      const caps = [q('.fp-cap1'), q('.fp-cap2'), q('.fp-cap3')], subs = [q('.fp-sub1'), q('.fp-sub3')]
      subs.forEach((el) => { el.style.maxWidth = phone ? '' : '510px' })
      if (PH) narrowSubs(L.tight)
      const capH = Math.max(...caps.map((el) => el.offsetHeight)), subH = Math.max(...subs.map((el) => el.offsetHeight)), capY = L.capBottom - subH - 12 - capH
      caps.forEach((el) => { el.style.transform = `translate(${g}px, ${capY + capH - el.offsetHeight}px)` })
      // (tight: the small lines stand on the bottom, so that their last line and Skip share one baseline whichever of them is on screen)
      subs.forEach((el) => { el.style.transform = `translate(${g}px, ${capY + capH + 12 + (PH && L.tight ? subH - el.offsetHeight : 0)}px)` })
      if (PH) {
        const skip = skipBtn.current!
        skip.style.translate = ''
        if (L.tight && skip.querySelector<HTMLElement>('.t1')!.offsetParent) {
          const base = (e: HTMLElement) => { const m = document.createElement('span'); m.style.display = 'inline-block'; m.style.width = '0'; m.style.height = '0'; e.appendChild(m); const y = m.getBoundingClientRect().bottom; m.remove(); return y }
          const dy = base(subs[0]) - base(skip.querySelector<HTMLElement>('.t1')!)
          if (Number.isFinite(dy)) skip.style.translate = `0 ${dy}px`
        }
      }
      const hv = q('.fp-hash'); q('.fp-hash code').textContent = hashText
      hv.style.transform = `translate(${L.lat.cx - hv.offsetWidth / 2}px, ${L.lat.cy + L.lat.size / 2 + (phone ? 18 : 26)}px)`
      if (PH) {
        const hd = q('.fp-hold'); hd.style.transform = `translate(${pr.cx - hd.offsetWidth / 2}px, ${pr.cy + pr.h / 2 + 8}px)`
        // the brackets stand outside the hold line by 9 px when the print is narrower than it
        bracketHalf = Math.max(pr.w / 2 + 18, hd.offsetWidth / 2 + 9)
        r.dataset.bracket = [pr.cx - bracketHalf, pr.cy - pr.h / 2 - 18, pr.cx + bracketHalf, pr.cy + pr.h / 2 + BRACKET_BELOW].map(Math.round).join(',')
        placeNumbers()
      }
    }

    /** The marks' numbers, each on the side of its square where nothing else is: not on another number, a square or one of the brackets' marks (a small print puts the squares close). */
    function placeNumbers() {
      const NW = 11, NH = 9, plate = 7
      const [bx0, by0, bx1, by1] = r.dataset.bracket!.split(',').map(Number)
      const hair = [[bx0 - 3, by0 - 3, bx0 + 17, by0 + 17], [bx1 - 17, by0 - 3, bx1 + 3, by0 + 17], [bx0 - 3, by1 - 17, bx0 + 17, by1 + 3], [bx1 - 17, by1 - 17, bx1 + 3, by1 + 3]]
      const hit = (a: number[], c: number[]) => a[0] < c[2] && a[2] > c[0] && a[1] < c[3] && a[3] > c[1]
      const plates = P.minutiae.map((m) => [m.x - plate, m.y - plate, m.x + plate, m.y + plate])
      const placed: number[][] = []
      numPos = P.minutiae.map((m, i) => {
        let best: number[] | null = null
        outer: for (let st = 0; st <= 24; st += 4) {
          for (const [dx, dy] of [[8 + st, -16 - st], [-19 - st, -16 - st], [8 + st, 7 + st], [-19 - st, 7 + st], [-5.5, -17 - st], [-5.5, 8 + st], [8 + st, -4.5], [-19 - st, -4.5]]) {
            const c = [m.x + dx, m.y + dy, m.x + dx + NW, m.y + dy + NH]
            if (c[0] < 2 || c[2] > L.W - 2 || c[1] < 2) continue
            if (plates.some((q2) => hit(c, q2)) || placed.some((q2) => hit(c, [q2[0] - 1, q2[1] - 1, q2[2] + 1, q2[3] + 1])) || hair.some((q2) => hit(c, q2))) continue
            best = c; break outer
          }
        }
        best ??= [m.x + 8, m.y - 16, m.x + 8 + NW, m.y - 16 + NH]
        placed[i] = best
        return { x: best[0], y: best[1] + 8 }
      })
      // (for the tests: each square's centre and each number's box)
      r.dataset.marks = JSON.stringify(P.minutiae.map((m, i) => [m.x, m.y, placed[i][0], placed[i][1], placed[i][2], placed[i][3]].map((v) => Math.round(v * 10) / 10)))
    }

    function scanLight(y: number, a: number, back: boolean) {
      if (a <= 0) return
      const pr = L.print, x0 = pr.cx - pr.w / 2 - 54, w = pr.w + 108
      ctx.save(); ctx.globalAlpha = a
      const wash = ctx.createLinearGradient(0, back ? y + 70 : y - 70, 0, y)
      wash.addColorStop(0, 'rgba(240,214,158,0)'); wash.addColorStop(1, 'rgba(240,214,158,.2)')
      ctx.fillStyle = wash; ctx.fillRect(x0, back ? y : y - 70, w, 70)
      ctx.shadowColor = 'rgba(230,201,143,.95)'; ctx.shadowBlur = 18; ctx.fillStyle = '#fffaf0'; ctx.fillRect(x0, y - 0.75, w, 1.5)
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(22,23,26,.7)'; ctx.fillRect(x0 - 1, y - 4, 1, 8); ctx.fillRect(x0 + w, y - 4, 1, 8)
      ctx.restore()
    }

    /** The phone's print: an unlit impression from the first frame, its ridges inked outward from the finger (a thin olive front, no glow), then a hairline cooling it at the seal. */
    function paintHeld(tt: number) {
      const pr = L.print, full = tt >= T.read[1], R = reachR(tt), y0 = pr.cy - pr.h / 2
      if (!full) {
        ctx.save(); ctx.globalAlpha = (0.2 + (pressed || R > 0 ? 0 : 0.04 * Math.sin(performance.now() / 650))) * appear
        ctx.drawImage(ink.ink, ink.x0, ink.y0, ink.w, ink.h); ctx.restore()
      }
      if (full || R > 0) {
        ctx.save(); ctx.beginPath()
        if (full) ctx.rect(ink.x0, ink.y0, ink.w, ink.h); else ctx.arc(reach!.x, reach!.y, R, 0, Math.PI * 2)
        ctx.clip(); ctx.globalAlpha = tt >= T.seal ? lerp(1, 0.82, seg(tt, T.sealScan[0], T.sealScan[1])) : 1
        ctx.drawImage(ink.ink, ink.x0, ink.y0, ink.w, ink.h); ctx.restore()
      }
      if (R > 0 && tt < T.read[1] + 0.25) {
        // (the front stays inside the print's own box: it must not cross the labels around it)
        ctx.save(); ctx.beginPath(); ctx.rect(pr.cx - pr.w / 2, y0, pr.w, pr.h); ctx.clip()
        ctx.globalAlpha = 0.55 * (1 - seg(tt, T.read[1], T.read[1] + 0.25)); ctx.strokeStyle = OLIVE; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(reach!.x, reach!.y, R, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      }
      if (tt >= T.sealScan[0] && tt <= T.sealScan[1] + 0.2) {
        const yb = lerp(y0 + pr.h, y0, eio(seg(tt, T.sealScan[0], T.sealScan[1])))
        ctx.save(); ctx.globalAlpha = 0.7 * (1 - seg(tt, T.sealScan[1], T.sealScan[1] + 0.2)); ctx.fillStyle = OLIVE; ctx.fillRect(pr.cx - pr.w / 2, yb - 0.5, pr.w, 1); ctx.restore()
      }
    }

    function draw(tt: number) {
      const { W, H, print: pr } = L
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
      // the sheet and its light
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H)
      const lg = ctx.createRadialGradient(W * 0.3, H * 0.16, 0, W * 0.3, H * 0.16, Math.hypot(W, H) * 0.95)
      lg.addColorStop(0, 'rgba(252,249,242,.9)'); lg.addColorStop(0.42, 'rgba(244,240,232,.35)'); lg.addColorStop(1, 'rgba(206,199,186,.6)')
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H)
      const chrome = 1 - sstep(T.labelsOut[0], T.labelsOut[1] + (PH ? 0 : 0.3), tt)
      const x0 = pr.cx - pr.w / 2, y0 = pr.cy - pr.h / 2
      // exhibit chrome: corner marks and a millimetre scale
      if (chrome > 0) {
        ctx.save(); ctx.globalAlpha = chrome * Math.max(sstep(0, 0.5, tt), appear); ctx.strokeStyle = 'rgba(22,23,26,.5)'; ctx.lineWidth = 1
        const m = 18, l = 14, X0 = PH ? pr.cx - bracketHalf : x0 - m, Y0 = y0 - m, X1 = PH ? pr.cx + bracketHalf : x0 + pr.w + m, Y1 = y0 + pr.h + (PH ? BRACKET_BELOW : m)
        ctx.beginPath()
        ctx.moveTo(X0, Y0 + l); ctx.lineTo(X0, Y0); ctx.lineTo(X0 + l, Y0); ctx.moveTo(X1 - l, Y0); ctx.lineTo(X1, Y0); ctx.lineTo(X1, Y0 + l)
        ctx.moveTo(X1, Y1 - l); ctx.lineTo(X1, Y1); ctx.lineTo(X1 - l, Y1); ctx.moveTo(X0 + l, Y1); ctx.lineTo(X0, Y1); ctx.lineTo(X0, Y1 - l)
        ctx.stroke()
        if (!L.phone) {
          const rx = X0 - 26, mm = pr.h / 22
          ctx.strokeStyle = 'rgba(22,23,26,.32)'; ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y0 + 22 * mm)
          for (let k = 0; k <= 22; k++) { const y = y0 + k * mm, len = k % 5 === 0 ? 8 : 4; ctx.moveTo(rx, y); ctx.lineTo(rx - len, y) }
          ctx.stroke()
          ctx.fillStyle = 'rgba(102,100,92,.9)'; ctx.font = '500 9px "JetBrains Mono", monospace'; ctx.textAlign = 'right'
          for (let k = 0; k <= 20; k += 5) ctx.fillText(String(k), rx - 12, y0 + k * mm + 3)
          ctx.fillText('MM', rx - 12, y0 + 22 * mm + 3)
        }
        ctx.restore()
      }
      // the print: exposed by the scan, then pulled into the hash
      const sy = scanY(tt)
      if (PH && tt < T.morph) paintHeld(tt)
      else if (tt < T.morph) {
        const lim = tt < T.read[1] ? sy : Infinity
        if (lim > y0 - 20) {
          ctx.save(); ctx.beginPath(); ctx.rect(ink.x0, ink.y0, ink.w, Math.max(0, Math.min(ink.h, lim - ink.y0))); ctx.clip()
          ctx.globalAlpha = tt >= T.seal ? lerp(1, 0.82, seg(tt, T.sealScan[0], T.sealScan[1])) : 1
          ctx.drawImage(ink.ink, ink.x0, ink.y0, ink.w, ink.h); ctx.restore()
        }
        // the freshly exposed ridges still hold the light
        if (tt > T.read[0] && tt < T.read[1] + 0.25) {
          const strength = 0.95 * (1 - seg(tt, T.read[1], T.read[1] + 0.25))
          for (let k = 0; k < 6; k++) {
            const top = sy - (k + 1) * 9
            ctx.save(); ctx.beginPath(); ctx.rect(ink.x0, top, ink.w, 9); ctx.clip(); ctx.globalAlpha = Math.pow(1 - k / 6, 1.6) * strength; ctx.drawImage(ink.glow, ink.x0, ink.y0, ink.w, ink.h); ctx.restore()
          }
        }
        // sealing: the light runs back up, cooling the print
        if (tt >= T.sealScan[0] && tt <= T.sealScan[1] + 0.2) {
          const k = eio(seg(tt, T.sealScan[0], T.sealScan[1])), yb = lerp(y0 + pr.h + 18, y0 - 18, k)
          ctx.save(); ctx.beginPath(); ctx.rect(ink.x0, yb, ink.w, 54); ctx.clip(); ctx.globalAlpha = 0.6 * (1 - seg(tt, T.sealScan[1], T.sealScan[1] + 0.2)); ctx.drawImage(ink.glow, ink.x0, ink.y0, ink.w, ink.h); ctx.restore()
          scanLight(yb, 1 - seg(tt, T.sealScan[1], T.sealScan[1] + 0.2), true)
        }
        if (tt > T.read[0] - 0.05 && tt < T.read[1] + 0.3) scanLight(sy, 1 - seg(tt, T.read[1], T.read[1] + 0.3), false)
      } else {
        // the ridges break into points and the points stream into their cells
        const dissolve = 1 - sstep(T.morph, T.morph + 0.3, tt)
        if (dissolve > 0) { ctx.save(); ctx.globalAlpha = 0.82 * dissolve; ctx.drawImage(ink.ink, ink.x0, ink.y0, ink.w, ink.h); ctx.restore() }
        ctx.save(); ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineCap = 'round'
        const esin = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k)
        const bez = (p: Morph['parts'][number], k: number) => { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * p.x + b * p.kx + c * p.tx, a * p.y + b * p.ky + c * p.ty] }
        for (const p of morph.parts) {
          const e = esin(seg(tt, T.morph + p.dl, T.morph + p.dl + p.dur)); if (e >= 1) continue
          const e0 = esin(seg(tt - 0.028, T.morph + p.dl, T.morph + p.dl + p.dur)), [x1, y1] = bez(p, e), [x2, y2] = bez(p, e0)
          const size = lerp(P.dsep * 0.26, P.dsep * 0.13, e)
          ctx.globalAlpha = p.fade * (0.35 + 0.6 * (1 - dissolve)) * (1 - sstep(0.8, 1, e))
          if (Math.hypot(x1 - x2, y1 - y2) > 1.2) { ctx.globalAlpha *= 0.7; ctx.lineWidth = size * 0.8; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke() }
          else ctx.fillRect(x1 - size / 2, y1 - size / 2, size, size)
        }
        ctx.restore()
        for (const c of morph.cells) {
          const p = eout(seg(tt, T.morph + c.dl + 0.35, T.morph + c.dl + 0.7)); if (p <= 0) continue
          const s = morph.c * 0.7 * lerp(0.55, 1, p)
          ctx.globalAlpha = p
          if (bits[c.i * 16 + c.j]) { ctx.fillStyle = INK; ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s) } else { ctx.strokeStyle = 'rgba(40,36,30,.4)'; ctx.lineWidth = 0.6; ctx.strokeRect(c.x - s / 2 + 0.3, c.y - s / 2 + 0.3, s - 0.6, s - 0.6) }
        }
        ctx.globalAlpha = 1
      }
      // minutiae: square marks and their leaders, knocked out of the ridges they cross
      if (chrome > 0) P.minutiae.forEach((m, i) => {
        const at = scanAt[i]; if (tt < at) return
        const ap = eout(seg(tt, at, at + 0.25)), red = sstep(T.prof + i * 0.14, T.prof + i * 0.14 + 0.2, tt), ok = sstep(T.sealScan[0] + 0.1, T.sealScan[1], tt)
        const col = ok > 0 ? `rgba(92,107,18,${ok})` : red > 0 ? THREAT : INK
        ctx.save(); ctx.globalAlpha = chrome
        if (!L.stack) {
          const lp = eio(seg(tt, at + 0.05, at + 0.45)), ly = labelY[i] + 9, lx = L.labelX - 10, ex = lx - 28
          const path = [[m.x + 6, m.y], [ex, ly], [lx, ly]], len = Math.hypot(ex - m.x - 6, ly - m.y) + 28
          ctx.setLineDash([len * lp, 1e5]); ctx.lineCap = 'butt'
          ctx.strokeStyle = 'rgba(231,228,221,.95)'; ctx.lineWidth = 4; ctx.beginPath(); path.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
          ctx.strokeStyle = ok > 0 ? col : red > 0 ? THREAT : 'rgba(22,23,26,.8)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([])
        }
        const s = (L.phone ? 8 : 9) * ap
        ctx.fillStyle = 'rgba(231,228,221,.95)'; ctx.fillRect(m.x - s / 2 - 2, m.y - s / 2 - 2, s + 4, s + 4)
        ctx.strokeStyle = ok > 0 ? (L.stack ? OLIVE : col) : red > 0 ? THREAT : INK; ctx.lineWidth = 1.3; ctx.strokeRect(m.x - s / 2, m.y - s / 2, s, s)
        ctx.fillStyle = ctx.strokeStyle
        if (L.stack) { ctx.font = '500 9px "JetBrains Mono", monospace'; ctx.fillText(String(i + 1).padStart(2, '0'), PH && numPos[i] ? numPos[i].x : m.x + 7, PH && numPos[i] ? numPos[i].y : m.y - 6) }
        else ctx.fillRect(m.x - 1, m.y - 1, 2, 2)
        if (!L.phone && red > 0 && ok <= 0) { const rr = 9 + 14 * eout(seg(tt, T.prof + i * 0.14, T.prof + i * 0.14 + 0.7)); ctx.globalAlpha = chrome * (1 - seg(tt, T.prof + i * 0.14, T.prof + i * 0.14 + 0.7)); ctx.strokeStyle = THREAT; ctx.lineWidth = 1; ctx.strokeRect(m.x - rr / 2, m.y - rr / 2, rr, rr) }
        ctx.restore()
      })
      // grain over everything drawn: one sheet, one light
      if (grain) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.32; ctx.fillStyle = grain; ctx.fillRect(0, 0, W, H); ctx.restore() }
    }

    function dom(tt: number) {
      const ph = PHASES.reduce((a, [, at], i) => (tt >= at - 0.05 ? i : a), 0)
      q('.fp-ph-n').textContent = `0${ph + 1} / 03`; q('.fp-ph-t').textContent = PHASES[ph][0]
      const chrome = 1 - sstep(T.labelsOut[0], T.labelsOut[1], tt)
      show(q('.fp-exh'), Math.min(Math.max(sstep(0.1, 0.5, tt), appear), chrome))
      if (PH) show(q('.fp-hold'), appear * (1 - sstep(T.sealScan[0], T.sealScan[0] + 0.3, tt)) * (pressed ? 0.3 : 1))
      // labels: number and kind with the leader, the value resolving from cipher, then the attacker's use
      mis.forEach((el, i) => {
        const at = scanAt[i] ?? T.read[1]
        if (tt < at + 0.12) { show(el, 0); return }
        show(el, chrome); const v = valEls[i]
        const sealP = seg(tt, T.sealScan[0] + 0.05 + (3 - i) * 0.06, T.sealScan[1] + 0.05 + (3 - i) * 0.06)
        if (sealP > 0) { v.classList.toggle('cipher', sealP >= 1); v.textContent = sealP >= 1 ? cipherOf(values[i], i) : resolve(cipherOf(values[i], i), sealP, i, fr()) }
        else { v.classList.remove('cipher'); v.textContent = resolve(values[i], seg(tt, at + 0.2, at + 0.55), i, fr()) }
        const a = el.querySelector<HTMLElement>('.a')!, ap = seg(tt, T.prof + 0.12 + i * 0.14, T.prof + 0.45 + i * 0.14)
        wipe(a, ap); a.style.opacity = String(ap > 0 ? 1 - sstep(T.sealScan[0], T.sealScan[0] + 0.3, tt) : 0)
      })
      // the sentence, three times
      const c1 = seg(tt, T.cap1, T.cap1 + 0.55), c1o = 1 - sstep(T.prof - 0.05, T.prof + 0.15, tt)
      wipe(q('.fp-cap1'), eout(c1)); show(q('.fp-cap1'), c1 > 0 ? c1o : 0)
      show(q('.fp-sub1'), sstep(T.sub1, T.sub1 + 0.5, tt) * c1o)
      const c2 = seg(tt, T.prof + 0.1, T.prof + 0.6), c2o = 1 - sstep(T.seal - 0.05, T.seal + 0.15, tt)
      wipe(q('.fp-cap2'), eout(c2)); show(q('.fp-cap2'), c2 > 0 ? c2o : 0)
      const c3 = seg(tt, T.cap3, T.cap3 + 0.5)
      wipe(q('.fp-cap3'), eout(c3)); show(q('.fp-cap3'), c3 > 0 ? 1 : 0)
      show(q('.fp-sub3'), sstep(T.cap3 + 0.35, T.cap3 + 0.8, tt))
      // the hash types out under the sealed grid (the untyped part holds its place)
      const hp = seg(tt, T.hash[0], T.hash[1]), hn = Math.round(hp * hashText.length)
      q('.fp-hash code').textContent = hashText.slice(0, hn) + hashText.slice(hn).replace(/[^\n]/g, ' ')
      show(q('.fp-hash'), hp > 0 ? 1 : 0)
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      if (PH) {
        if (!started) { shownAt = now; touchAt = now }
        appear = sstep(0, 0.6, (now - shownAt) / 1000)
        // no touch for IDLE_S: it plays itself at the desktop's pace
        if (!pressed && !auto && !reduced && now - touchAt >= IDLE_S * 1000) auto = true
      }
      if (!done) {
        t = Math.min(T.end, t + dt * (!PH ? 1 : pressed ? holdRate(t) : auto ? 1 : 0))
        if (PH && pressed && t >= HOLD_END) t = T.end
      }
      draw(t); dom(t)
      if (!started) { started = true; onBuild() }
      // reduced motion opens on the sealed still and waits for Continue
      if (t >= T.end && !done) { done = true; if (!reduced) leaveRef.current() }
    }
    rebuild()
    // (the phone's measures depend on the fonts: once they are in, the page is laid out again)
    let gone = false
    if (PH) void document.fonts?.ready.then(() => { if (!gone) rebuild() })
    r.style.visibility = 'visible'
    raf = requestAnimationFrame(tick)
    let rz = 0
    const onResize = () => { clearTimeout(rz); rz = window.setTimeout(rebuild, 150) }
    addEventListener('resize', onResize)

    let out: ReturnType<typeof handover> | undefined
    const leave = () => {
      if (st.current.leaving) return
      // a skip lands on the sealed grid (the point of the page), then leaves from there
      st.current.skipped ??= t < T.end - 0.05
      t = T.end; done = true
      if (!started) { started = true; onBuild() }
      if (PH) { st.current.leaving = true; pressed = false; r.dataset.phase = 'transfer'; PH.onSealed({ root: r, skipped: !!st.current.skipped }); return }
      if (!sceneReadyRef.current) { st.current.waiting = true; r.classList.add('waiting'); return }
      st.current.leaving = true; st.current.waiting = false; r.classList.remove('waiting'); r.dataset.phase = 'transfer'
      if (reduced) { onReveal(); onStrike(false); onDone(); return }
      const skipped = !!st.current.skipped
      out = handover({ root: r, card: cv, lock: q('.gz-lock'), fade: [q('.fp-labels'), q('.fp-say'), q('.fp-phase'), q('.gz-skip')], onReveal, onStrike: () => onStrike(skipped), onDone })
    }
    leaveRef.current = leave
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS'].includes(e.key)) return
      if (e.target === skipBtn.current && (e.key === 'Enter' || e.key === ' ')) return
      leaveRef.current()
    }
    const onPointer = (e: PointerEvent) => { if (!skipBtn.current?.contains(e.target as Node)) leaveRef.current() }
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return
      PH!.onPress(!pressedOnce); pressedOnce = true
      if (skipBtn.current?.contains(e.target as Node) || st.current.leaving || done || reduced) return
      pressed = true; pid = e.pointerId; auto = false; touchAt = performance.now()
      try { r.setPointerCapture(e.pointerId) } catch { /* the pointer is gone */ }
      if (t === 0) setReach(e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => { if (e.pointerId === pid) { pressed = false; pid = -1; touchAt = performance.now() } }
    const onHide = () => { if (document.hidden) { pressed = false; pid = -1; touchAt = performance.now() } }
    const noMenu = (e: Event) => e.preventDefault()
    if (PH) {
      r.addEventListener('pointerdown', onDown); r.addEventListener('pointerup', onUp); r.addEventListener('pointercancel', onUp); r.addEventListener('contextmenu', noMenu)
      document.addEventListener('visibilitychange', onHide)
    } else { addEventListener('keydown', onKey); r.addEventListener('pointerdown', onPointer) }
    skipBtn.current?.focus({ preventScroll: true })
    return () => {
      gone = true; cancelAnimationFrame(raf); clearTimeout(rz); out?.kill(); st.current = { leaving: false, waiting: false }
      removeEventListener('resize', onResize); removeEventListener('keydown', onKey); r.removeEventListener('pointerdown', onPointer)
      r.removeEventListener('pointerdown', onDown); r.removeEventListener('pointerup', onUp); r.removeEventListener('pointercancel', onUp); r.removeEventListener('contextmenu', noMenu)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className={phone ? 'gate gz fp ph-gate' : 'gate gz fp'} data-phase="read" role="dialog" aria-label="Entry: your browser fingerprint" style={{ visibility: 'hidden' }}>
      <p className="sr-only">
        In {visitor.ms} milliseconds this page read your system ({visitor.os}, {visitor.browser}), your local time and city ({visitor.time}, {visitor.city}), your language and your screen, without asking.
        Together they are a fingerprint: the same browser gives the same one, no cookie needed. To an attacker it is a profile: enough to match a known exploit, time a phishing email, write its lure in your language and fit a fake sign-in to your screen.
        Here it is hashed with SHA-256 in your browser and nothing leaves it. This is the security portfolio of Yaoting Wang, security analyst.
      </p>
      <canvas className="fp-canvas" aria-hidden="true" />
      <div className="gz-lock" aria-hidden="true"><div className="a">YAOTING WANG</div><div className="b">SECURITY ANALYST<span className="loc"> · VANCOUVER, BC</span></div></div>
      <div className="fp-phase lbl" aria-hidden="true"><span className="fp-ph-n">01 / 03</span><span className="fp-ph-t">Read</span></div>
      <div className="fp-labels" aria-hidden="true">
        <div className="fp-exh lbl"><span className="fp-exh-l" /><span className="fp-exh-r" /></div>
        {LABELS.map((l, i) => (
          <div key={l} className="fp-mi" data-i={i}><div className="h lbl"><span className="n">0{i + 1}</span><span>{l}</span></div><div className="v" /><div className="a">→ {AIMS[i]}</div></div>
        ))}
        <div className="fp-hash"><span className="lbl ok">✓ SHA-256</span><code /></div>
        {phone ? <div className="fp-hold lbl">{phone.label}</div> : null}
      </div>
      <div className="fp-say" aria-hidden="true">
        <p className="fp-cap fp-cap1">Your browser has a <b>fingerprint.</b></p>
        <p className="fp-sub fp-sub1">Built from four things it tells every site. Same browser, same print. No cookie needed.</p>
        <p className="fp-cap fp-cap2">To an attacker, it is a <b>profile.</b></p>
        <p className="fp-cap fp-cap3">I keep it <b>sealed.</b></p>
        <p className="fp-sub fp-sub3">Hashed with SHA-256 in this tab. Nothing leaves it.</p>
      </div>
      <button ref={skipBtn} className="gz-skip gate-skip" onClick={() => leaveRef.current()}><span className="t1">{reduced ? 'Continue ↵' : 'Skip ↵'}</span><span className="t2">Preparing the archive…</span></button>
    </div>
  )
}
