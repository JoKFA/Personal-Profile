// Service-record demos: each shows the working method of the job, not the (confidential) data.
// All organisations' internals are sample; the counts beside them are real.
import { useState } from 'react'
import { useScript } from './useLoop'

// Coast Capital: one vendor review, evidence to rating to treatment to record
const EVIDENCE = [['ISO 27001 certificate', 'ok'], ['SOC 2 Type II report', 'ok'], ['PCI attestation', 'n/a'], ['Penetration test summary', 'gap'], ['Public reputation (OSINT)', 'ok'], ['External security rating', 'ok']] as const
const TREATMENT = ['Accept', 'Mitigate', 'Transfer', 'Avoid'] as const
export function CoastCapital() {
  const [n, setN] = useState(0), [phase, setPhase] = useState(0)
  useScript(async (wait, reduced) => {
    if (reduced) { setN(EVIDENCE.length); setPhase(3); return }
    for (;;) {
      setN(0); setPhase(0)
      for (let k = 1; k <= EVIDENCE.length; k++) { if (!(await wait(520))) return; setN(k) }
      for (let p = 1; p <= 3; p++) { if (!(await wait(1100))) return; setPhase(p) }
      if (!(await wait(3000))) return
    }
  })
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>Third-party risk review · Vendor A</span><span className="live">sample · real reviews confidential</span></div>
      <div className="cc">
        <div className="cc-ev">
          <div className="lbl">Assurance evidence</div>
          {EVIDENCE.slice(0, n).map(([t, s]) => <div key={t} className={`cc-row ${s === 'n/a' ? 'na' : s}`}><span>{t}</span><b>{s === 'ok' ? 'reviewed' : s === 'gap' ? 'finding' : 'not applicable'}</b></div>)}
        </div>
        <div className="cc-out">
          <div className="lbl">Risk rating</div>
          <div className={`cc-dial ${phase >= 1 ? 'on' : ''}`}><i style={{ width: phase >= 1 ? '46%' : '0%' }} /><span>{phase >= 1 ? 'Moderate' : '—'}</span></div>
          <div className="lbl" style={{ marginTop: 16 }}>Treatment</div>
          <div className="cc-treat">{TREATMENT.map((t) => <span key={t} className={phase >= 2 && t === 'Mitigate' ? 'on' : ''}>{t}</span>)}</div>
          <p className={`cc-note ${phase >= 2 ? 'in' : ''}`}>Condition: remediation plan for the pentest finding before go-live.</p>
        </div>
      </div>
      <div className={`dm-cap ${phase >= 3 ? 'pass' : ''}`}><b>{phase >= 3 ? 'recorded' : 'assess'}</b><span>{phase >= 3 ? 'Archer record: evidence, rationale, recommendation, follow-up · 1 of 20+ vendors' : 'reconcile supplied evidence with public signals'}</span></div>
    </div>
  )
}

// VibesMeet: a pull request through the security gates, then the cloud side
const GATES = [['Trivy', 'container image · 0 critical'], ['GitGuardian', 'secret in .env.example'], ['Semgrep', 'SAST · 0 findings']] as const
export function VibesMeet() {
  const [step, setStep] = useState(0)
  useScript(async (wait, reduced) => {
    if (reduced) { setStep(6); return }
    for (;;) { for (let s = 0; s <= 6; s++) { setStep(s); if (!(await wait(s === 3 ? 1600 : s === 6 ? 3200 : 900))) return } }
  })
  const blocked = step >= 2 && step < 4
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>GitHub Actions · PR #142 → main</span><span className="live">sample run</span></div>
      <div className="vm">
        <div className="vm-pipe">
          {GATES.map(([g, d], i) => {
            const state = step <= i ? 'wait' : g === 'GitGuardian' && step < 4 ? 'fail' : 'pass'
            return <div key={g} className={`vm-gate ${state}`}><b>{g}</b><span>{state === 'fail' ? '✗ ' + d : state === 'pass' ? (g === 'GitGuardian' ? '✓ secret removed, rotated' : '✓ ' + d) : 'queued'}</span></div>
          })}
          <div className={`vm-merge ${step >= 5 ? 'on' : blocked ? 'block' : ''}`}>{step >= 5 ? 'Merged' : blocked ? 'Blocked before merge' : 'Waiting for checks'}</div>
        </div>
        <div className="vm-cloud">
          <div className="lbl">AWS · same internship</div>
          <div className="vm-bar"><span>Monthly spend</span><i className="before" /><i className={`after ${step >= 6 ? 'on' : ''}`} /><b>{step >= 6 ? '~30% lower' : ''}</b></div>
          <div className="vm-line"><span>Security Hub</span><b>findings centralised</b></div>
          <div className="vm-line"><span>IAM</span><b>excess access removed</b></div>
          <div className="vm-line"><span>Joiner / leaver</span><b>email · MFA · permissions</b></div>
        </div>
      </div>
      <div className={`dm-cap ${step >= 5 ? 'pass' : blocked ? 'fail' : ''}`}><b>{step >= 5 ? 'merged' : blocked ? 'gate' : 'ci'}</b><span>{blocked ? 'a leaked key stops the merge; tuned rules keep false positives from stalling the team' : 'checks run on every pull request before merge'}</span></div>
    </div>
  )
}

// BCIT: three kinds of work; the scene cycles
const PHISH = [100, 85]
const POLICY = ['Access control', 'Acceptable use', 'Incident response', 'Data classification', 'Remote work']
const CSF = ['Identify', 'Protect', 'Detect', 'Respond', 'Recover']
const MAP = [[0, 1], [1], [2, 3], [0, 1], [1]]
export function Bcit() {
  const [scene, setScene] = useState(0), [k, setK] = useState(0)
  useScript(async (wait, reduced) => {
    if (reduced) { setK(9); return }
    for (let s = 0; ; s++) { setScene(s % 3); for (let n = 0; n <= 6; n++) { setK(n); if (!(await wait(620))) return } if (!(await wait(1800))) return }
  })
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>BCIT Cyber Security Office · 2024</span><span className="seg">{['Awareness', 'Policy', 'Response'].map((t, i) => <button key={t} aria-pressed={scene === i} onClick={() => { setScene(i); setK(9) }}>{t}</button>)}</span></div>
      {scene === 0 && <div className="bc">
        <div className="lbl">Successful phishing attempts · simulation index</div>
        {PHISH.map((v, i) => <div key={i} className="bc-bar"><span>{i ? 'Later simulations' : 'Before the programme'}</span><i style={{ width: k > i * 2 ? `${v * 0.8}%` : '0%' }} className={i ? 'after' : ''} /><b>{k > i * 2 ? v : ''}</b></div>)}
        <p className="bc-note">Programme built from scratch: phishing, remote-work security, quizzes · 1,000+ staff and students</p>
      </div>}
      {scene === 1 && <div className="bc-map">
        <div className="bc-hd"><span />{CSF.map((c) => <span key={c} className="lbl">{c}</span>)}</div>
        {POLICY.map((p, r) => <div key={p} className="bc-rw"><span>{p}</span>{CSF.map((c, ci) => <i key={c} className={MAP[r].includes(ci) && k > r ? 'on' : ''} />)}</div>)}
        <p className="bc-note">20+ policies and standards checked against NIST CSF, ISO 27001 and institutional standards (sample rows)</p>
      </div>}
      {scene === 2 && <div className="bc-ir">{['Phishing', 'Malware', 'Account compromise', 'Data exposure'].map((p, i) => <div key={p} className={k > i ? 'on' : ''}><b>Playbook {i + 1}</b><span>{p}</span><em>detect → contain → eradicate → recover → lessons</em></div>)}<p className="bc-note">4 playbooks plus a virtual investigation lab to rehearse them</p></div>}
      <div className="dm-cap pass"><b>{['people', 'policy', 'response'][scene]}</b><span>{['~15% fewer successful phishing attempts in later simulations', 'controls, devices and cross-references kept consistent', 'what each incident type is, and how to run it'][scene]}</span></div>
    </div>
  )
}

// VIVA IT: one person's service map for a 500+ person non-profit
const SERVICES = [['Microsoft 365', 'accounts · MFA · shared drives'], ['Websites + CMS', 'React / TypeScript · admin CMS'], ['DNS', 'records for 3+ public services'], ['SSL certificates', 'renewed before expiry'], ['Member database', 'access control · backups'], ['Devices', 'laptops · printers · onboarding']] as const
export function VivaOps() {
  const [n, setN] = useState(0), [renew, setRenew] = useState(false)
  useScript(async (wait, reduced) => {
    if (reduced) { setN(SERVICES.length); setRenew(true); return }
    for (;;) {
      setN(0); setRenew(false)
      for (let k = 1; k <= SERVICES.length; k++) { if (!(await wait(420))) return; setN(k) }
      if (!(await wait(1200))) return; setRenew(true); if (!(await wait(3200))) return
    }
  })
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>VIVA · service map · sole IT contact</span><span className="live">500+ people</span></div>
      <div className="vv">
        {SERVICES.slice(0, n).map(([s, d]) => <div key={s} className={`vv-svc ${s === 'SSL certificates' ? (renew ? 'ok' : 'warn') : 'ok'}`}><i /><b>{s}</b><span>{s === 'SSL certificates' ? (renew ? 'renewed · valid 90 days' : 'expires in 9 days') : d}</span></div>)}
      </div>
      <div className={`dm-cap ${renew ? 'pass' : ''}`}><b>{renew ? 'renewed' : 'watch'}</b><span>a small organisation run with the habits of a security team (sample status)</span></div>
    </div>
  )
}
