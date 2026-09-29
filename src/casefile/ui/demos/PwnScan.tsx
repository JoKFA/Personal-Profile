// PwnScan: three discovery methods fill one inventory; then the CVE list re-sorts from CVSS to
// CVSS × EPSS × exposure, and the order flips. Lab targets, simulated devices.
import { useState } from 'react'
import { useScript } from './useLoop'

const DEVICES = [
  { ip: '10.0.0.21', name: 'ipcam-lobby', by: ['ARP', 'SSDP'], iot: 92, ports: 4 },
  { ip: '10.0.0.34', name: 'printer-2f', by: ['ARP', 'mDNS'], iot: 78, ports: 3 },
  { ip: '10.0.0.47', name: 'smart-tv', by: ['mDNS', 'SSDP'], iot: 88, ports: 2 },
  { ip: '10.0.0.52', name: 'nas-backup', by: ['ARP'], iot: 55, ports: 5 },
]
// sample CVE rows: CVSS high but rarely exploited vs. moderate and exploited in the wild
const CVES = [
  { dev: 'nas-backup', cve: 'CVE-A · auth bypass', cvss: 9.8, epss: 0.02, iot: 55, ports: 5 },
  { dev: 'ipcam-lobby', cve: 'CVE-B · RCE via web UI', cvss: 7.5, epss: 0.91, iot: 92, ports: 4 },
  { dev: 'printer-2f', cve: 'CVE-C · info leak', cvss: 8.1, epss: 0.05, iot: 78, ports: 3 },
  { dev: 'smart-tv', cve: 'CVE-D · command injection', cvss: 6.8, epss: 0.44, iot: 88, ports: 2 },
]
// the scoring function from the project (worker/tasks/cve.py: compute_risk_score)
const risk = (c: (typeof CVES)[number]) => Math.min(10, (c.cvss * c.epss * (c.iot / 100) * Math.sqrt(c.ports + 1)) / 10 * 10)

export function PwnScan() {
  const [found, setFound] = useState(0), [phase, setPhase] = useState<'discover' | 'cvss' | 'risk'>('discover')
  useScript(async (wait, reduced) => {
    if (reduced) { setFound(4); setPhase('risk'); return }
    for (;;) {
      setPhase('discover'); setFound(0)
      for (let n = 1; n <= 4; n++) { if (!(await wait(650))) return; setFound(n) }
      if (!(await wait(900))) return; setPhase('cvss'); if (!(await wait(2200))) return
      setPhase('risk'); if (!(await wait(3600))) return
    }
  })
  const rows = [...CVES].sort((a, b) => (phase === 'risk' ? risk(b) - risk(a) : b.cvss - a.cvss))
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>PwnScan · lab subnet 10.0.0.0/24</span><span className="live">lab targets</span></div>
      {phase === 'discover' ? (
        <div className="pw-inv">
          <div className="pw-methods">{['ARP', 'mDNS', 'SSDP'].map((m) => <span key={m} className="lbl">{m}</span>)}</div>
          {DEVICES.slice(0, found).map((d) => <div key={d.ip} className="pw-dev"><b>{d.ip}</b><span>{d.name}</span><span className="lbl">{d.by.join(' + ')}</span><span className="iot">IoT {d.iot}</span></div>)}
        </div>
      ) : (
        <div className="pw-rank">
          <div className="pw-h lbl"><span>device · finding</span><span>CVSS</span><span>EPSS</span><span>risk</span></div>
          {rows.map((c, n) => <div key={c.cve} className={`pw-row ${phase === 'risk' && n === 0 ? 'top' : ''}`} style={{ order: n }}><span><b>{c.dev}</b> {c.cve}</span><span>{c.cvss.toFixed(1)}</span><span>{c.epss.toFixed(2)}</span><span className="r">{phase === 'risk' ? risk(c).toFixed(2) : '—'}</span></div>)}
        </div>
      )}
      <div className={`dm-cap ${phase === 'risk' ? 'pass' : ''}`}><b>{phase === 'discover' ? `${found} devices` : phase === 'cvss' ? 'by CVSS' : 'by risk'}</b><span>{phase === 'discover' ? 'three methods, one inventory · agentless' : phase === 'cvss' ? 'the obvious order: highest severity first' : 'CVSS × EPSS × exposure: the exploited camera goes first'}</span></div>
    </div>
  )
}
