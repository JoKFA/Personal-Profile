// Entry: reverse recon (spec §17.3). The page profiles its visitor the way an attacker would, in
// large type, and builds the result into a profile card with thin 45° traces (the same traces the
// drives carry). Then the turn: that profile is exactly what a phishing campaign needs. Then the
// defender: the profile is sealed (it never left the browser) and the archive opens. Linear
// language after RhineLabUI's boot film (MIT): hairlines drawn in, typed small caps, a highlight
// bar that wipes the title. Every figure shown is measured in this browser; nothing is sent.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { TextPlugin } from 'gsap/TextPlugin'
import type { Visitor } from '../visitor'
import '../styles/gate.css'

gsap.registerPlugin(DrawSVGPlugin, TextPlugin, ScrambleTextPlugin)

const HEX = '0123456789abcdef'
type Field = { k: string; label: string; value: string; note?: string }

/** The recon, as sentences (left) and as the fields they fill (right). */
function recon(v: Visitor) {
  const langs = v.langs.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(', ') || 'undisclosed'
  const hw = v.cores ? `${v.cores} cores${v.gpu ? ` · ${v.gpu}` : ''}` : 'undisclosed'
  const lines: { parts: (string | [string])[]; fields: string[] }[] = [
    { parts: ["You're on ", [v.os], ', using ', [v.browser], '.'], fields: ['device', 'browser'] },
    { parts: ['Your clock reads ', [v.time], ', ', [v.city], ' time.'], fields: ['time', 'place'] },
    { parts: ['Your browser speaks ', [langs], '.'], fields: ['lang'] },
    v.cores
      ? { parts: ['Your machine has ', [`${v.cores} cores`], v.gpu ? ' and a ' : '', ...(v.gpu ? [[v.gpu] as [string]] : []), '.'], fields: ['hw', 'screen'] }
      : { parts: ['Your screen is ', [v.screen], ', in ', [`${v.scheme} mode`], '.'], fields: ['hw', 'screen'] },
  ]
  const fields: Field[] = [
    { k: 'device', label: 'Device', value: v.os, note: 'match a known exploit' },
    { k: 'browser', label: 'Browser', value: v.browser },
    { k: 'time', label: 'Local time', value: v.time, note: 'time the phishing email' },
    { k: 'place', label: 'Location', value: v.city },
    { k: 'lang', label: 'Language', value: langs, note: 'write the lure in your language' },
    { k: 'hw', label: 'Hardware', value: hw },
    { k: 'screen', label: 'Display', value: `${v.screen} · ${v.scheme}` },
  ]
  return { lines, fields }
}

/** Concentric arcs whose gaps come from the visitor's hash: a fingerprint drawn from the data. */
function rings(hash: number) {
  const out: string[] = []
  let h = hash || 0x9e3779b9
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296 }
  for (let i = 0; i < 7; i++) {
    const r = 12 + i * 7, n = 2 + Math.floor(rnd() * 2)
    let a = rnd() * Math.PI * 2
    for (let j = 0; j < n; j++) {
      const len = (0.5 + rnd() * 1.6) * (Math.PI * 2 / n) * 0.7, b = a + len
      const p = (t: number) => `${(50 + r * Math.cos(t)).toFixed(2)},${(50 + r * Math.sin(t)).toFixed(2)}`
      out.push(`M${p(a)} A${r},${r} 0 ${len > Math.PI ? 1 : 0},1 ${p(b)}`)
      a = b + (Math.PI * 2 / n) * 0.3
    }
  }
  return out
}

export function Gate({ visitor, reduced, sceneReady, onTitle, onDone }: { visitor: Visitor; reduced: boolean; sceneReady: boolean; onTitle: () => void; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  const ended = useRef(false)          // the film reached its last (still) frame
  const finishRef = useRef<() => void>(() => {})
  const skipRef = useRef<() => void>(() => {})
  const skipBtn = useRef<HTMLButtonElement>(null)
  const sceneReadyRef = useRef(sceneReady)
  useEffect(() => { sceneReadyRef.current = sceneReady }, [sceneReady])
  // leave only when the film has ended and the archive behind it is ready
  useEffect(() => { if (sceneReady && ended.current) finishRef.current() }, [sceneReady])

  const { lines, fields } = useMemo(() => recon(visitor), [visitor])
  const arcs = useMemo(() => rings(visitor.hash), [visitor.hash])
  const fp = (visitor.hash >>> 0).toString(16).padStart(8, '0')

  useLayoutEffect(() => {
    const r = root.current!
    const q = <T extends Element = HTMLElement>(s: string) => r.querySelector(s) as T
    const qa = <T extends Element = HTMLElement>(s: string) => [...r.querySelectorAll(s)] as T[]
    const narrow = innerWidth < 900
    const finish = () => {
      if (done.current) return; done.current = true
      gsap.to(r, { autoAlpha: 0, duration: reduced ? 0 : 0.6, ease: 'power2.inOut', onComplete: onDone })
    }
    finishRef.current = finish
    // last resort: never hold a visitor on the title frame if the archive fails to report ready
    const end = () => { ended.current = true; onTitle(); if (sceneReadyRef.current) finish(); else setTimeout(finish, 12000) }

    // traces from each sentence to its fields: out along the line, a 45° step, then across
    const svg = q<SVGSVGElement>('.g-links'), card = q('.g-card')
    const links: SVGPathElement[][] = lines.map(() => [])
    if (!narrow) {
      const cb = card.getBoundingClientRect()
      // measure with the final text in place (the placeholders are a different width), then restore
      const bs = qa<HTMLElement>('.g-line b'), held = bs.map((b) => b.textContent)
      bs.forEach((b) => { b.textContent = b.dataset.v! })
      const ends = qa('.g-line').map((el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rc = [...rg.getClientRects()].filter((x) => x.width); return rc[rc.length - 1] })
      bs.forEach((b, i) => { b.textContent = held[i] })
      qa('.g-line').forEach((_, i) => {
        const e = ends[i]; if (!e) return
        const x0 = e.right + 16, y0 = e.top + e.height * 0.55
        for (const k of lines[i].fields) {
          const f = q(`.g-f[data-k="${k}"]`).getBoundingClientRect(), x1 = cb.left - 10, y1 = f.top + f.height / 2
          const dy = y1 - y0, xm = Math.max(x0 + 24, x1 - 40 - Math.abs(dy))
          const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          p.setAttribute('d', `M${x0},${y0} H${xm} L${xm + Math.abs(dy)},${y1} H${x1}`)
          svg.appendChild(p); links[i].push(p)
        }
      })
    }

    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: end })
    const fieldIn = (k: string) => {
      const f = q(`.g-f[data-k="${k}"]`), v = f.querySelector('b')!
      return gsap.timeline().to(f, { autoAlpha: 1, duration: 0.18 }).to(v, { duration: 0.32, scrambleText: { text: v.dataset.v!, chars: HEX, speed: 0.9 } }, 0)
    }
    tl.set(r, { autoAlpha: 1 })
      .call(() => skipBtn.current?.focus({ preventScroll: true }))
      .to(q('.g-read'), { duration: 0.35, text: { value: 'READING YOUR BROWSER', delimiter: '' }, ease: 'none' })
      .fromTo(q('.g-rule'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.6, ease: 'power3.inOut' }, '<')
      .fromTo(qa('.g-card-frame path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, stagger: 0.05 }, 0.15)
      .to(q('.g-card-h'), { autoAlpha: 1, duration: 0.25 }, 0.3)
      .addLabel('recon', 0.35)
    lines.forEach((ln, i) => {
      const at = `recon+=${(i * 0.66).toFixed(2)}`
      const el = qa('.g-line')[i]
      tl.fromTo(el, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power3.out' }, at)
      el.querySelectorAll<HTMLElement>('b').forEach((b) => tl.to(b, { duration: 0.42, scrambleText: { text: b.dataset.v!, chars: HEX, speed: 0.9 } }, '<'))
      if (links[i].length) tl.fromTo(links[i], { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.38, ease: 'power2.out' }, '<0.12')
      ln.fields.forEach((k, j) => tl.add(fieldIn(k), j ? '<0.08' : '<0.22'))
    })
    tl.set(q('.g-fp'), { autoAlpha: 1 }, '-=0.2')
      .fromTo(qa('.g-fp path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.55, stagger: 0.015, ease: 'power2.out' }, '<')
      .to(q('.g-fp-h b'), { duration: 0.4, scrambleText: { text: fp, chars: HEX } }, '<0.2')
      .to(q('.g-count'), { duration: 0.3, text: { value: `${visitor.ms} ms`, delimiter: '' }, ease: 'none' }, '<')
      // the turn: this is what an attacker would build
      .to([...qa('.g-line'), q('.g-links')], { opacity: 0.22, duration: 0.35 }, '+=0.15')
      .fromTo(q('.g-p1'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' }, '<')
      .fromTo(q('.g-p2'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' }, '+=0.45')
      .to(q('.g-card-h span'), { duration: 0.4, scrambleText: { text: 'ATTACK PROFILE', chars: HEX } }, '<')
      .to(r, { '--card-ink': 'var(--alert)', duration: 0.3 }, '<')
    qa('.g-note').forEach((n, i) => {
      tl.fromTo(n.querySelector('i'), { scaleX: 0 }, { scaleX: 1, duration: 0.2, ease: 'power2.out' }, i ? '<0.3' : '+=0.1')
        .to(n.querySelector('span'), { duration: 0.34, text: { value: n.dataset.v!, delimiter: '' }, ease: 'none' }, '<0.08')
    })
    // the defender: seal the profile, sign
    // hold: the notes are the point of the whole entry, give them time to be read. Nothing moves
    // here, so this is when the archive starts building behind the film (its synchronous setup
    // would be a visible hitch anywhere else); by the title frame it is compiled and ready.
    tl.call(onTitle, undefined, '+=0.05')
    tl.to([...qa('.g-line'), q('.g-links'), q('.g-p1'), q('.g-p2'), ...qa('.g-note')], { autoAlpha: 0, duration: 0.35 }, '+=1.35')
      .fromTo(q('.g-d'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, '-=0.1')
    qa<HTMLElement>('.g-f b').forEach((b, i) => {
      const n = Math.max(6, Math.min(16, (b.dataset.v ?? '').length))
      let h = (visitor.hash + i * 2654435761) >>> 0
      const cipher = Array.from({ length: n }, () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return HEX[h >>> 28] }).join('')
      tl.to(b, { duration: 0.45, scrambleText: { text: cipher, chars: HEX, speed: 1 } }, i ? '<0.03' : '<0.15')
    })
    tl.to(r, { '--card-ink': 'var(--acc)', duration: 0.3 }, '<')
      .to(q('.g-card-h span'), { duration: 0.35, scrambleText: { text: 'SEALED PROFILE', chars: HEX } }, '<')
      .fromTo(q('.m-y'), { drawSVG: '0%', visibility: 'visible' }, { drawSVG: '100%', duration: 0.4, immediateRender: false }, '<')
      .to(q('.g-card-body'), { height: 0, autoAlpha: 0, duration: 0.45, ease: 'power3.inOut' }, '<0.25')
      .fromTo(q('.g-sealed'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, '-=0.15')
      .fromTo(q('.m-w'), { drawSVG: '0%', visibility: 'visible' }, { drawSVG: '100%', duration: 0.45, immediateRender: false }, '<-0.05')
      .fromTo(q('.m-trace'), { drawSVG: '0%', visibility: 'visible' }, { drawSVG: '100%', duration: 0.3, ease: 'power1.in', immediateRender: false }, '-=0.05')
      .fromTo(q('.m-via'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.2, ease: 'back.out(3)' })
      .to(q('.g-sig b'), { duration: 0.35, text: { value: 'YAOTING WANG', delimiter: '' }, ease: 'none' }, '<')
      // the archive's name, wiped in by a highlight bar
      .to([q('.g-stage'), q('.g-read'), q('.g-rule'), q('.g-count')], { autoAlpha: 0, duration: 0.3 }, '+=0.55')
      .set(q('.g-title'), { autoAlpha: 1 })
      .fromTo(q('.g-title i'), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.3, ease: 'power3.in' })
      .set(q('.g-title span'), { autoAlpha: 1 })
      .to(q('.g-title i'), { scaleX: 0, transformOrigin: 'right center', duration: 0.36, ease: 'power3.out' })
      .call(onTitle)                          // (idempotent) in case the film was skipped before the hold
      .to(q('.g-open'), { duration: 0.45, text: { value: 'OPENING THE ARCHIVE', delimiter: '' }, ease: 'none' })
      .to({}, { duration: 0.4 })

    // reduced motion: no film. The turn is shown as one still page (recon, profile, notes), and the
    // visitor continues when ready.
    if (reduced) {
      tl.pause()
      gsap.set(r, { autoAlpha: 1 }); skipBtn.current?.focus({ preventScroll: true })
      qa<HTMLElement>('.g-line b, .g-f b').forEach((b) => { b.textContent = b.dataset.v! })
      qa<HTMLElement>('.g-note').forEach((n) => { n.querySelector('span')!.textContent = n.dataset.v! })
      gsap.set([...qa('.g-line'), ...qa('.g-f'), ...qa('.g-note'), q('.g-card-h'), q('.g-p1'), q('.g-p2'), q('.g-d')], { autoAlpha: 1 })
      q('.g-card-h span').textContent = 'ATTACK PROFILE'; q('.g-count').textContent = `${visitor.ms} ms`
      gsap.set(qa('.g-card-frame path, .g-fp path, .g-rule, .g-links path'), { drawSVG: '100%' })
    }
    // skipping jumps to the still title frame and leaves as soon as the archive is ready
    const doSkip = () => { if (ended.current) return; if (reduced) end(); else tl.progress(1) }
    skipRef.current = doSkip
    // any ordinary key skips; modifiers and shortcuts (Ctrl/Alt/Meta, screen-reader keys) do not
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS'].includes(e.key)) return
      if (e.target === skipBtn.current && (e.key === 'Enter' || e.key === ' ')) return   // the button's own click handles it
      doSkip()
    }
    const onPointer = (e: PointerEvent) => { if (e.target !== skipBtn.current) doSkip() }
    addEventListener('keydown', onKey); r.addEventListener('pointerdown', onPointer)
    return () => { tl.kill(); removeEventListener('keydown', onKey); r.removeEventListener('pointerdown', onPointer); svg.querySelectorAll('path').forEach((p) => p.remove()) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={root} className="gate" role="dialog" aria-label="Entry: what your browser told this page" style={{ visibility: 'hidden' }}>
      <p className="sr-only">
        In {visitor.ms} milliseconds this page read your device ({visitor.os}, {visitor.browser}), your local time and city ({visitor.time}, {visitor.city}), your language and your hardware, without asking.
        Put together, that is an attack profile: enough to match an exploit, time a phishing email and write it in your language.
        Nothing left your browser. This archive belongs to Yaoting Wang, security engineering.
      </p>
      <div className="g-top" aria-hidden="true">
        <div className="g-read lbl" />
        <div className="g-count lbl" />
        <svg className="g-rule-svg" viewBox="0 0 100 2" preserveAspectRatio="none"><path className="g-rule" d="M0,1 H100" /></svg>
      </div>
      <svg className="g-links" aria-hidden="true" />
      <div className="g-stage" aria-hidden="true">
        <div className="g-lines">
          {lines.map((ln, i) => (
            <div key={i} className="g-line">{ln.parts.map((p, j) => typeof p === 'string' ? <span key={j}>{p}</span> : <b key={j} data-v={p[0]}>{'0'.repeat(Math.min(p[0].length, 14))}</b>)}</div>
          ))}
          <div className="g-p1">Collected in <b>{visitor.ms} ms</b>. Without asking.</div>
          <div className="g-p2">Put together, that is an <em>attack profile</em>.</div>
          <div className="g-d">I look at systems the way an attacker would.<br />Then I close the gaps.
            <div className="g-sig">
              <svg className="g-mark" viewBox="0 0 200 90">
                <path className="m-y" d="M12,14 L38,46 L64,14 M38,46 L38,76" />
                <path className="m-w" d="M74,14 L88,76 L102,38 L116,76 L130,14" />
                <path className="m-trace" d="M130,14 L148,14 L160,26 L186,26" />
                <circle className="m-via" cx="188" cy="26" r="4.5" />
              </svg>
              <span className="lbl"><b /> · Security engineering</span>
            </div>
          </div>
        </div>
        <div className="g-card">
          <svg className="g-card-frame" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,8 V0 H8" /><path d="M92,0 H100 V8" /><path d="M100,92 V100 H92" /><path d="M8,100 H0 V92" />
          </svg>
          <div className="g-card-h lbl"><span>TARGET PROFILE</span><em>{visitor.id}</em></div>
          <div className="g-card-body">
            <dl>
              {fields.map((f) => (
                <div key={f.k} className="g-f" data-k={f.k}>
                  <dt className="lbl">{f.label}</dt><dd><b data-v={f.value}>{'·'.repeat(Math.min(f.value.length, 10))}</b></dd>
                  {f.note && <div className="g-note" data-v={f.note}><i /><span /></div>}
                </div>
              ))}
            </dl>
            <div className="g-fp">
              <svg viewBox="0 0 100 100">{arcs.map((d, i) => <path key={i} d={d} />)}</svg>
              <div className="g-fp-h lbl">Fingerprint<b>{'0'.repeat(8)}</b><span>no cookie needed</span></div>
            </div>
          </div>
          <div className="g-sealed"><i /><div><b>Never left your browser.</b><span className="lbl">Filed in the archive as {visitor.id}</span></div></div>
        </div>
      </div>
      <div className="g-title" aria-hidden="true"><i /><span>ENCRYPTED <b>ARCHIVE</b></span><div className="g-open lbl" /></div>
      <button ref={skipBtn} className="gate-skip lbl" onClick={() => skipRef.current()}>{reduced ? 'Continue ↵' : 'Skip ↵'}</button>
    </div>
  )
}
