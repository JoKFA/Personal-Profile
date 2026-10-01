// Subject drive, "Six ways in": the common ways attackers get into a company, drawn as lines
// toward "your data". One by one each attack runs in and stops at a shield, and the real work
// behind that shield comes into focus. Nothing rotates away: the finished picture stays, and
// each shield opens the file that proves it.
import { useState } from 'react'
import type { Entry } from '../../data/types'
import { WAYS_IN } from '../../data/story'
import { shortName } from '../../data/entries'
import { useScript } from './useLoop'

const H = 270, W = 180, CX = W / 2, CY = H / 2, CORE = 38, AT = 0.56
const rowY = (r: number) => H / 6 + r * (H / 3)
/** Ways 0,2,4 on the left, 1,3,5 on the right. */
const side = (i: number) => (i % 2 === 0 ? 'l' : 'r')
function geo(i: number) {
  const x0 = side(i) === 'l' ? 0 : W, y0 = rowY(Math.floor(i / 2))
  const dx = CX - x0, dy = CY - y0, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d
  const x1 = CX - ux * CORE, y1 = CY - uy * CORE                    // where the line meets the core
  const sx = x0 + (x1 - x0) * AT, sy = y0 + (y1 - y0) * AT          // the shield
  return { x0, y0, x1, y1, sx, sy, px: -uy * 11, py: ux * 11 }
}

export function WaysIn({ entry: e, jump }: { entry: Entry; jump?: (id: string) => void }) {
  const [n, setN] = useState(0)             // attacks run so far
  const [hot, setHot] = useState<number | null>(null)
  useScript(async (wait, reduced) => {
    if (reduced) { setN(WAYS_IN.length); return }
    if (!(await wait(1100))) return
    for (let i = 1; i <= WAYS_IN.length; i++) { setN(i); if (!(await wait(1050))) return }
  })
  const done = n >= WAYS_IN.length
  const now = e.facts.find(([k]) => k === 'Now')?.[1], avail = e.facts.find(([k]) => k === 'Available')?.[1]
  const way = (i: number) => {
    const w = WAYS_IN[i], run = i < n
    return (
      <li key={w.id + i} className={`wi-way ${side(i)} ${run ? 'run' : ''} ${hot === i ? 'hot' : hot !== null ? 'dim' : ''}`}
        onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
        <button onClick={() => jump?.(w.id)} disabled={!jump} aria-label={`${w.attack}: ${w.defence}. Open ${shortName(w.id)}`}>
          <span className="atk">{w.attack}</span>
          <span className="def">{w.defence}</span>
          <span className="src">{shortName(w.id)} →</span>
        </button>
      </li>
    )
  }
  return (
    <div className={`dm-panel wi ${done ? 'done' : ''}`}>
      <div className="dm-head"><span>Subject · {e.title}</span><span className={done ? 'ok' : ''}>{n} / {WAYS_IN.length} stopped</span></div>
      <div className="wi-top">
        <p>Six ways attackers get into a company. <b>I’ve worked on stopping each one.</b></p>
      </div>
      <div className="wi-map">
        <ol className="wi-col">{[0, 2, 4].map(way)}</ol>
        <svg className="wi-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
          {WAYS_IN.map((_, i) => {
            const g = geo(i), run = i < n
            return (
              <g key={i} className={`wi-line ${run ? 'run' : ''} ${hot === i ? 'hot' : hot !== null ? 'dim' : ''}`}>
                <path className="rest" d={`M${g.x0},${g.y0} L${g.x1},${g.y1}`} />
                <path className="atk" d={`M${g.x0},${g.y0} L${g.sx},${g.sy}`} pathLength={1} />
                <circle className="hit" cx={g.sx} cy={g.sy} r="10" />
                <path className="shield" d={`M${g.sx - g.px},${g.sy - g.py} L${g.sx + g.px},${g.sy + g.py}`} />
              </g>
            )
          })}
          <circle className="wi-core" cx={CX} cy={CY} r={CORE} />
          <text className="wi-core-t" x={CX} y={CY - 2}>Your</text>
          <text className="wi-core-t" x={CX} y={CY + 12}>data</text>
        </svg>
        <ol className="wi-col">{[1, 3, 5].map(way)}</ol>
      </div>
      <div className="wi-foot">
        {now && <span><i className="lbl">Now</i>{now}</span>}
        {avail && <span><i className="lbl">Available</i>{avail}</span>}
      </div>
    </div>
  )
}
