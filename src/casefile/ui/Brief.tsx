// Home (the brief): Yaoting's sentence over the archive, the four selected files lit, each with a
// callout drawn from its drive, and the ways in. Callouts follow their drives every frame.
import { useEffect, useRef } from 'react'
import { entryById } from '../data/entries'
import { SELECTED, THESIS } from '../data/story'
import { useCtx } from './context'
import '../styles/brief.css'

const label = (id: string) => { const e = entryById.get(id)!; return e.kind === 'service' ? e.org! : e.title }

export function Brief({ hidden }: { hidden: boolean }) {
  const { archive, open, openProfile, reduced } = useCtx()
  const root = useRef<HTMLDivElement>(null)
  /** which corner each callout took last frame: kept while it stays free, so callouts do not flicker as the field breathes */
  const corner = useRef<number[]>([])

  // Callouts follow their drives while the camera opens on them, unseen. Once it has come to rest they
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
      // a phone has no floating callouts: the four files are a list under the sentence (brief.css)
      if (W < 900) { r.querySelectorAll<HTMLElement>('.brief-co').forEach((co) => { if (co.style.transform) co.style.transform = '' }); return }
      // the sentence, the actions and the header keep their space; callouts never cover them or each other
      const placed = [...r.querySelectorAll('.brief-say, .brief-act'), ...document.querySelectorAll('.hud-lock, .hud-top')].map((el) => el.getBoundingClientRect())
      const free = (b: DOMRect) => b.left >= 16 && b.right <= W - 16 && b.top >= 16 && b.bottom <= H - 16 && !placed.some((p) => b.left < p.right && b.right > p.left && b.top < p.bottom && b.bottom > p.top)
      const leads = r.querySelectorAll<SVGPathElement>('.brief-leads path')
      archive.selectedAnchors().forEach((a, i) => {
        const co = r.querySelector<HTMLElement>(`.brief-co[data-i="${i}"]`), mk = r.querySelector<SVGRectElement>(`.brief-leads rect[data-i="${i}"]`)
        if (!co || !mk) return
        mk.setAttribute('x', String(a.x - 3)); mk.setAttribute('y', String(a.y - 3))
        // beside its drive: below right first (the drives rise to the right), then the other corners
        const w = co.offsetWidth, h = co.offsetHeight, gx = 46, gy = 34
        const spots: [number, number][] = [[a.x + gx, a.y + gy], [a.x + gx, a.y - gy - h], [a.x - gx - w, a.y + gy], [a.x - gx - w, a.y - gy - h]]
        const box = ([x, y]: [number, number]) => new DOMRect(x - 8, y - 6, w + 16, h + 12)
        const was = corner.current[i] ?? -1
        let k = was >= 0 && spots[was] && free(box(spots[was])) ? was : spots.findIndex((p) => free(box(p)))
        if (k < 0) k = Math.max(0, spots.findIndex((p) => { const b = box(p); return b.left >= 16 && b.right <= W - 16 }))
        corner.current[i] = k
        const [x, y] = spots[k]
        placed.push(box([x, y]))
        co.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
        const left = x < a.x, ex = left ? x + w + 8 : x - 8, ey = y + h / 2 < a.y ? y + h - 8 : y + 10
        leads[i]?.setAttribute('d', `M${a.x},${a.y} L${ex + (left ? 14 : -14)},${ey} H${ex}`)
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
      <svg className="brief-leads" aria-hidden="true">{SELECTED.map((s, i) => <g key={s.id} data-i={i}><path /><rect data-i={i} width="6" height="6" /></g>)}</svg>
      <ol className="brief-cos" aria-label="Start here">
        {SELECTED.map((s, i) => (
          <li key={s.id}>
            <button className="brief-co" data-i={i} onClick={() => go(s.id)}>
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
