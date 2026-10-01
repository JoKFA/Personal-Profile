// Enterprise campus network, "Blast Radius": one guest laptop at Site B is compromised. On a flat
// network the red spreads to every site; segmented, it stops at the guest boundary while staff
// traffic keeps flowing. Spread is a breadth-first search over the drawn graph, so the count is
// the hosts in this diagram, nothing more. A lab replay: zones and hosts are illustrative.
import { useMemo, useState } from 'react'
import { useScript } from './useLoop'
import { Roll } from './Roll'

type Mode = 'flat' | 'seg'
const W = 170, H = 118
const SITES = [
  { id: 'A', x: 8, y: 8, left: true }, { id: 'B', x: 282, y: 8, left: false },
  { id: 'C', x: 8, y: 174, left: true }, { id: 'D', x: 282, y: 174, left: false },
] as const
const ZONES = [{ z: 's', name: 'Staff', dy: 44, n: 2 }, { z: 'v', name: 'Servers', dy: 70, n: 1 }, { z: 'g', name: 'Guest', dy: 96, n: 2 }] as const
const CLOUD = { x: 230, y: 150 }
const ORIGIN = 'Bg1'

const bus = (s: (typeof SITES)[number]) => s.left ? s.x + W - 18 : s.x + 18
const dotX = (s: (typeof SITES)[number], i: number) => bus(s) + (s.left ? -1 : 1) * (30 + 22 * i)

/** Hosts, each site's edge (firewall) and the MPLS core; guest hosts reach the edge only when flat. */
function graph(mode: Mode) {
  const adj = new Map<string, string[]>()
  const link = (a: string, b: string) => { adj.set(a, [...(adj.get(a) ?? []), b]); adj.set(b, [...(adj.get(b) ?? []), a]) }
  for (const s of SITES) {
    link(`${s.id}f`, 'm')
    for (const z of ZONES) for (let i = 0; i < z.n; i++) {
      if (z.z === 'g' && mode === 'seg') { if (i) link(`${s.id}g0`, `${s.id}g${i}`) } else link(`${s.id}${z.z}${i}`, `${s.id}f`)
    }
  }
  const dist = new Map([[ORIGIN, 0]]), q = [ORIGIN]
  while (q.length) { const n = q.shift()!; for (const x of adj.get(n) ?? []) if (!dist.has(x)) { dist.set(x, dist.get(n)! + 1); q.push(x) } }
  return dist
}
const HOSTS = SITES.flatMap((s) => ZONES.flatMap((z) => Array.from({ length: z.n }, (_, i) => `${s.id}${z.z}${i}`)))

export function Network() {
  const [mode, setMode] = useState<Mode>('flat')
  const [lv, setLv] = useState(-1)
  const [touched, setTouched] = useState(false)
  const [run, setRun] = useState(0)
  const dist = useMemo(() => graph(mode), [mode])
  const max = Math.max(...dist.values())
  useScript(async (wait, reduced) => {
    if (reduced) { setMode('seg'); setLv(9); return }
    let m: Mode = mode
    for (;;) {
      setLv(-1); if (!(await wait(900))) return
      for (let l = 0; l <= (m === 'flat' ? 4 : 2); l++) { setLv(l); if (!(await wait(l === 0 ? 1000 : 560))) return }
      if (touched || !(await wait(m === 'flat' ? 1900 : 4200))) return
      m = m === 'flat' ? 'seg' : 'flat'; setMode(m)
    }
  }, [touched, run])
  const hit = (n: string) => (dist.get(n) ?? Infinity) <= lv
  const count = HOSTS.filter(hit).length
  const held = mode === 'seg' && lv > max
  const done = lv >= (mode === 'flat' ? 4 : 2)
  const pick = (m: Mode) => { setTouched(true); setMode(m); setRun((r) => r + 1) }
  return (
    <div className={`dm-panel br is-${mode}`}>
      <div className="dm-head"><span>Four sites · MPLS L3VPN · lab replay</span>
        <span className="seg"><button aria-pressed={mode === 'flat'} onClick={() => pick('flat')}>Flat</button><button aria-pressed={mode === 'seg'} onClick={() => pick('seg')}>Segmented</button></span></div>
      <div className="br-body">
        <svg className="br-map" viewBox="0 0 460 300" role="img" aria-label={`Four-site network, ${mode === 'flat' ? 'flat' : 'segmented'}: ${count} of ${HOSTS.length} hosts reached`}>
          <g className="br-up">{SITES.map((s) => <path key={s.id} className={hit(`${s.id}f`) && hit('m') ? 'hot' : ''} d={`M${bus(s)},${s.y + 70} L${CLOUD.x},${CLOUD.y}`} />)}</g>
          <g className="br-ok">{SITES.filter((s) => s.id !== 'A').map((s) => (
            <path key={s.id} d={`M${dotX(s, 0)},${s.y + 44} H${bus(s)} V${s.y + 70} L${CLOUD.x},${CLOUD.y} L${bus(SITES[0])},78 H${dotX(SITES[0], 0)}`} />
          ))}</g>
          <g className="br-core"><ellipse cx={CLOUD.x} cy={CLOUD.y} rx="42" ry="23" className={hit('m') ? 'hot' : ''} /><text x={CLOUD.x} y={CLOUD.y - 2}>MPLS</text><text className="s" x={CLOUD.x} y={CLOUD.y + 10}>L3VPN</text></g>
          {SITES.map((s) => {
            const b = bus(s), lx = s.left ? s.x + 14 : s.x + W - 14, anchor = s.left ? 'start' : 'end'
            return (
              <g key={s.id} className="br-site">
                <rect className="frame" x={s.x} y={s.y} width={W} height={H} rx="10" />
                <text className="t" x={lx} y={s.y + 22} textAnchor={anchor}>Site {s.id}</text>
                <path className={`bus ${hit(`${s.id}f`) ? 'hot' : ''}`} d={`M${b},${s.y + 44} V${s.y + 96}`} />
                {ZONES.map((z) => {
                  const y = s.y + z.dy, zoneHot = Array.from({ length: z.n }, (_, i) => hit(`${s.id}${z.z}${i}`)).some(Boolean)
                  const guarded = z.z === 'g' && mode === 'seg'
                  return (
                    <g key={z.z}>
                      <text className="z" x={lx} y={y + 3.5} textAnchor={anchor}>{z.name}</text>
                      <path className={`row ${zoneHot && !guarded ? 'hot' : ''}`} d={`M${dotX(s, 0)},${y} H${b}`} />
                      {z.z === 'g' && <path className={`gate ${guarded ? 'on' : ''} ${guarded && s.id === 'B' && held ? 'held' : ''}`} d={`M${b + (s.left ? -15 : 15)},${y - 8} v16`} />}
                      {Array.from({ length: z.n }, (_, i) => {
                        const id = `${s.id}${z.z}${i}`
                        return <circle key={i} className={`host ${hit(id) ? 'hot' : ''} ${id === ORIGIN && lv >= 0 ? 'origin' : ''}`} cx={dotX(s, i)} cy={y} r="5.5" />
                      })}
                    </g>
                  )
                })}
                <rect className="fw" x={b - 5} y={s.y + 65} width="10" height="10" rx="2" />
              </g>
            )
          })}
        </svg>
        <aside className="br-side">
          <span className="lbl">Hosts reached</span>
          <span className={`br-n ${count > 2 ? 'hot' : ''}`}><Roll value={String(count).padStart(2, '0')} /></span>
          <span className="br-of">of {HOSTS.length} in this diagram</span>
          <ul className="br-key">
            <li><i className="k-hot" />compromised</li>
            <li><i className="k-ok" />staff → servers</li>
            <li><i className="k-gate" />guest boundary</li>
          </ul>
          <span className={`br-log ${held ? 'on' : ''}`}>deny logged<br />→ Splunk · FortiSIEM</span>
        </aside>
      </div>
      <div className={`dm-cap ${done ? (mode === 'seg' ? 'pass' : 'fail') : ''}`}>
        <b>{lv < 0 ? 'replay' : mode === 'flat' ? 'flat' : 'segmented'}</b>
        <span>{lv < 0 ? 'One guest laptop at Site B is compromised.'
          : mode === 'flat' ? (done ? 'Nothing stops it: every site is reachable from one laptop.' : 'Spreading through the shared network…')
            : held ? <>Stopped at the guest boundary. Staff traffic <em>never stopped</em>.</> : 'Same laptop, segmented network…'}</span>
      </div>
    </div>
  )
}
