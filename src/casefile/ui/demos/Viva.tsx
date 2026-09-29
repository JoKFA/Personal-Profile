// Threat model of a volunteer organisation's IT: data-flow diagram, trust boundaries, STRIDE
// badges. Threat titles are sample (the real register is internal); counts are real.
import { useState } from 'react'
import { useScript } from './useLoop'

// [x, y, STRIDE letter, threat, fix]
const T: [number, number, string, string, string][] = [
  [118, 70, 'S', 'Shared admin login for the CMS', 'Named accounts + MFA'],
  [150, 150, 'E', 'Former volunteers keep drive access', 'Leaver checklist, quarterly review'],
  [262, 86, 'I', 'Member files shared by public link', 'Org-only sharing, expiring links'],
  [300, 170, 'T', 'Form input written to DB unvalidated', 'Server-side validation'],
  [262, 238, 'D', 'No rate limit on the login form', 'Throttling + lockout'],
  [400, 110, 'I', 'API key shipped in the front end', 'Key moved server-side, rotated'],
  [424, 200, 'T', 'SQL built by string concatenation', 'Parameterised queries'],
  [474, 250, 'E', 'App connects to the DB as owner', 'Least-privilege DB role'],
  [540, 96, 'I', 'Database backups unencrypted', 'Encrypted, access-logged backups'],
  [560, 190, 'R', 'Admin actions not logged', 'Append-only audit log'],
  [540, 262, 'I', 'Donor export emailed as attachment', 'Access-controlled share'],
  [360, 282, 'D', 'SSL renewal done by hand', 'Automated renewal + expiry alert'],
]

export function Viva() {
  const [sel, setSel] = useState(6), [fixed, setFixed] = useState(false), [touched, setTouched] = useState(false)
  useScript(async (wait, reduced) => {
    if (reduced) { setFixed(true); return }
    for (let k = 0; !touched; k++) { setSel((k * 5 + 6) % 12); if (!(await wait(1400))) return; if (k % 6 === 5) setFixed((f) => !f) }
  }, [touched])
  const [, , l, t, fx] = T[sel]
  return (
    <div className={`dm-panel ${fixed ? 'fixed' : ''}`}>
      <div className="dm-head"><span>Data-flow diagram · STRIDE</span><span className="seg"><button aria-pressed={!fixed} onClick={() => { setTouched(true); setFixed(false) }}>Before</button><button aria-pressed={fixed} onClick={() => { setTouched(true); setFixed(true) }}>After</button></span></div>
      <svg className="dm-graph dfd" viewBox="0 0 640 310" role="img" aria-label="Data-flow diagram of a volunteer organisation's systems with twelve STRIDE threats">
        <g className="tb"><rect x="10" y="14" width="160" height="286" rx="10" /><rect x="186" y="14" width="170" height="286" rx="10" /><rect x="372" y="14" width="120" height="286" rx="10" /><rect x="508" y="14" width="122" height="286" rx="10" /></g>
        <g className="tbl"><text x="22" y="34">VOLUNTEERS</text><text x="198" y="34">WEB · CMS</text><text x="384" y="34">API</text><text x="520" y="34">DATA</text></g>
        <g className="ent"><rect x="30" y="92" width="120" height="36" rx="6" /><text x="90" y="115">Volunteer</text><rect x="30" y="200" width="120" height="36" rx="6" /><text x="90" y="223">Coordinator</text>
          <circle cx="270" cy="140" r="40" /><text x="270" y="144">Web app</text><circle cx="432" cy="160" r="40" /><text x="432" y="164">API</text>
          <line x1="520" y1="146" x2="620" y2="146" /><line x1="520" y1="184" x2="620" y2="184" /><text x="570" y="169">Member DB</text></g>
        <g className="fl"><path d="M150,110 L232,128" /><path d="M150,218 L236,160" /><path d="M310,146 L392,156" /><path d="M472,164 L520,164" /></g>
        {T.map(([x, y, s], n) => <g key={n} className={`bd ${n === sel ? 'sel' : ''}`} onMouseEnter={() => { setTouched(true); setSel(n) }} onClick={() => { setTouched(true); setSel(n) }} tabIndex={0} role="button" aria-label={`Threat ${n + 1}: ${T[n][3]}`}><circle cx={x} cy={y} r="11" /><text x={x} y={y + 4}>{s}</text></g>)}
      </svg>
      <div className={`dm-cap ${fixed ? 'pass' : 'fail'}`}><b>T-{String(sel + 1).padStart(2, '0')} · {l}</b><span>{t}{fixed && <> → <em>{fx}</em></>}</span><span className="lbl">{fixed ? '12 / 12 remediated' : 'open'}</span></div>
    </div>
  )
}
