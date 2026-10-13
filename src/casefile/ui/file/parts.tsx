// The pieces the tabs are made of. Plain components of the entry's own data: no archive, no scene, no clock.
import { useState } from 'react'
import { entryById, shortName } from '../../data/entries'
import type { Chapter } from '../../data/story'
import type { Entry } from '../../data/types'
import { PrivacyStat } from '../PrivacyStat'

export function Numbers({ list }: { list: [string, string][] }) {
  return <div className="nums">{list.map(([n, l]) => <div key={l}><b data-redact>{n}</b><span className="lbl">{l}</span></div>)}</div>
}
export function Sections({ e }: { e: Entry }) {
  return <>{e.sections?.map((s) => (
    <section key={s.title} className="chap">
      <div className="lbl chap-e">{s.eyebrow}</div>
      <h3 data-redact>{s.title}</h3>
      <p data-redact>{s.body}</p>
      {s.points && <ul>{s.points.map((p) => <li key={p} data-redact>{p}</li>)}</ul>}
      {s.note && <p className="chap-note" data-redact>{s.note}</p>}
    </section>
  ))}</>
}
/** What this site does with the visitor, each line checkable. */
export function Session({ visitor, risk }: { visitor: string; risk: number }) {
  return (
    <dl className="session">
      <div><dt className="lbl">Your number</dt><dd><b data-redact>{visitor}</b><span data-redact>A hash of what your browser told this page. Every file you open is watermarked with it; it never leaves your browser.</span></dd></div>
      <div><dt className="lbl">Behaviour analytics</dt><dd><b data-redact>Risk {String(risk).padStart(2, '0')}</b><span data-redact>How suspicious this session looks (UEBA). Denied drives and rapid scanning raise it; it cools down on its own.</span></dd></div>
      <div><dt className="lbl">Third parties</dt><dd><PrivacyStat /><span data-redact>Counted live in this page.</span></dd></div>
      <div><dt className="lbl">Your file</dt><dd><span data-redact>Crypto-shred it (top right): three overwrite passes, then the key is zeroized. You can restore it from the archive.</span></dd></div>
    </dl>
  )
}
export function Log({ id, visitor, audit }: { id: string; visitor: string; audit: [string, string][] }) {
  // chain of custody: each entry commits to the previous one (FNV-1a, display only)
  const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
  const rows: [string, string][] = [...audit.slice(-6), [new Date().toLocaleTimeString('en-GB'), `${visitor} reading ${id}`]]
  let prev = '00000000'
  return <div className="log"><div className="lbl">Chain of custody · each entry commits to the last</div>{rows.map(([t, s], i) => { const h = fnv(prev + t + s), line = <div key={i} className="log-row"><span>{t}</span><span data-redact>{s}</span><span className="h">{h} ← {prev}</span></div>; prev = h; return line })}</div>
}

/** A chapter: the key steps, the rest one click away. Each step names its file in words. */
export function ChapterView({ c, jump }: { c: Chapter; jump: (id: string) => void }) {
  const [all, setAll] = useState(false)
  const key = c.steps.filter((st) => st.key), rest = c.steps.filter((st) => !st.key)
  const shown = all ? [...key, ...rest] : key
  return (
    <section className="chapter">
      <div className="chapter-h"><span className="lbl">{c.years}</span><h3 data-redact>{c.title}</h3></div>
      <p data-redact>{c.line}</p>
      <ol>{shown.map((st) => { const r = entryById.get(st.id); return (
        <li key={st.id}><button onClick={() => jump(st.id)} disabled={!r || r.kind === 'credential'}>
          <span className="st-meta lbl">{st.year}<em>{shortName(st.id)}</em></span><span data-redact>{st.what}</span>
        </button></li>
      ) })}</ol>
      {rest.length > 0 && <button className="chapter-more lbl" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? 'Show less' : `+ ${rest.length} more`}</button>}
    </section>
  )
}
