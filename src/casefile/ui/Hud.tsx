// Archive HUD. Only what helps a reader see what Yaoting can do (spec G13): the name, the
// selected drive's panel, the "Hiring for" lens, and one quiet footer line. Everything else is
// on demand (Index). A hairline leader connects the selected drive to its panel (spec D2).
import { useEffect, useRef, useState } from 'react'
import { CONTACT, ENTRIES } from '../data/entries'
import { DRAWER_ROLE, DRAWERS, ROLES, roleById } from '../data/roles'
import { entryById } from '../data/entries'
import type { Entry, Lens } from '../data/types'
import { wrap, LANES } from '../motion/grid'
import { sealedId } from '../model/archive'
import { useCtx, useSnapshot } from './context'

const pad = (n: number) => String(n).padStart(2, '0')
const kindLabel = (e: Entry) => ({ service: 'Service record', education: 'Education', case: 'Case file', subject: 'Subject file', restricted: 'Restricted', visitor: 'Visitor file', skill: 'Skill', credential: 'Credential' } as const)[e.kind]
const small = (e: Entry) => e.kind === 'skill' || e.kind === 'credential'

export function Hud({ statusLine, hidden, offer, onOfferDone }: { statusLine: { html: string; key: number } | null; hidden: boolean; offer: boolean; onOfferDone: () => void }) {
  const { archive, open, status } = useCtx()
  const s = useSnapshot()
  const [index, setIndex] = useState(false)
  const [contact, setContact] = useState(false)
  const [tour, setTour] = useState(false)
  const tourContact = useRef(false), contactBtn = useRef<HTMLButtonElement>(null)
  const [hint, setHint] = useState(() => { try { return localStorage.getItem('yw.hint') !== '1' } catch { return true } })
  useEffect(() => { if (!hint || hidden) return; const h = setTimeout(() => { setHint(false); try { localStorage.setItem('yw.hint', '1') } catch { /* */ } }, 12000); return () => clearTimeout(h) }, [hint, hidden])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === '/' && s.mode === 'archive') { e.preventDefault(); setIndex((v) => !v) } else if (e.key === 'Escape') { setIndex(false); setContact(false) } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [s.mode])
  // the first-visit offer goes away with the first thing the visitor does
  // (the baseline is taken when the offer appears, i.e. after the entry selected the subject file)
  const firstSel = useRef<string | null>(null)
  useEffect(() => {
    const now = `${s.sel.lane}:${s.sel.row}:${s.lens}`
    if (!offer) { firstSel.current = null; return }
    if (firstSel.current === null) { firstSel.current = now; return }
    if (!tour && now !== firstSel.current) onOfferDone()
  }, [offer, tour, s.sel.lane, s.sel.row, s.lens, onOfferDone])
  useEffect(() => { if (!offer || hidden) return; const h = setTimeout(onOfferDone, 16000); return () => clearTimeout(h) }, [offer, hidden, onOfferDone])

  const e = s.entry, lane = wrap(s.sel.lane, LANES), drawer = DRAWERS[lane]
  const locked = archive.isLocked(e), dead = archive.isShredded(e)
  const setLens = (l: Lens) => {
    archive.setLens(l)
    if (l !== 'all') archive.showDrawer(DRAWER_ROLE.indexOf(l))
    status(l === 'all' ? 'Viewing as <b>any role</b> · everything readable' : `Viewing as <b>${roleById(l).name}</b> · ${roleById(l).seats}`, 4200)
  }
  const lensName = s.lens === 'all' ? 'any role' : roleById(s.lens).name
  const hide = hidden || s.mode !== 'archive'

  return (
    <div className={`hud ${hidden ? '' : 'on'} ${s.mode !== 'archive' ? 'dim' : ''}`} aria-hidden={hidden}>
      <div className="hud-lock"><div className="a">YAOTING WANG</div><div className="b">ANALYST &amp; ENGINEER<span className="loc"> · VANCOUVER, BC</span></div><div className="c">SECURITY <b>PORTFOLIO</b></div></div>
      <div className="hud-top">
        <button ref={contactBtn} className="hud-index-btn" aria-expanded={contact} onClick={() => { tourContact.current = false; setContact((v) => !v); setIndex(false) }}><span>Contact</span></button>
        <button className="hud-index-btn" aria-expanded={index} onClick={() => { setIndex((v) => !v); setContact(false) }}><span aria-hidden="true">⌕</span><span>Index</span><kbd>/</kbd></button>
      </div>
      {index && <IndexPanel onPick={(id) => { setIndex(false); archive.jumpTo(id) }} />}
      {contact && <ContactPanel />}

      <Leader entry={e} hidden={hide} />
      <section className={`panel ${hide || index || contact ? 'hide' : ''} ${e && !s.plain ? 'sealed' : ''} ${!e ? 'empty' : ''}`} aria-live="polite">
        {offer && !statusLine && !tour ? (
          <div className="panel-status offer lbl">
            <span>Hiring for a specific role? Pick it {innerWidth < 900 ? 'above' : 'below'}.</span>
            <button onClick={() => { setTour(true) }}>Or take the {TOUR_SECONDS}-second tour <span aria-hidden="true">→</span></button>
          </div>
        ) : <div className="panel-status lbl" key={statusLine?.key ?? 0} dangerouslySetInnerHTML={{ __html: statusLine?.html ?? '' }} />}
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
              <div className="panel-sub">{e.kind === 'service' || e.kind === 'education' ? `${e.org} · ${e.dates}` : e.year ? `${e.kicker.replace(/^Case file · /, '')} · ${e.year}` : e.kicker}</div>
              <p className="panel-sum">{e.summary}</p>
              {(dead || locked) && <dl className="policy"><dt className="lbl">{dead ? 'Status' : 'Access'}</dt><dd className="x">{dead ? 'Crypto-shredded · key zeroized' : 'Held by an AI guard · SENTINEL-1'}</dd></dl>}
              <button className="go" onClick={open}><b>{dead ? 'Restore & open' : locked ? 'Request clearance' : 'Open'}</b><kbd>ENTER</kbd><span aria-hidden="true">→</span></button>
            </>
          ) : e ? (
            <>
              <h2 className="panel-title muted">Sealed</h2>
              <p className="panel-sum">{s.lens === 'all' ? 'Decrypting…' : `Not part of the ${lensName} file.`}</p>
              <dl className="policy">
                <dt className="lbl">Access</dt><dd>{e.roles === 'all' ? 'Everyone' : e.roles.map((r) => roleById(r).name).join(' · ')}</dd>
                <dt className="lbl">Least privilege</dt><dd>You&rsquo;re viewing as {lensName}</dd>
              </dl>
              {e.roles !== 'all' && <button className="go acc" onClick={open}><b>View as {roleById(e.roles[0]).name}</b><kbd>ENTER</kbd><span aria-hidden="true">→</span></button>}
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

      <div className={`hud-sel ${hide || tour ? 'hide' : ''}`}>
        <div className="lbl">Drawer {pad(lane + 1)} of {pad(DRAWERS.length)}</div>
        <div className="drawer-nav">
          <button aria-label="Previous drawer" onClick={() => archive.move(-1, 0)}>←</button>
          <span>{drawer.name}</span>
          <button aria-label="Next drawer" onClick={() => archive.move(1, 0)}>→</button>
        </div>
        <div className="lbl pos">{posInDrawer(lane, e)}</div>
      </div>
      <HoverLabel />

      {tour && <Tour onEnd={() => {
        setTour(false); onOfferDone()
        if (tourContact.current) { setContact(false); tourContact.current = false }
        requestAnimationFrame(() => contactBtn.current?.focus({ preventScroll: true }))
      }} openContact={() => { tourContact.current = true; setContact(true) }} />}
      <nav className={`lens ${hide || tour ? 'hide' : ''}`} aria-label="Hiring for">
        <span className="lbl">Hiring for</span>
        <div className="lens-list">
          {[...ROLES.map((r) => [r.id, r.name] as const), ['all', 'Any role'] as const].map(([id, name], i) => (
            <span key={id} className="lens-item">{i > 0 && <i aria-hidden="true">/</i>}
              <button aria-pressed={s.lens === id} className={s.lens === id ? 'on' : ''} onClick={(ev) => { setLens(id); if (ev.detail > 0) ev.currentTarget.blur() }}>{name}</button>
            </span>
          ))}
        </div>
        <span className="lbl cnt">{s.readable} readable</span>
      </nav>

      {hint && !hide && !tour && <div className="hud-hint lbl">← → drawers / ↑ ↓ drives / enter open / click a drive</div>}
      <div className={`hud-foot lbl ${tour ? 'hide' : ''}`}>
        <span className="risk" data-lvl={s.riskLevel} tabIndex={0} aria-describedby="risk-tip"><span className="rb"><i style={{ width: `${s.risk}%` }} /></span>risk {pad(s.risk)}
          <span className="tip" id="risk-tip" role="tooltip">How suspicious this session looks to this site’s behaviour analytics (UEBA). Denied drives, rapid scanning and shredding raise it; it cools down on its own.</span>
        </span>
        <PrivacyStat />
        <button aria-label="Replay the intro" title="Replay the intro" onClick={() => { try { localStorage.removeItem('yw.entry') } catch { /* */ } location.reload() }}>↺</button>
      </div>
    </div>
  )
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
  const s = useSnapshot()
  const groups: [string, Entry[]][] = [
    ['Subject', ENTRIES.filter((e) => e.kind === 'subject' || e.kind === 'visitor')],
    ['Service records', ENTRIES.filter((e) => e.kind === 'service')],
    ['Education', ENTRIES.filter((e) => e.kind === 'education')],
    ['Case files', ENTRIES.filter((e) => e.kind === 'case' || e.kind === 'restricted')],
  ]
  return (
    <div className="index" role="dialog" aria-label="Archive index">
      <div className="lbl index-lens">{s.lens === 'all' ? 'Everything · viewing as any role' : `Relevant to ${roleById(s.lens).name}`}</div>
      {groups.map(([name, list]) => (
        <div key={name} className="index-group">
          <div className="lbl index-h">{name}</div>
          {list.map((e) => {
            const plain = archive.isReadable(e)
            return (
              <button key={e.id} onClick={() => onPick(e.id)}>
                <span className="n">{e.id}</span>
                <span className="t">{archive.isLocked(e) ? '[REDACTED]' : e.kind === 'service' ? e.org : e.title}<small>{e.kind === 'service' ? e.title : e.kind === 'education' ? `${e.org} · ${e.dates}` : e.year ? `${e.kicker.replace(/^Case file · /, '')} · ${e.year}` : e.kicker}</small></span>
                <span className={`st ${plain ? '' : 'x'} ${s.lens !== 'all' && plain ? 'rel' : ''}`}>{archive.isShredded(e) ? 'shredded' : s.lens === 'all' ? '' : plain ? 'relevant' : 'sealed'}</span>
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

// A 40-second guided tour for visitors short on time: selects (never opens) five stops and says
// in one line why each matters. Any key or click outside the bar ends it.
// Stops quote the files' own summaries, so any figure in them is the sourced one in entries.ts.
const lower1 = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const said = (id: string) => entryById.get(id)?.summary ?? ''
const TOUR: { id: string | null; say: string }[] = [
  { id: 'YW-000', say: 'Start here: the subject file. Security learned from the network up: routing, then detection, pipelines, and AI agents.' },
  { id: 'SR-01', say: `Current work: ${lower1(said('SR-01'))}` },
  { id: 'X-001', say: `AI security: ${lower1(said('X-001'))}` },
  { id: 'X-000', say: 'The only black drive is held by an LLM guard. Try to talk your way past it: a live prompt-injection lab.' },
  { id: null, say: 'Every drive opens with Enter or a click. To get in touch, the contact is top right.' },
]
const STOP_MS = 7600
const TOUR_SECONDS = Math.round((TOUR.length * STOP_MS) / 1000)
function Tour({ onEnd, openContact }: { onEnd: () => void; openContact: () => void }) {
  const { archive } = useCtx()
  const [i, setI] = useState(0)
  const bar = useRef<HTMLDivElement>(null)
  // the HUD re-renders every second (clock): keep the callbacks in refs so a stop's timer is not reset
  const cb = useRef({ onEnd, openContact })
  useEffect(() => { cb.current = { onEnd, openContact } })
  useEffect(() => {
    const stop = TOUR[i]
    if (stop.id) archive.jumpTo(stop.id); else cb.current.openContact()
    const h = setTimeout(() => (i + 1 < TOUR.length ? setI(i + 1) : cb.current.onEnd()), STOP_MS)
    return () => clearTimeout(h)
  }, [i, archive])
  useEffect(() => {
    const quit = (e: Event) => { if (bar.current?.contains(e.target as Node)) return; cb.current.onEnd() }
    const key = (e: KeyboardEvent) => { if (e.key !== 'Tab' && e.key !== 'Shift') cb.current.onEnd() }
    addEventListener('pointerdown', quit, true); addEventListener('keydown', key)
    return () => { removeEventListener('pointerdown', quit, true); removeEventListener('keydown', key) }
  }, [])
  return (
    <div ref={bar} className="tour" role="status" aria-live="polite">
      <div className="tour-p" aria-hidden="true">{TOUR.map((_, k) => <i key={k} className={k < i ? 'done' : k === i ? 'on' : ''} style={k === i ? { animationDuration: `${STOP_MS}ms` } : undefined} />)}</div>
      <div className="tour-t"><span className="lbl">{String(i + 1).padStart(2, '0')} / {String(TOUR.length).padStart(2, '0')}</span><p key={i}>{TOUR[i].say}</p></div>
      <button className="lbl" onClick={onEnd}>End tour ✕</button>
    </div>
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
