// AI-Enhanced EDR Triage (2024): raw Wazuh alerts on the left, the model's triage on the right.
import { useState } from 'react'
import { useScript } from './useLoop'

const ALERTS = [
  { rid: 5710, lvl: 5, raw: 'sshd: login attempt for non-existent user · src 203.0.113.24', v: 'Brute force', sev: 'high', ctx: '41 failed logins in 60 s from one source. Block it; check for a later success.' },
  { rid: 31103, lvl: 7, raw: "web: GET /products?id=1' OR '1'='1 · src 198.51.100.7", v: 'SQL injection', sev: 'critical', ctx: 'Payload reached the app tier. Confirm the query is parameterised.' },
  { rid: 5402, lvl: 3, raw: 'sudo: successful sudo to ROOT · user svc-backup', v: 'Benign', sev: 'low', ctx: 'Matches the nightly backup window. Suppressed, with reason, from feedback history.' },
  { rid: 31151, lvl: 10, raw: 'web: burst of 400s · 2.3k req/min · src 192.0.2.88', v: 'DoS pattern', sev: 'medium', ctx: 'Rate-limit at the edge; watch for distributed sources.' },
] as const

export function Edr() {
  const [rows, setRows] = useState<{ a: (typeof ALERTS)[number]; done: boolean; cached: boolean; k: number }[]>([])
  useScript(async (wait, reduced) => {
    if (reduced) { setRows(ALERTS.map((a, k) => ({ a, done: true, cached: false, k }))); return }
    let k = 0
    for (;;) {
      const a = ALERTS[k % ALERTS.length], cached = k >= ALERTS.length
      const key = k++
      setRows((r) => [{ a, done: false, cached, k: key }, ...r].slice(0, 4))
      if (!(await wait(cached ? 250 : 1000))) return
      setRows((r) => r.map((x) => (x.k === key ? { ...x, done: true } : x)))
      if (!(await wait(1500))) return
    }
  })
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>Wazuh → LLM triage · analyst view</span><span className="live">simulated · 2024</span></div>
      <div className="edr">
        {rows.map(({ a, done, cached, k }) => (
          <div key={k} className="edr-row">
            <div className="raw"><b>rule {a.rid}</b> · level {a.lvl}<br />{a.raw}</div>
            <div className="ai">{done ? <><span className={`sev sev-${a.sev}`}>{a.v}</span>{cached && <span className="lbl cache">cache hit</span>}<p>{a.ctx}</p></> : <span className="thinking">summarising</span>}</div>
          </div>
        ))}
      </div>
      <div className="dm-cap"><b>pipeline</b><span>normalise → summarise → suspected cause → next step · repeats served from SQLite cache</span></div>
    </div>
  )
}
