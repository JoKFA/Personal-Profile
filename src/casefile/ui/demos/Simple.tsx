// Timeline (projects without a bespoke demo), the subject's identity plate, and the visitor print.
import { useEffect, useRef, useState } from 'react'
import type { DemoProps } from '.'
import { CAPABILITIES } from '../../data/capabilities'
import { ENTRIES } from '../../data/entries'
import { roleById } from '../../data/roles'
import { useCtx } from '../context'
import { useScript } from './useLoop'

export function Timeline({ entry }: DemoProps) {
  const steps = [...(entry.sections ?? []).map((s) => [s.eyebrow, s.title] as const), ...(entry.numbers ?? []).slice(0, 2).map(([n, l]) => ['result', `${n} ${l}`] as const)]
  const [n, setN] = useState(0)
  useScript(async (wait, reduced) => { if (reduced) { setN(steps.length); return } for (;;) { for (let k = 0; k <= steps.length; k++) { setN(k); if (!(await wait(1100))) return } if (!(await wait(2200))) return } })
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>{entry.title} · evidence trail</span><span className="live">{entry.year}</span></div>
      <div className="tlx">{steps.map(([e, t], k) => <div key={k} className={k < n ? 'on' : ''}><span className="lbl">{e}</span><b>{t}</b></div>)}</div>
      <div className="dm-cap"><b>stack</b><span>{entry.stack?.join(' · ')}</span></div>
    </div>
  )
}

export function Subject() {
  const counts = CAPABILITIES.map((c) => ({ role: roleById(c.role), n: ENTRIES.filter((e) => (e.kind === 'case' || e.kind === 'service') && e.roles !== 'all' && e.roles.includes(c.role)).length }))
  const max = Math.max(...counts.map((c) => c.n))
  return (
    <div className="dm-panel subj">
      <div className="dm-head"><span>Subject · YW-000</span><span className="live">open to hire</span></div>
      <div className="subj-name">YAOTING<br />WANG</div>
      <div className="lbl subj-line">Security engineering · Vancouver, BC · MASc Cybersecurity, SFU</div>
      <div className="subj-bars">{counts.map(({ role, n }) => <div key={role.id}><span>{role.name}</span><i style={{ width: `${(n / max) * 100}%` }} /><b>{n}</b></div>)}</div>
      <div className="dm-cap"><b>evidence</b><span>drives that prove each direction · open any from the Capabilities tab</span></div>
    </div>
  )
}

export function VisitorPrint() {
  const { visitor } = useCtx()
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = cv.current!; const g = c.getContext('2d')!; c.width = 1200; c.height = 640
    let h = visitor.hash || 1; const rnd = () => (h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32
    g.clearRect(0, 0, c.width, c.height); g.translate(360, 320)
    for (let i = 0; i < 30; i++) {
      const r = 18 + i * 9, a0 = rnd() * 6, w = 0.15 + rnd() * 0.35, gap = rnd() * 6.28
      g.beginPath(); for (let a = 0; a <= 6.3; a += 0.05) { if (Math.abs((a - gap + 6.28) % 6.28) < w) { g.stroke(); g.beginPath(); continue } const rr = r * (1 + 0.12 * Math.sin(a * 3 + a0)); if (a === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 1.2); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 1.2) }
      g.strokeStyle = i % 7 === 0 ? 'rgba(217,67,28,.7)' : `rgba(90,80,62,${0.25 + 0.5 * i / 30})`; g.lineWidth = 2; g.stroke()
    }
  }, [visitor.hash])
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>Fingerprint · from your signals</span><span className="live">local only</span></div>
      <div className="vp"><canvas ref={cv} aria-hidden="true" /><dl>{visitor.rows.map(([k, v]) => <div key={k}><dt className="lbl">{k}</dt><dd>{v}</dd></div>)}</dl></div>
      <div className="dm-cap"><b>{visitor.id}</b><span>collected in {visitor.ms} ms · 0 bytes sent · harmless alone, a fingerprint together</span></div>
    </div>
  )
}
