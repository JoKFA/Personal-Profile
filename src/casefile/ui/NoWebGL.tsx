// Without WebGL the archive is a plain index: every file stays readable.
import { Link } from 'react-router-dom'
import { CASES, SERVICE, SUBJECT } from '../data/entries'
import type { Visitor } from '../visitor'

export function NoWebGL({ visitor }: { visitor: Visitor }) {
  return (
    <main className="nogl">
      <h1>Yaoting Wang</h1>
      <p className="lbl">Security engineering · encrypted archive · 3D view unavailable on this device</p>
      <p>{SUBJECT.summary}</p>
      <h2 className="lbl">Service records</h2>
      <ul>{SERVICE.map((e) => <li key={e.id}><Link to={`/projects/${e.slug}`}>{e.title} · {e.org}</Link> <span>{e.dates}</span></li>)}</ul>
      <h2 className="lbl">Case files</h2>
      <ul>{CASES.map((e) => <li key={e.id}><Link to={`/projects/${e.slug}`}>{e.title}</Link> <span>{e.summary}</span></li>)}</ul>
      <p className="lbl">Visitor {visitor.id}</p>
    </main>
  )
}
