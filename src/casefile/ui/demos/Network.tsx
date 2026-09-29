// Enterprise campus network: four scenes on one topology, each ending in a SIEM event.
// Join (DHCP/DNS/VLAN) · Segment (ACL) · Egress (PAT + NGFW) · Fail over (OSPF).
import { useState } from 'react'
import { useScript } from './useLoop'

const SCENES = [
  { id: 'join', name: 'Join', steps: ['DHCP DISCOVER → broadcast on VLAN 20 (Staff)', 'OFFER 10.20.4.17 · REQUEST · ACK', 'DNS  files.corp.local → 10.10.0.20'], siem: 'dhcp · lease 10.20.4.17 → aa:1f:… · vlan 20', path: 'M92,236 L180,236 L180,150 L300,150' },
  { id: 'seg', name: 'Segment', steps: ['Guest VLAN 30 → Finance 10.40.0.0/24', 'ACL 130 deny 10.30.0.0/24 → 10.40.0.0/24', 'Staff VLAN 20 → Finance: permit tcp 443'], siem: 'acl deny · guest → finance · 10.30.0.51 → 10.40.0.8', path: 'M92,236 L180,236 L180,150 L300,150 L420,150', block: true },
  { id: 'egress', name: 'Egress', steps: ['10.20.4.17:51344 → 142.250.69.14:443', 'PAT  → 203.0.113.9:40312', 'NGFW policy web-out · allow · TLS inspected'], siem: 'nat · 10.20.4.17:51344 ↔ 203.0.113.9:40312', path: 'M92,236 L180,236 L180,150 L300,150 L300,60 L560,60' },
  { id: 'ospf', name: 'Fail over', steps: ['Link Site A ↔ Site B down', 'OSPF reconverges · cost 20 via Site C', 'Traffic rerouted · no user impact'], siem: 'ospf · adjacency down · spf recalculated 0.8 s', path: 'M300,150 L420,250 L560,150', ospf: true },
] as const

export function Network() {
  const [s, setS] = useState(0), [step, setStep] = useState(0), [touched, setTouched] = useState(false)
  useScript(async (wait, reduced) => {
    if (reduced) { setStep(3); return }
    for (let k = 0; ; k++) {
      if (!touched) setS(k % 4)
      for (let n = 0; n <= 3; n++) { setStep(n); if (!(await wait(n === 3 ? 2200 : 1100))) return }
    }
  }, [touched])
  const sc = SCENES[s]
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>Four-site campus · virtual lab</span><span className="seg">{SCENES.map((x, n) => <button key={x.id} aria-pressed={n === s} onClick={() => { setTouched(true); setS(n); setStep(0) }}>{x.name}</button>)}</span></div>
      <svg className="dm-graph net" viewBox="0 0 640 290" role="img" aria-label={`Network topology, scene: ${sc.name}`}>
        <g className="lk"><path d="M300,150 L420,150" className={'ospf' in sc && sc.ospf && step >= 1 ? 'down' : ''} /><path d="M300,150 L420,250 L560,150" /><path d="M420,150 L560,150" /><path d="M300,150 L300,60 L560,60" /><path d="M180,150 L300,150" /><path d="M180,236 L180,150" /><path d="M92,236 L180,236" /></g>
        <g className="dev">
          <g><rect x="270" y="126" width="60" height="48" rx="8" /><text x="300" y="148">R1</text><text className="s" x="300" y="164">Site A</text></g>
          <g><rect x="390" y="126" width="60" height="48" rx="8" /><text x="420" y="148">R2</text><text className="s" x="420" y="164">Site B</text></g>
          <g><rect x="390" y="226" width="60" height="48" rx="8" /><text x="420" y="248">R3</text><text className="s" x="420" y="264">Site C</text></g>
          <g><rect x="530" y="126" width="80" height="48" rx="8" /><text x="570" y="148">Finance</text><text className="s" x="570" y="164">10.40.0.0/24</text></g>
          <g><rect x="530" y="36" width="80" height="48" rx="8" /><text x="570" y="58">Internet</text><text className="s" x="570" y="74">via NGFW</text></g>
          <g><rect x="150" y="126" width="60" height="48" rx="8" /><text x="180" y="148">SW1</text><text className="s" x="180" y="164">VLAN 20/30</text></g>
          <g><rect x="40" y="214" width="104" height="44" rx="8" /><text x="92" y="234">laptop</text><text className="s" x="92" y="250">{s === 1 ? 'guest · vlan 30' : 'staff · vlan 20'}</text></g>
          <g className="fw"><rect x="280" y="44" width="40" height="32" rx="6" /><text x="300" y="64">FW</text></g>
        </g>
        <path key={`${s}-${step >= 1}`} className={`flow ${'block' in sc && sc.block && step >= 2 ? 'blocked' : ''}`} d={sc.path} pathLength={1} style={{ strokeDashoffset: step >= 1 ? 0 : 1 }} />
        {'block' in sc && sc.block && step >= 2 && <g className="deny"><circle cx="360" cy="150" r="12" /><path d="M354,144 L366,156 M366,144 L354,156" /></g>}
      </svg>
      <div className="net-steps">{sc.steps.map((x, n) => <div key={x} className={n < step ? 'on' : ''}><span className="lbl">{String(n + 1).padStart(2, '0')}</span>{x}</div>)}</div>
      <div className={`dm-cap ${step >= 3 ? 'pass' : ''}`}><b>siem</b><span>{step >= 3 ? sc.siem : 'waiting for the event…'}</span></div>
    </div>
  )
}
