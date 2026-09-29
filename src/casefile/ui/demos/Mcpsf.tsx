// MCP Security Framework: one assessment replayed as a packet trace.
import { useRef, useState } from 'react'
import { useScript } from './useLoop'

const STAGES = ['Discover', 'Sandbox', 'Bridge', 'Probe', 'Report'] as const

export function Mcpsf() {
  const [stage, setStage] = useState(0)
  const [cap, setCap] = useState<[string, string]>(['discover', 'damn-vulnerable-mcp / challenge 1 · python · sse'])
  const [hot, setHot] = useState({ sandbox: false, safe: false, tool: false, report: false })
  const pkt = useRef<SVGCircleElement>(null)
  const path = (id: string) => pkt.current?.ownerSVGElement?.querySelector<SVGPathElement>(`#${id}`) ?? null

  useScript(async (wait, reduced) => {
    const travel = (id: string, ms: number, rev = false) => new Promise<void>((res) => {
      const p = path(id); if (!p || !pkt.current || reduced) return res()
      const L = p.getTotalLength(), s = performance.now()
      const f = (now: number) => { const k = Math.min(1, (now - s) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, q = p.getPointAtLength(L * (rev ? 1 - e : e)); pkt.current?.setAttribute('cx', String(q.x)); pkt.current?.setAttribute('cy', String(q.y)); if (k < 1) requestAnimationFrame(f); else res() }
      requestAnimationFrame(f)
    })
    if (reduced) { setStage(5); setHot({ sandbox: true, safe: true, tool: true, report: true }); setCap(['report', 'report.html + report.sarif · 1 finding · 13 passed']); return }
    for (;;) {
      setHot({ sandbox: false, safe: false, tool: false, report: false }); setStage(0)
      setCap(['discover', 'damn-vulnerable-mcp / challenge 1 · python · sse']); if (!(await wait(1100))) return
      setStage(1); setHot((h) => ({ ...h, sandbox: true })); setCap(['sandbox', 'container up · deps installed · isolated from host']); if (!(await wait(1100))) return
      setStage(2); setCap(['bridge', 'sse ⇄ normalised · tools = 3 · resources = 2']); if (!(await wait(900))) return
      setStage(3); setCap(['probe', 'detector CE-001 · SafeAdapter checks budget, rate, scope'])
      await travel('p1', 900); setHot((h) => ({ ...h, safe: true })); await travel('p2', 420); await travel('p3', 650)
      setHot((h) => ({ ...h, tool: true })); setCap(['probe', '✗ read_resource returned credentials']); if (!(await wait(1200))) return
      await travel('p3', 650, true); await travel('p2', 420, true)
      setCap(['redact', 'secret values stripped; only proof of exposure leaves the sandbox']); if (!(await wait(1000))) return
      setStage(4); await travel('p4', 800); setHot((h) => ({ ...h, report: true }))
      setCap(['report', 'report.html + report.sarif · evidence.jsonl · 38 s']); setStage(5); if (!(await wait(3200))) return
    }
  })

  return (
    <div className="dm-panel">
      <div className="dm-head"><span>Assessment run · packet trace</span><span className="live">replay</span></div>
      <div className="dm-stages">{STAGES.map((s, i) => <span key={s} className={i < stage ? 'done' : i === stage ? 'on' : ''}>{s}</span>)}</div>
      <svg className="dm-graph" viewBox="0 0 640 300" role="img" aria-label="A detector probe passes a SafeAdapter into a sandboxed MCP server, finds exposed credentials, and the redacted evidence becomes a report">
        <g className={`sbx ${hot.sandbox ? 'up' : ''}`}><rect x="352" y="14" width="274" height="272" rx="10" /><text x="366" y="36">SANDBOX · ISOLATED</text></g>
        <path id="p1" className="ln" d="M174,62 C200,62 196,150 214,150" />
        <path id="p2" className="ln" d="M324,150 L372,150" />
        <path id="p3" className="ln" d="M472,150 C488,150 484,74 500,74" />
        <path className="ln" d="M472,150 L500,150" /><path className="ln" d="M472,150 C488,150 484,226 500,226" />
        <path id="p4" className="ln" d="M214,160 C196,160 196,238 174,238" />
        <g className="nd"><rect x="24" y="36" width="150" height="52" rx="8" /><text x="38" y="58">detector</text><text className="s" x="38" y="76">CE-001 · credentials</text></g>
        <g className={`nd ${hot.safe ? 'good' : ''}`}><rect x="214" y="120" width="110" height="60" rx="8" /><text x="232" y="146">Safe</text><text x="232" y="162">Adapter</text></g>
        <g className="nd"><rect x="372" y="120" width="100" height="60" rx="8" /><text x="384" y="146">MCP server</text><text className="s" x="384" y="164">sse → bridge</text></g>
        <g className={`nd ${hot.tool ? 'hot' : ''}`}><rect x="500" y="54" width="112" height="40" rx="8" /><text x="512" y="78">read_resource</text></g>
        <g className="nd"><rect x="500" y="130" width="112" height="40" rx="8" /><text x="512" y="154">delete_range</text></g>
        <g className="nd"><rect x="500" y="206" width="112" height="40" rx="8" /><text x="512" y="230">generate_code</text></g>
        <g className={`nd ${hot.report ? 'good' : ''}`}><rect x="24" y="212" width="150" height="52" rx="8" /><text x="38" y="234">report</text><text className="s" x="38" y="252">{hot.report ? 'CE-001 · HIGH · 0.95' : 'awaiting findings…'}</text></g>
        <circle ref={pkt} className="pkt" r="6" cx="-20" cy="-20" />
      </svg>
      <div className="dm-cap"><b>{cap[0]}</b><span>{cap[1]}</span></div>
    </div>
  )
}
