// Home (the brief): Yaoting's sentence over the archive, the four selected files standing up in their
// own slots, a list of them under the sentence, and the ways in. Each drive carries its list number.
import { useEffect, useRef } from 'react'
import { entryById } from '../data/entries'
import { SELECTED, THESIS } from '../data/story'
import { useCtx } from './context'
import '../styles/brief.css'

const label = (id: string) => { const e = entryById.get(id)!; return e.kind === 'service' ? e.org! : e.title }

export function Brief({ hidden }: { hidden: boolean }) {
  const { archive, open, openProfile, reduced } = useCtx()
  const root = useRef<HTMLDivElement>(null)

  // The numbers follow their drives while the camera opens on them, unseen. Once it has come to rest they
  // fade in, 01 → 04, 80 ms apart, and stay exactly where they were placed: nothing moves while it is read.
  useEffect(() => {
    const r = root.current
    if (hidden) { if (r && !archive.brief) r.classList.remove('brief--lit'); return }
    let raf = 0, calm = 0, frozen = false
    const unfreeze = () => { frozen = false; calm = 0; root.current?.classList.remove('brief--lit') }
    addEventListener('resize', unfreeze)
    const f = () => {
      raf = requestAnimationFrame(f)
      const r = root.current; if (!r || frozen) return
      const W = innerWidth, H = innerHeight
      // a phone has no numbers on drives: the four files are a list under the sentence (brief.css)
      if (W < 900) { const list = r.querySelector<HTMLElement>('.brief-cos'); if (list?.style.top) { list.style.top = ''; list.classList.remove('tight') } return }
      // the list follows the sentence down the left margin; in a short window it drops the second lines
      const list = r.querySelector<HTMLElement>('.brief-cos'), say = r.querySelector('.brief-say'), act = r.querySelector('.brief-act')
      if (list && say && act) {
        const top = Math.round(say.getBoundingClientRect().bottom + 40)
        list.style.top = `${top}px`
        list.classList.remove('tight')
        if (top + list.scrollHeight > Math.min(H - 24, act.getBoundingClientRect().top - 16)) list.classList.add('tight')
      }
      // each drive's number stands just off its top corner, on a short tick
      const leads = r.querySelectorAll<SVGPathElement>('.brief-leads path')
      archive.selectedAnchors().forEach((a, i) => {
        const mk = r.querySelector<SVGRectElement>(`.brief-leads rect[data-i="${i}"]`), n = r.querySelector<SVGTextElement>(`.brief-leads text[data-i="${i}"]`)
        const x = Math.round(a.x), y = Math.round(a.y)
        mk?.setAttribute('x', String(x - 2)); mk?.setAttribute('y', String(y - 2))
        n?.setAttribute('x', String(x + 14)); n?.setAttribute('y', String(y - 10))
        leads[i]?.setAttribute('d', `M${x + 3},${y - 3} L${x + 11},${y - 11}`)
      })
      // at rest for a few frames: show them, and stop moving them
      calm = archive.briefSettled() ? calm + 1 : 0
      if (calm >= 4) { frozen = true; r.classList.add('brief--lit') }
    }
    raf = requestAnimationFrame(f)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', unfreeze) }
  }, [archive, hidden])

  /** Open a selected file from home: step into the archive on its drive, then open it. */
  const go = (id: string) => {
    archive.setBrief(false); archive.jumpTo(id)
    setTimeout(open, reduced ? 0 : 350)
  }

  return (
    <div ref={root} className={`brief ${hidden ? 'hide' : ''}`} aria-hidden={hidden} inert={hidden}>
      <svg className="brief-leads" aria-hidden="true">{SELECTED.map((s, i) => <g key={s.id} data-i={i}><path /><rect data-i={i} width="6" height="6" /><text data-i={i}>{String(i + 1).padStart(2, '0')}</text></g>)}</svg>
      <ol className="brief-cos" aria-label="Start here">
        {SELECTED.map((s, i) => (
          <li key={s.id}>
            <button className="brief-co" data-i={i} onClick={() => go(s.id)}
              onPointerEnter={() => { archive.pointSelected(i); root.current?.setAttribute('data-point', String(i)) }}
              onPointerLeave={() => { archive.pointSelected(null); root.current?.removeAttribute('data-point') }}
              onFocus={() => { archive.pointSelected(i); root.current?.setAttribute('data-point', String(i)) }}
              onBlur={() => { archive.pointSelected(null); root.current?.removeAttribute('data-point') }}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span><span className="k lbl">{s.tag}</span>
              <span className="t">{label(s.id)}</span>
              <span className="l">{s.line}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="brief-say">
        <h1 className="brief-thesis"><b>{THESIS.lead}</b> {THESIS.rest}</h1>
        <p className="brief-meta">Master of Cybersecurity, SFU · CCNA · Security+ · Full-time from Apr 2027</p>
      </div>
      <div className="brief-act">
        <button className="brief-inside" onClick={openProfile}>Inside my drive: six areas <span aria-hidden="true">→</span></button>
        <button className="brief-enter" onClick={() => archive.setBrief(false)}>Enter the archive <span aria-hidden="true">→</span></button>
      </div>
    </div>
  )
}
