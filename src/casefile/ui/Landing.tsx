// First visit, entry prototypes (docs/curation-plan.md §S2): the reader meets Yaoting before the
// archive. A plays his record decrypting, then hands over to the archive by itself; C is the same
// page held still until the reader picks a file or enters. The browser readout stays one click away.
import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { entryById } from '../data/entries'
import { SELECTED, THESIS } from '../data/story'
import { KIND_NAME } from '../data/types'
import { handover } from './handoff'
import '../styles/gate.css'
import '../styles/landing.css'

gsap.registerPlugin(ScrambleTextPlugin)
const HEX = '0123456789abcdef'

/** Where the reader goes from the landing: a selected file, the archive, the full profile, or the browser readout. */
export type Pick = { to: 'file'; slug: string } | { to: 'archive' } | { to: 'profile' } | { to: 'readout' }

export function Landing({ variant, reduced, sceneReady, onTitle, onPick, onReveal, originAt, onStrike, onDone }: {
  variant: 'a' | 'c'; reduced: boolean; sceneReady: boolean
  onTitle: () => void; onPick: (p: Pick) => void; onReveal: () => void
  originAt: () => { x: number; y: number } | null
  onStrike: () => void; onDone: () => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const st = useRef({ leaving: false, waiting: false })
  const leaveRef = useRef<() => void>(() => {})
  const sceneReadyRef = useRef(sceneReady)
  useEffect(() => { sceneReadyRef.current = sceneReady; if (sceneReady && st.current.waiting) leaveRef.current() }, [sceneReady])

  useLayoutEffect(() => {
    const r = root.current!
    const q = <T extends Element = HTMLElement>(s: string) => r.querySelector(s) as T
    const qa = <T extends Element = HTMLElement>(s: string) => [...r.querySelectorAll(s)] as T[]
    const card = q('.gz-card'), still = variant === 'c' || reduced
    let out: gsap.core.Timeline | undefined

    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, paused: still, onComplete: () => leaveRef.current() })
    const wipe = { autoAlpha: 1, clipPath: 'inset(0 0% 0 0)' }, hidden = { autoAlpha: 0, clipPath: 'inset(0 100% 0 0)' }
    tl.set(r, { autoAlpha: 1 })
      .fromTo(q('.gz-lock'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.32 }, 0)
      .fromTo(q('.gz-rail'), { scaleX: 0 }, { scaleX: 1, duration: 0.6 }, 0.02)
      .fromTo(q('.land-thesis b'), hidden, { ...wipe, duration: 0.45 }, 0.15)
      .fromTo(q('.land-thesis span'), hidden, { ...wipe, duration: 0.5 }, 0.45)
      .fromTo(qa('.land-meta, .land-profile'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 0.8)
      .fromTo(card, hidden, { ...wipe, duration: 0.5 }, 0.7)
    // his record decrypts for the reader: each proof line resolves from ciphertext, row by row
    qa<HTMLElement>('.land-row').forEach((row, i) => {
      const at = 1.0 + i * 0.16, line = row.querySelector<HTMLElement>('.l')!, plain = line.dataset.v ?? ''
      if (!still) line.textContent = cipher(plain, i)
      tl.fromTo(row, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, at)
        .to(line, { duration: 0.5, scrambleText: { text: plain, chars: HEX, speed: 1 } }, at + 0.05)
    })
    tl.fromTo(qa('.gz-foot, .land-demo, .gate-skip'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 1.8)
      // the scene is built under the still, readable page (it holds the main thread for a moment)
      .call(onTitle, undefined, 2.4)
      .to({}, { duration: 3.2 })

    const leave = () => {
      if (st.current.leaving) return
      tl.eventCallback('onComplete', null); tl.progress(1); tl.pause(); onTitle()
      if (!sceneReadyRef.current) { st.current.waiting = true; r.classList.add('waiting'); return }
      st.current.leaving = true; st.current.waiting = false; r.classList.remove('waiting')
      if (reduced) { onReveal(); onStrike(); onDone(); return }
      out = handover({ root: r, card, dot: q('.gz-dot'), lock: q('.gz-lock'), fade: [q('.land-say'), q('.gz-rail'), q('.land-demo'), q('.gate-skip')], originAt, onReveal, onStrike, onDone })
    }
    leaveRef.current = leave
    if (still) {
      // C (and reduced motion): the page is there at once and waits for the reader; the archive builds behind it
      tl.eventCallback('onComplete', null); tl.progress(1)
      if (!reduced) gsap.fromTo(q('.land-wrap'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' })
      const h = setTimeout(onTitle, 500)
      return () => { clearTimeout(h); tl.kill(); out?.kill(); gsap.killTweensOf(qa('*')); st.current = { leaving: false, waiting: false } }
    }
    return () => { tl.kill(); out?.kill(); gsap.killTweensOf(qa('*')); st.current = { leaving: false, waiting: false } }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (p: Pick) => { onPick(p); if (p.to !== 'readout') leaveRef.current() }

  return (
    <div ref={root} className={`gate gz land land--${variant}`} role="main" aria-label="Yaoting Wang, security analyst" style={{ visibility: 'hidden' }}>
      <div className="land-wrap">
        <div className="gz-lock"><div className="a">YAOTING WANG</div><div className="b">SECURITY ANALYST<span className="loc"> · VANCOUVER, BC</span></div></div>
        <div className="gz-rail" aria-hidden="true"><span>Profile · YW-000</span><span className="gz-read-step">Full-time from Apr 2027</span></div>
        <div className="land-stage">
          <div className="land-say">
            <h1 className="land-thesis"><b>{THESIS.lead}</b> <span>{THESIS.rest}</span></h1>
            <p className="land-meta">Master of Cybersecurity, SFU · CCNA · Security+</p>
            <button type="button" className="land-profile" onClick={() => go({ to: 'profile' })}>Full profile <span aria-hidden="true">→</span></button>
          </div>
          <nav className="gz-card land-card" aria-label="Start here">
            <div className="gz-h"><span className="t">START HERE</span><span className="id">{SELECTED.length} files</span></div>
            <ol className="land-list">
              {SELECTED.map((s, i) => {
                const e = entryById.get(s.id)!
                return (
                  <li key={s.id}>
                    <a className="land-row" href={`/projects/${e.slug}`} aria-label={`${e.kind === 'service' ? e.org : e.title}: ${s.line}`} onClick={(ev) => { ev.preventDefault(); go({ to: 'file', slug: e.slug }) }}>
                      <span className="n">{String(i + 1).padStart(2, '0')}</span>
                      <span className="t">{e.kind === 'service' ? e.org : e.title}</span>
                      <span className="k">{KIND_NAME[e.kind]}</span>
                      <span className="l" data-v={s.line}>{s.line}</span>
                      <span className="arr" aria-hidden="true">→</span>
                    </a>
                  </li>
                )
              })}
            </ol>
            <div className="gz-foot"><i /><span>Each line opens the file behind it.</span></div>
          </nav>
        </div>
        <button type="button" className="land-demo" onClick={() => go({ to: 'readout' })}>See what your browser tells an attacker <span aria-hidden="true">→</span></button>
        <button type="button" className="gz-skip gate-skip" onClick={() => go({ to: 'archive' })}>
          <span className="t1">{variant === 'a' && !reduced ? 'Skip ↵' : 'Enter the archive →'}</span><span className="t2">Preparing the archive…</span>
        </button>
      </div>
      <i className="gz-dot" aria-hidden="true" />
    </div>
  )
}

/** A stable ciphertext the same length as the plaintext (spaces kept, so the line keeps its shape). */
function cipher(text: string, seed: number) {
  let h = (seed + 1) * 2654435761 >>> 0
  return text.replace(/\S/g, () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return HEX[h >>> 28] })
}
