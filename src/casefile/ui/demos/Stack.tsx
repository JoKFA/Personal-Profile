// Diploma, CISA: "Bottom-Up". The program is a stack of what an administrator runs, cable at the
// bottom. A sample trouble ticket is walked up it; only the layer being checked is in focus. The
// fault is a switch port in the wrong VLAN. Once fixed, the same stack is re-read for what each
// layer has to guard: a wrong VLAN is also a wrong trust boundary. Layers are the program's own
// subjects (BCIT program page); the ticket is a sample.
import { useState } from 'react'
import { useScript } from './useLoop'

const LAYERS = [
  { name: 'Wired and wireless LAN', runs: 'links · cabling · Wi-Fi', guards: 'who may plug in' },
  { name: 'Cisco switching', runs: 'VLANs · trunks · ports', guards: 'which zone a port trusts' },
  { name: 'Cisco routing and WAN', runs: 'routes between sites', guards: 'what may cross between sites' },
  { name: 'Active Directory · cloud IAM', runs: 'users · groups · roles', guards: 'who is allowed what' },
  { name: 'Linux & Windows Server', runs: 'servers · services', guards: 'what a server exposes' },
  { name: 'Databases', runs: 'the data behind the apps', guards: 'who can read the data' },
  { name: 'Programming', runs: 'scripts · automation', guards: 'what runs with whose rights' },
] as const
const CHECKS = ['link up', 'port in the guest VLAN', 'route to the file server', 'user in the right group', 'share is being served', 'records readable', 'mapping script ran'] as const
const FAULT = 1
const VERBS = ['Install', 'Configure', 'Maintain', 'Monitor', 'Troubleshoot'] as const
type Phase = 'idle' | 'walk' | 'fault' | 'fixed' | 'reread'

export function Stack() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [at, setAt] = useState(-1)
  const [verb, setVerb] = useState(-1)
  useScript(async (wait, reduced) => {
    if (reduced) { setPhase('reread'); setAt(LAYERS.length - 1); setVerb(VERBS.length - 1); return }
    for (;;) {
      setPhase('idle'); setAt(-1); setVerb(-1); if (!(await wait(1100))) return
      setPhase('walk'); setVerb(4)
      for (let i = 0; i <= FAULT; i++) { setAt(i); if (!(await wait(i === FAULT ? 700 : 1000))) return }
      setPhase('fault'); if (!(await wait(1700))) return
      setPhase('fixed'); setVerb(1); if (!(await wait(900))) return
      for (let i = FAULT + 1; i < LAYERS.length; i++) { setAt(i); setVerb(3); if (!(await wait(380))) return }
      if (!(await wait(900))) return
      setPhase('reread'); if (!(await wait(5200))) return
    }
  })
  const reread = phase === 'reread'
  const state = (i: number) => reread ? (i === FAULT ? 'mark' : 'lit')
    : i === at ? 'cur' : i < at ? 'done' : ''
  const check = (i: number) => i > at || phase === 'idle' ? null
    : i === FAULT && phase === 'fault' ? { ok: false, t: CHECKS[i] }
      : i === FAULT ? { ok: true, t: 'moved to the staff VLAN' } : { ok: true, t: CHECKS[i] }
  const resolved = phase === 'fixed' ? at === LAYERS.length - 1 : reread
  return (
    <div className={`dm-panel bu ${reread ? 'is-reread' : ''}`}>
      <div className="dm-head"><span>Trouble ticket · sample</span><span>{reread ? 'Same stack · security reading' : 'Checked from the cable up'}</span></div>
      <div className="bu-body">
        <div className="bu-ticket">
          <span className="lbl">Reported</span>
          <p className="bu-q">“I can’t open the shared folder.”</p>
          <span className={`bu-stamp ${resolved ? 'on' : ''}`}>{resolved ? 'Resolved' : phase === 'fault' ? 'Fault found' : phase === 'idle' ? 'Open' : 'Checking'}</span>
          <p className={`bu-moral ${reread ? 'on' : ''}`}>A wrong VLAN is also a wrong <b>trust boundary</b>.<span>Security, learned from the network up.</span></p>
        </div>
        <ol className="bu-stack" aria-label="The program as a stack, cable at the bottom">
          {LAYERS.map((l, i) => {
            const c = check(i)
            return (
              <li key={l.name} className={`bu-slab ${state(i)} ${i === FAULT && phase === 'fault' ? 'bad' : ''}`}>
                <span className="bu-i">{String(i + 1).padStart(2, '0')}</span>
                <b>{l.name}</b>
                <span className="bu-r">
                  <span className="runs">{c && !reread ? <em className={c.ok ? 'ok' : 'no'}>{c.ok ? '✓' : '✗'} {c.t}</em> : l.runs}</span>
                  <span className="guards">{l.guards}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="bu-verbs" aria-label="What the program trains">
        {VERBS.map((v, i) => <span key={v} className={i === verb || reread ? 'on' : ''}><i />{v}</span>)}
      </div>
    </div>
  )
}
