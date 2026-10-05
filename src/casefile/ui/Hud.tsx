// Archive HUD. Only what helps a reader see what Yaoting can do (spec G13): the name, the
// selected drive's panel, the legend, and one quiet footer line. Everything else is
// on demand (Index). A hairline leader connects the selected drive to its panel (spec D2).
import { useEffect, useRef, useState } from 'react'
import { CONTACT, ENTRIES } from '../data/entries'
import { DRAWERS } from '../data/roles'
import { entryById } from '../data/entries'
import { KIND_NAME, type Entry } from '../data/types'
import { wrap, LANES } from '../motion/grid'
import { sealedId } from '../model/archive'
import { inGroup, type KindGroup } from '../scene/archive'
import { Brief } from './Brief'
import { useCtx, useSnapshot } from './context'

const pad = (n: number) => String(n).padStart(2, '0')
const kindLabel = (e: Entry) => KIND_NAME[e.kind]
const small = (e: Entry) => e.kind === 'skill' || e.kind === 'credential'

export function Hud({ statusLine, hidden, arriving }: { statusLine: { html: string; key: number } | null; hidden: boolean; arriving: boolean }) {
  const { archive, open } = useCtx()
  const s = useSnapshot()
  const [index, setIndex] = useState(false)
  const [contact, setContact] = useState(false)
  const [hint, setHint] = useState(() => { try { return localStorage.getItem('yw.hint') !== '1' } catch { return true } })
  useEffect(() => { if (!hint || hidden) return; const h = setTimeout(() => { setHint(false); try { localStorage.setItem('yw.hint', '1') } catch { /* */ } }, 12000); return () => clearTimeout(h) }, [hint, hidden])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === '/' && s.mode === 'archive') { e.preventDefault(); setIndex((v) => !v) } else if (e.key === 'Escape') { setIndex(false); setContact(false) } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [s.mode])

  const e = s.entry, lane = wrap(s.sel.lane, LANES), drawer = DRAWERS[lane]
  const locked = archive.isLocked(e), dead = archive.isShredded(e)
  const hide = hidden || s.mode !== 'archive'
  /** home: the brief replaces the browsing HUD */
  const brief = s.brief && s.mode === 'archive'

  return (
    <div className={`hud ${hidden ? '' : 'on'} ${s.mode !== 'archive' ? 'dim' : ''} ${brief ? 'hud--brief' : ''}`} aria-hidden={hidden}>
      <button className="hud-lock" aria-label="Yaoting Wang, Security Analyst: home" onClick={() => { if (s.mode === 'archive') { setIndex(false); setContact(false); archive.setBrief(true) } }}>
        <span className="a">YAOTING WANG</span><span className="b">SECURITY ANALYST<span className="loc"> · VANCOUVER, BC</span></span>
      </button>
      <Brief hidden={hidden || !brief || index || contact} />
      <div className="hud-top">
        <button className="hud-index-btn" aria-expanded={contact} onClick={() => { setContact((v) => !v); setIndex(false) }}><span>Contact</span></button>
        <button className="hud-index-btn" aria-expanded={index} onClick={() => { setIndex((v) => !v); setContact(false) }}><span aria-hidden="true">⌕</span><span>Index</span><kbd>/</kbd></button>
      </div>
      {index && <IndexPanel onPick={(id) => { setIndex(false); archive.setBrief(false); archive.jumpTo(id) }} />}
      {contact && <ContactPanel />}

      <Leader entry={e} hidden={hide} />
      <SearchReadout hidden={hidden || !arriving} />
      <section className={`panel ${hide || index || contact ? 'hide' : ''} ${e && !s.plain ? 'sealed' : ''} ${!e ? 'empty' : ''}`} aria-live="polite">
        <div className="panel-status lbl" key={statusLine?.key ?? 0} dangerouslySetInnerHTML={{ __html: statusLine?.html ?? '' }} />
        <div className="panel-body" key={`${s.sel.lane}:${s.sel.row}:${s.plain}:${dead}:${s.captured}`}>
          <div className="panel-eyebrow lbl"><span>{e ? kindLabel(e) : 'No record'}</span>{e?.kind === 'restricted' && <span className="kind x">Restricted</span>}</div>
          <div className="panel-id"><span>{e && s.plain ? (e.kind === 'service' ? 'RECORD' : e.kind === 'skill' ? 'SKILL' : e.kind === 'credential' ? 'CREDENTIAL' : 'FILE') : 'DRIVE'}</span> {e ? e.id : sealedId(s.sel)}</div>
          {e && s.plain && small(e) ? (
            <>
              <h2 className="panel-title">{e.title}</h2>
              <div className="panel-sub">{e.kicker}</div>
              {e.kind === 'credential' ? <p className="panel-sum">{e.summary}</p> : (
                <div className="evidence">
                  <div className="lbl">Proven in</div>
                  {e.evidence?.map((id) => { const r = entryById.get(id)!; return <button key={id} onClick={() => { archive.jumpTo(id) }}><span className="lbl">{r.id}</span>{r.kind === 'service' ? r.org : r.title}</button> })}
                </div>
              )}
              {e.kind === 'skill' && <button className="go" onClick={open}><b>Open evidence</b><kbd>ENTER</kbd><span aria-hidden="true">→</span></button>}
            </>
          ) : e && s.plain ? (
            <>
              <h2 className="panel-title">{locked ? '[REDACTED]' : e.title}</h2>
              <div className="panel-sub">{e.kind === 'service' || e.kind === 'education' ? `${e.org} · ${e.dates}` : e.year ? `${e.kicker.replace(/^Project · /, '')} · ${e.year}` : e.kicker}</div>
              <p className="panel-sum">{e.summary}</p>
              {(dead || locked) && <dl className="policy"><dt className="lbl">{dead ? 'Status' : 'Access'}</dt><dd className="x">{dead ? 'Crypto-shredded · key zeroized' : 'Held by an AI guard · SENTINEL-1'}</dd></dl>}
              <button className="go" onClick={open}><b>{dead ? 'Restore & open' : locked ? 'Request clearance' : 'Open'}</b><kbd>ENTER</kbd><span aria-hidden="true">→</span></button>
            </>
          ) : e ? (
            <>
              <h2 className="panel-title muted">Sealed</h2>
              <p className="panel-sum">{s.granted ? 'Decrypting…' : 'Your read access is issued at the end of the briefing.'}</p>
            </>
          ) : (
            <>
              <h2 className="panel-title muted">Encrypted</h2>
              <p className="panel-sum">No file on this drive. The drives that glow hold one.</p>
            </>
          )}
        </div>
        <div className="panel-step" aria-label="Browse drives">
          <button aria-label="Previous drive" onClick={() => archive.move(0, -1)}>‹</button>
          <button aria-label="Next drive" onClick={() => archive.move(0, 1)}>›</button>
        </div>
      </section>

      <div className={`hud-sel ${hide ? 'hide' : ''}`}>
        <div className="lbl">Drawer {pad(lane + 1)} of {pad(DRAWERS.length)}</div>
        <div className="drawer-nav">
          <button aria-label="Previous drawer" onClick={() => archive.move(-1, 0)}>←</button>
          <span>{drawer.name}</span>
          <button aria-label="Next drawer" onClick={() => archive.move(1, 0)}>→</button>
        </div>
        <div className="lbl pos">{posInDrawer(lane, e)}</div>
      </div>
      <HoverLabel />

      <KindKey hidden={hide} />

      {hint && !hide && <div className="hud-hint lbl">← → drawers / ↑ ↓ drives / enter open / click a drive</div>}
      <div className="hud-foot lbl">
        <span className="risk" data-lvl={s.riskLevel} tabIndex={0} aria-describedby="risk-tip"><span className="rb"><i style={{ width: `${s.risk}%` }} /></span>risk {pad(s.risk)}
          <span className="tip" id="risk-tip" role="tooltip">How suspicious this session looks to this site’s behaviour analytics (UEBA). Denied drives, rapid scanning and shredding raise it; it cools down on its own.</span>
        </span>
        <PrivacyStat />
        <button aria-label="Replay the intro" title="Replay the intro" onClick={() => { try { localStorage.removeItem('yw.entry') } catch { /* */ } location.reload() }}>↺</button>
      </div>
    </div>
  )
}

// The legend, in the corner a map keeps it: what each drive shape means. Hover (or focus) a kind
// and only those drives stay lit; click to keep it.
const KINDS: [KindGroup, string][] = [['service', 'Experience'], ['case', 'Projects'], ['education', 'Education'], ['skill', 'Skills']]
function Glyph({ k }: { k: KindGroup }) {
  const short = k === 'skill', end = k === 'service' ? 'ink' : k === 'education' ? 'gold' : null
  return (
    <svg className={`kk-g ${k}`} width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
      <rect className="b" x={short ? 5.5 : 0.5} y="1.5" width={short ? 11 : 21} height="5" rx="1" />
      {end && <><rect className={end} x="0.5" y="1.5" width="2.5" height="5" /><rect className={end} x="19" y="1.5" width="2.5" height="5" /></>}
    </svg>
  )
}
function KindKey({ hidden }: { hidden: boolean }) {
  const { archive } = useCtx()
  const s = useSnapshot()
  const [pinned, setPinned] = useState<KindGroup | null>(null)
  const show = (k: KindGroup | null) => archive.setKindFocus(k ?? pinned)
  useEffect(() => () => archive.setKindFocus(null), [archive])
  return (
    <div className={`kind-key lbl ${hidden ? 'hide' : ''}`} role="group" aria-label="What the drives hold" onMouseLeave={() => show(null)}>
      {KINDS.map(([k, name]) => {
        const n = ENTRIES.filter((e) => inGroup(e, k) && archive.isReadable(e)).length
        return (
          <button key={k} className={s.kindFocus === k ? 'on' : ''} aria-pressed={pinned === k}
            onMouseEnter={() => show(k)} onFocus={() => show(k)} onBlur={() => show(null)}
            onClick={() => { const next = pinned === k ? null : k; setPinned(next); archive.setKindFocus(next) }}>
            <Glyph k={k} /><span>{name}</span><b>{n}</b>
          </button>
        )
      })}
    </div>
  )
}

// A temporary readout follows the entrance's selection, then yields to the file panel.
function SearchReadout({ hidden }: { hidden: boolean }) {
  const { archive, reduced } = useCtx()
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hidden || reduced) return
    let raf = 0
    const draw = () => {
      const r = root.current, age = archive.entranceAge()
      raf = requestAnimationFrame(draw)
      if (!r) return
      if (archive.entranceDone()) { r.style.opacity = '0'; return }
      const W = innerWidth, H = innerHeight, phone = W < 900
      const x = phone ? W * 0.43 : W * 0.57, y = phone ? H * 0.49 : H * 0.53
      const path = r.querySelector('path'), mark = r.querySelector('rect'), text = r.querySelector<HTMLElement>('span')
      const target = archive.anchor(), found = age >= 2.65
      const ax = found && target ? Math.max(16, Math.min(x - 16, target.x)) : x - 24
      const ay = found && target ? Math.max(H * 0.22, Math.min(H * 0.7, target.y)) : y + 18
      path?.setAttribute('d', 'M' + ax + ',' + ay + ' L' + (x - 12) + ',' + (y + 18) + ' H' + (W - Math.max(24, W * 0.033)))
      mark?.setAttribute('x', String(ax - 1.5)); mark?.setAttribute('y', String(ay - 1.5))
      if (text) {
        text.style.transform = 'translate(' + x + 'px,' + y + 'px)'
        const value = found ? 'File ' + (archive.selected?.id ?? '') : 'Selecting files…'
        text.textContent = value.slice(0, Math.max(0, Math.floor((found ? age - 2.65 : age - 0.25) * 24)))
      }
      r.style.opacity = String(Math.min(1, Math.max(0, (age - 0.3) * 3)))
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [archive, hidden, reduced])
  return reduced ? null : <div className="search-readout" ref={root} aria-hidden="true"><svg><path /><rect width="3" height="3" /></svg><span /></div>
}

// hairline from the selected drive to the panel; redraws on every selection
function Leader({ entry, hidden }: { entry: Entry | null; hidden: boolean }) {
  const { archive } = useCtx()
  const s = useSnapshot()
  const ref = useRef<SVGPathElement>(null), dot = useRef<SVGCircleElement>(null), marks = useRef<SVGGElement>(null)
  useEffect(() => {
    let raf = 0
    const f = () => {
      raf = requestAnimationFrame(f)
      const a = archive.anchor(), panel = document.querySelector('.panel-eyebrow')?.getBoundingClientRect()
      // four small black squares bracket the selected drive (after the PV's "selecting files")
      const b = archive.screenBox(), m = marks.current
      if (b && m) {
        const o = 10, pts = [[b.x0 - o, b.y0 - o], [b.x1 + o, b.y0 - o], [b.x1 + o, b.y1 + o], [b.x0 - o, b.y1 + o]]
        m.querySelectorAll('rect').forEach((r, i) => { r.setAttribute('x', String(pts[i][0] - 3)); r.setAttribute('y', String(pts[i][1] - 3)) })
      }
      if (!a || !panel || !ref.current || innerWidth < 900) return
      const px = panel.left - 14, py = panel.top + panel.height / 2, mx = a.x + (px - a.x) * 0.35
      ref.current.setAttribute('d', `M${a.x},${a.y} L${mx},${py} L${px},${py}`)
      dot.current?.setAttribute('cx', String(a.x)); dot.current?.setAttribute('cy', String(a.y))
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [archive])
  return (
    <svg className={`leader ${hidden ? 'hide' : ''} ${entry && s.plain ? 'lit' : ''}`} aria-hidden="true">
      <path ref={ref} key={`${s.sel.lane}:${s.sel.row}`} pathLength={1} />
      <circle ref={dot} r="2.5" />
    </svg>
  )
}

function IndexPanel({ onPick }: { onPick: (id: string) => void }) {
  const { archive } = useCtx()
  const groups: [string, Entry[]][] = [
    ['Profile', ENTRIES.filter((e) => e.kind === 'subject' || e.kind === 'visitor')],
    ['Experience', ENTRIES.filter((e) => e.kind === 'service')],
    ['Education', ENTRIES.filter((e) => e.kind === 'education')],
    ['Projects', ENTRIES.filter((e) => e.kind === 'case' || e.kind === 'restricted')],
  ]
  return (
    <div className="index" role="dialog" aria-label="Archive index">
      {groups.map(([name, list]) => (
        <div key={name} className="index-group">
          <div className="lbl index-h">{name}</div>
          {list.map((e) => {
            const plain = archive.isReadable(e)
            return (
              <button key={e.id} onClick={() => onPick(e.id)}>
                <span className="n">{e.id}</span>
                <span className="t">{archive.isLocked(e) ? '[REDACTED]' : e.kind === 'service' ? e.org : e.title}<small>{e.kind === 'service' ? e.title : e.kind === 'education' ? `${e.org} · ${e.dates}` : e.year ? `${e.kicker.replace(/^Project · /, '')} · ${e.year}` : e.kicker}</small></span>
                <span className={`st ${plain ? '' : 'x'}`}>{archive.isShredded(e) ? 'shredded' : plain ? '' : 'sealed'}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// hover a drive to see what it is without opening it
function HoverLabel() {
  const { archive } = useCtx()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0, last = ''
    const f = () => {
      raf = requestAnimationFrame(f)
      const el = ref.current; if (!el) return
      const h = archive.hovered()
      const selKey = `${archive.getSnapshot().sel.lane}:${archive.getSnapshot().sel.row}`
      // never over the panel: the right side of the screen belongs to the selected file
      if (!h || `${h.cell.lane}:${h.cell.row}` === selKey || h.x > innerWidth * 0.56 || h.y < 90) { el.classList.remove('on'); return }
      const e = h.entry, plain = archive.isReadable(e)
      const text = e ? (plain ? `${e.id}|${e.kind === 'service' ? e.org : e.title}|${kindLabel(e)}` : `${e.id}|Sealed|${kindLabel(e)}`) : `${sealedId(h.cell)}|Encrypted|No record`
      if (text !== last) { const [a, b, c] = text.split('|'); el.innerHTML = ''; for (const [cls, t] of [['n', a], ['t', b], ['k', c]]) { const sp = document.createElement('span'); sp.className = cls; sp.textContent = t; el.appendChild(sp) } last = text }
      el.style.transform = `translate(${Math.round(h.x)}px, ${Math.round(h.y)}px)`
      el.classList.add('on'); el.classList.toggle('sealed', !plain)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [archive])
  return <div ref={ref} className="hover-label" aria-hidden="true" />
}

/** "3 of 7 in this drawer": where the selection sits among the drawer's records. */
function posInDrawer(lane: number, e: Entry | null) {
  const rows = ENTRIES.filter((x) => x.slot.lane === lane).map((x) => x.slot.row).sort((a, b) => a - b)
  if (!e) return `${rows.length} records in this drawer`
  return `${rows.indexOf(e.slot.row) + 1} of ${rows.length} in this drawer`
}

function ContactPanel() {
  return (
    <nav className="index contact" aria-label="Contact">
      <div className="lbl index-h">Contact</div>
      <a href={`mailto:${CONTACT.email}`}><span className="n">Email</span><span className="t">{CONTACT.email}</span><span aria-hidden="true">→</span></a>
      <a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer"><span className="n">LinkedIn</span><span className="t">in/yaoting-wang</span><span aria-hidden="true">↗</span></a>
      <a href={CONTACT.github} target="_blank" rel="noopener noreferrer"><span className="n">GitHub</span><span className="t">github.com/JoKFA</span><span aria-hidden="true">↗</span></a>
    </nav>
  )
}

// The recon claims nothing leaves the browser; this lets anyone check it. Counted live in the page:
// requests to any other origin, and cookies. The link runs Mozilla's header scan on this host.
const OBSERVATORY = `https://developer.mozilla.org/en-US/observatory/analyze?host=${typeof location !== 'undefined' ? location.hostname : ''}`
function PrivacyStat() {
  const [n, setN] = useState({ third: 0, cookies: 0 })
  useEffect(() => {
    const f = () => {
      const third = performance.getEntriesByType('resource').filter((r) => { try { const u = new URL(r.name, location.href); return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== location.origin } catch { return false } }).length
      const cookies = document.cookie ? document.cookie.split(';').filter((c) => c.trim()).length : 0
      setN((o) => (o.third === third && o.cookies === cookies ? o : { third, cookies }))
    }
    f(); const h = setInterval(f, 4000); return () => clearInterval(h)
  }, [])
  return (
    <span className="privacy" title="Counted live in this page">
      <b>{n.third}</b> trackers · <b>{n.cookies}</b> cookies · <a href={OBSERVATORY} target="_blank" rel="noopener noreferrer">headers ↗</a>
    </span>
  )
}
