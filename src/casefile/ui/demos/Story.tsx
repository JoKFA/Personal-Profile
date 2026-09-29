// Subject drive: the story as a chart. Five tracks (one per direction), 2021 → 2026; a time cursor
// sweeps right and each drive lights on its track as it happens. The shape itself is the argument:
// the work starts at the network and climbs, and by 2026 every track is lit.
import { useState } from 'react'
import { CHAPTERS } from '../../data/story'
import { ROLES } from '../../data/roles'
import { useScript } from './useLoop'

const Y0 = 2021, Y1 = 2026.9
const steps = CHAPTERS.flatMap((c) => c.steps).filter((s) => s.role)
const x = (year: number) => 70 + ((year - Y0) / (Y1 - Y0)) * 540
const trackY = (i: number) => 58 + i * 46
// spread same-year steps on a track so dots never overlap
const placed = steps.map((s, i) => {
  const same = steps.slice(0, i).filter((o) => o.year === s.year && o.role === s.role).length
  return { ...s, cx: x(+s.year + 0.2 + same * 0.16), cy: trackY(ROLES.findIndex((r) => r.id === s.role)) }
})

export function Story() {
  const [t, setT] = useState(Y0)
  useScript(async (wait, reduced) => {
    if (reduced) { setT(Y1); return }
    for (;;) {
      for (let y = Y0; y <= Y1; y += 0.05) { setT(y); if (!(await wait(36))) return }
      if (!(await wait(3200))) return
    }
  })
  const now = placed.filter((p) => +p.year + 0.25 <= t)
  const last = now[now.length - 1]
  return (
    <div className="dm-panel story">
      <div className="dm-head"><span>Subject · YW-000 · from the network up</span><span className="live">{Math.floor(t)}</span></div>
      <svg className="dm-graph" viewBox="0 0 640 300" role="img" aria-label="Timeline from 2021 to 2026: work starts in IT and networking, moves into security operations, then cloud, AI and risk">
        {[2021, 2022, 2023, 2024, 2025, 2026].map((y) => <g key={y} className="yr"><line x1={x(y)} x2={x(y)} y1="34" y2="272" /><text x={x(y) + 4} y="288">{y}</text></g>)}
        {ROLES.map((r, i) => (
          <g key={r.id} className={`trk ${now.some((p) => p.role === r.id) ? 'on' : ''}`}>
            <text x="8" y={trackY(i) + 4}>{r.name.split(' ')[0]}</text>
            <line x1="70" x2={x(Math.min(t, Y1))} y1={trackY(i)} y2={trackY(i)} className="lit" />
            <line x1="70" x2="610" y1={trackY(i)} y2={trackY(i)} className="base" />
          </g>
        ))}
        {/* the climb: connect each step to the next in time */}
        <polyline className="climb" points={now.map((p) => `${p.cx},${p.cy}`).join(' ')} />
        {placed.map((p) => <g key={p.id} className={`nd2 ${now.includes(p) ? 'on' : ''} ${p === last ? 'last' : ''}`}><circle cx={p.cx} cy={p.cy} r="5" /><text x={p.cx + 8} y={p.cy - 8}>{p.id}</text></g>)}
        <line className="cursor" x1={x(t)} x2={x(t)} y1="30" y2="276" />
      </svg>
      <div className="dm-cap"><b>{last?.year ?? '2021'}</b><span>{last?.what ?? 'Systems administration diploma, BCIT'}</span></div>
    </div>
  )
}
