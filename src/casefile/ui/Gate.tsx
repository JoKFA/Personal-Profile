// Browser readout → attack profile → sealed record → the white field the archive slides into.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import type { Visitor } from '../visitor'
import { handover } from './handoff'
import '../styles/gate.css'

gsap.registerPlugin(ScrambleTextPlugin)
const HEX = '0123456789abcdef'
function language(tag: string) {
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag.split('-')[0]) ?? tag } catch { return tag }
}
interface Fact { label: string; before: string; value: string; aim: string }

export function Gate({ visitor, reduced, sceneReady, onTitle, onReveal, onStrike, onDone }: {
  visitor: Visitor; reduced: boolean; sceneReady: boolean
  onTitle: () => void; onReveal: () => void
  onStrike: () => void; onDone: () => void
}) {
  const root = useRef<HTMLDivElement>(null), skipBtn = useRef<HTMLButtonElement>(null)
  const st = useRef({ leaving: false, waiting: false })
  const leaveRef = useRef<() => void>(() => {})
  const sceneReadyRef = useRef(sceneReady)
  useEffect(() => { sceneReadyRef.current = sceneReady; if (sceneReady && st.current.waiting) leaveRef.current() }, [sceneReady])

  const facts = useMemo<Fact[]>(() => {
    const lang = visitor.langs.split(',').map((s) => s.trim()).filter(Boolean)[0]
    const browser = visitor.browser.replace(/^(Microsoft|Google|Mozilla|Apple)\s+/, '')
    const out: Fact[] = [
      { label: 'System', before: 'You’re on', value: [visitor.os, browser].filter(Boolean).join(' · '), aim: 'Match a known exploit' },
      { label: 'Local time', before: 'Your local time', value: [visitor.time, visitor.city].filter(Boolean).join(', '), aim: 'Time a phishing email' },
    ]
    if (lang) out.push({ label: 'Language', before: 'Your browser speaks', value: language(lang), aim: 'Write a convincing lure' })
    return out.filter((f) => f.value)
  }, [visitor])

  useLayoutEffect(() => {
    const r = root.current!
    const q = <T extends Element = HTMLElement>(s: string) => r.querySelector(s) as T
    const qa = <T extends Element = HTMLElement>(s: string) => [...r.querySelectorAll(s)] as T[]
    const card = q('.gz-card'), link = q<SVGPathElement>('.gz-link path')
    r.dataset.phase = 'read'; r.classList.remove('waiting')
    card.classList.remove('attack', 'sealed')
    qa<HTMLElement>('.gz-f .v').forEach((v) => { v.style.visibility = 'hidden'; v.textContent = v.dataset.v ?? '' })
    q('.gz-h .t').textContent = 'VISITOR PROFILE'
    q('.gz-read-step').textContent = '0 / ' + facts.length
    const ghosts = new Set<HTMLElement>(), flights = new Set<gsap.core.Tween>()
    let out: gsap.core.Timeline | undefined
    const clearFlights = () => {
      flights.forEach((t) => t.kill()); flights.clear()
      ghosts.forEach((g) => g.remove()); ghosts.clear()
      gsap.killTweensOf(link); gsap.set(link, { opacity: 0 })
      qa<HTMLElement>('.gz-f .v').forEach((v) => { v.style.visibility = 'visible' })
    }
    const fly = (from: HTMLElement, to: HTMLElement) => {
      if (reduced) { to.style.visibility = 'visible'; return }
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), cs = getComputedStyle(from)
      const ghost = from.cloneNode(true) as HTMLElement
      ghost.className = 'gz-flight'
      Object.assign(ghost.style, { position: 'fixed', left: String(a.left) + 'px', top: String(a.top) + 'px', margin: '0', font: cs.font, letterSpacing: cs.letterSpacing, color: cs.color, whiteSpace: 'nowrap', transformOrigin: '0 0', zIndex: '5', pointerEvents: 'none' })
      r.appendChild(ghost); ghosts.add(ghost); from.style.visibility = 'hidden'
      const mobile = innerWidth < 900
      const sx = mobile ? a.left : Math.min(a.right + 14, b.left - 28), sy = mobile ? a.bottom + 12 : a.top + a.height / 2
      link.setAttribute('d', mobile
        ? 'M' + sx + ',' + sy + ' V' + (b.top - 22) + ' H' + b.left + ' V' + (b.top - 8)
        : 'M' + sx + ',' + sy + ' H' + (b.left - 26) + ' V' + (b.top + b.height / 2) + ' H' + (b.left - 8))
      gsap.fromTo(link, { opacity: 0, strokeDashoffset: 1 }, { opacity: 0.65, strokeDashoffset: 0, duration: 0.32, ease: 'power2.inOut' })
      const tween = gsap.to(ghost, { x: b.left - a.left, y: b.top - a.top, scale: b.height / a.height, duration: 0.34, ease: 'power2.inOut', onComplete: () => {
        ghost.remove(); ghosts.delete(ghost); flights.delete(tween); to.style.visibility = 'visible'
        gsap.fromTo(to, { opacity: 0.45 }, { opacity: 1, duration: 0.18 })
        gsap.to(link, { opacity: 0, duration: 0.18 })
      } })
      flights.add(tween)
    }

    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: () => leaveRef.current() })
    tl.set(r, { autoAlpha: 1 })
      .fromTo(q('.gz-lock'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.32 }, 0)
      .fromTo(q('.gz-rail'), { scaleX: 0 }, { scaleX: 1, duration: 0.6 }, 0.02)
      .fromTo(card, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.5 }, 0.05)
    facts.forEach((_, i) => {
      const at = 0.22 + i * 0.7
      const line = q('.gz-s[data-i="' + i + '"]'), from = line.querySelector<HTMLElement>('b')!, to = q('.gz-f[data-i="' + i + '"] .v')
      tl.call(() => { q('.gz-read-step').textContent = String(i + 1) + ' / ' + facts.length }, undefined, at)
        .fromTo(line, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.22 }, at)
        .call(() => fly(from, to), undefined, at + 0.4)
        .to(line, { autoAlpha: 0, duration: 0.15 }, at + 0.6)
    })
    const turn = 0.22 + facts.length * 0.7
    tl.call(() => { r.dataset.phase = 'attack'; card.classList.add('attack') }, undefined, turn)
      .set(q('.gz-h .t'), { textContent: 'ATTACK PROFILE' }, turn)
      .fromTo(q('.gz-turn'), { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.3 }, turn)
    qa('.gz-aim').forEach((a, i) => tl.fromTo(a, { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.24 }, turn + 0.08 + i * 0.1))
    const def = turn + 2.05
    tl.to(q('.gz-turn'), { autoAlpha: 0, duration: 0.22 }, def)
      .call(() => { r.dataset.phase = 'sealed' }, undefined, def + 0.12)
      .fromTo(q('.gz-def'), { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }, { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)', duration: 0.35 }, def + 0.14)
      .fromTo(q('.gz-scan'), { yPercent: -100, autoAlpha: 1 }, { yPercent: 0, duration: 0.5 }, def + 0.18)
      .to(q('.gz-scan'), { autoAlpha: 0, duration: 0.18 }, def + 0.68)
      .call(() => { card.classList.remove('attack'); card.classList.add('sealed') }, undefined, def + 0.42)
      .set(q('.gz-h .t'), { textContent: 'PROFILE SEALED' }, def + 0.42)
    qa<HTMLElement>('.gz-f .v').forEach((v, i) => {
      let h = (visitor.hash + i * 2654435761) >>> 0
      const cipher = Array.from({ length: Math.max(8, Math.min(16, (v.dataset.v ?? '').length)) }, () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return HEX[h >>> 28] }).join('')
      tl.to(v, { duration: 0.28, scrambleText: { text: cipher, chars: HEX, speed: 1 } }, def + 0.3 + i * 0.06)
    })
    // Scene setup belongs under the readable final still, never under travelling typography.
    tl.call(onTitle, undefined, def + 0.92).to({}, { duration: 0.65 })

    const leave = () => {
      if (st.current.leaving) return
      tl.eventCallback('onComplete', null); tl.progress(1); tl.pause(); clearFlights(); onTitle()
      if (!sceneReadyRef.current) { st.current.waiting = true; r.classList.add('waiting'); return }
      st.current.leaving = true; st.current.waiting = false; r.classList.remove('waiting'); r.dataset.phase = 'transfer'
      if (reduced) { onReveal(); onStrike(); onDone(); return }
      out = handover({ root: r, card, lock: q('.gz-lock'), fade: [q('.gz-say'), q('.gz-skip'), q('.gz-rail'), q('.gz-caption')], onReveal, onStrike, onDone })
    }
    leaveRef.current = leave
    if (reduced) {
      tl.eventCallback('onComplete', null); tl.progress(1); tl.pause(); clearFlights(); onTitle()
      qa<HTMLElement>('.gz-s').forEach((s) => { s.style.visibility = 'hidden' })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS'].includes(e.key)) return
      if (e.target === skipBtn.current && (e.key === 'Enter' || e.key === ' ')) return
      leaveRef.current()
    }
    const onPointer = (e: PointerEvent) => { if (!skipBtn.current?.contains(e.target as Node)) leaveRef.current() }
    addEventListener('keydown', onKey); r.addEventListener('pointerdown', onPointer)
    skipBtn.current?.focus({ preventScroll: true })
    return () => {
      tl.kill(); out?.kill(); clearFlights(); gsap.killTweensOf(qa('*')); st.current = { leaving: false, waiting: false }
      removeEventListener('keydown', onKey); r.removeEventListener('pointerdown', onPointer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className="gate gz" data-phase="read" role="dialog" aria-label="Entry: your attack profile" style={{ visibility: 'hidden' }}>
      <p className="sr-only">
        In {visitor.ms} milliseconds this page read your system ({visitor.os}, {visitor.browser}), your local time and city ({visitor.time}, {visitor.city}) and your language, without asking.
        Put together, that is an attack profile: enough to match a known exploit, time a phishing email and write its lure in your language. Nothing left your browser.
        This is the security portfolio of Yaoting Wang: I look at systems the way an attacker would, then I close the gaps.
      </p>
      <div className="gz-lock" aria-hidden="true"><div className="a">YAOTING WANG</div><div className="b">SECURITY ANALYST<span className="loc"> · VANCOUVER, BC</span></div></div>
      <div className="gz-rail" aria-hidden="true"><span>Browser readout</span><span className="gz-read-step">0 / {facts.length}</span></div>
      <svg className="gz-link" aria-hidden="true"><path pathLength="1" /></svg>
      <div className="gz-stage" aria-hidden="true">
        <div className="gz-say">
          {facts.map((f, i) => <p key={f.label} className="gz-s" data-i={i}><span>{f.before}</span><b>{f.value}</b></p>)}
          <p className="gz-turn"><span>Put together, that’s an</span><b>attack profile.</b></p>
          <p className="gz-def"><span>I look at systems<br />the way an attacker would.</span><b>Then I close the gaps.</b></p>
        </div>
        <div className="gz-card">
          <svg className="gz-etch" viewBox="0 0 460 340" preserveAspectRatio="none"><path d="M20 40 V20 H100 M360 20 H440 V80 M440 260 V320 H360 M100 320 H20 V260" /></svg>
          <div className="gz-h"><span className="t">VISITOR PROFILE</span><span className="id">{visitor.id}</span></div>
          <dl className="gz-fields">{facts.map((f, i) => (
            <div key={f.label} className="gz-f" data-i={i}><dt>{f.label}</dt><dd><b className="v" data-v={f.value}>{f.value}</b><span className="gz-aim">{f.aim}</span></dd></div>
          ))}</dl>
          <div className="gz-foot"><i /><span>Processed locally.<br />Nothing sent.</span><span className="gz-ms">{visitor.ms} ms</span></div>
          <i className="gz-scan" />
        </div>
      </div>
      <p className="gz-caption" aria-hidden="true">What your browser reveals.<span>What an attacker could use.</span></p>
      <button ref={skipBtn} className="gz-skip gate-skip" onClick={() => leaveRef.current()}><span className="t1">{reduced ? 'Continue ↵' : 'Skip ↵'}</span><span className="t2">Preparing the archive…</span></button>
    </div>
  )
}
