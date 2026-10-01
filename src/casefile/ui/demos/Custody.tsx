// BTech, Digital Forensics & Cybersecurity: one sample case, told in plain words, from the alert
// to the courtroom. The scene on the left shows the step being done; the chain-of-custody log on
// the right keeps every signed step, with the course that taught it, so nothing scrolls away.
// At the end the visitor can skip a step and watch the same evidence get thrown out.
// The fingerprints are real SHA-256 of sample bytes, computed in the browser.
import { useEffect, useState } from 'react'
import { useScript } from './useLoop'

const BYTES = 'EXHIBIT-A (sample) · laptop disk · last access 00'
const OPENED = BYTES.slice(0, -1) + '1'
async function sha256(s: string) {
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}
const short = (h: string) => h ? `${h.slice(0, 4)} ${h.slice(4, 8)} … ${h.slice(-4)}` : '···· ···· … ····'

const STEPS = [
  { verb: 'Alert', line: 'A security tool flags a laptop copying files to a USB stick.', log: 'Endpoint alert raised', course: 'Capstone · FSCT 8611' },
  { verb: 'Seize', line: 'The laptop is sealed in an evidence bag and signed for.', log: 'Sealed and signed for', course: 'FSCT 7509' },
  { verb: 'Copy', line: 'An exact copy is made and the original is never touched: both fingerprints match.', log: 'Copied behind a write blocker', course: 'FSCT 7509' },
  { verb: 'Examine', line: 'Only the copy is examined. It shows what left the laptop, and in what order.', log: 'Deleted files recovered', course: 'FSCT 8513' },
  { verb: 'Court', line: 'In court, the signed log and the matching fingerprint prove nothing was changed.', log: 'Evidence admitted', course: 'FSCT 7002' },
] as const

function Scene({ k, fp, broken }: { k: number; fp: { a: string; b: string }; broken: boolean }) {
  if (k === 0) return (
    <svg viewBox="0 0 260 150" className="cc-art" aria-hidden="true">
      <rect className="ln" x="60" y="22" width="120" height="78" rx="6" /><path className="ln" d="M44,108 H196 L184,100 H56 Z" />
      <rect className="ln usb" x="198" y="96" width="30" height="10" rx="2" /><path className="ln" d="M184,101 H198" />
      <circle className="pulse" cx="120" cy="61" r="16" /><circle className="pulse p2" cx="120" cy="61" r="16" /><text className="bang" x="120" y="67">!</text>
      <text className="cap" x="120" y="136">endpoint alert · files → USB stick</text>
    </svg>
  )
  if (k === 1) return (
    <svg viewBox="0 0 260 150" className="cc-art" aria-hidden="true">
      <path className="ln" d="M70,22 H178 V130 Q178,138 170,138 H78 Q70,138 70,130 Z" />
      <path className="tape" d="M70,38 H178" /><text className="tape-t" x="124" y="41.5">EVIDENCE</text>
      <rect className="ln faint" x="92" y="58" width="64" height="40" rx="4" /><path className="ln faint" d="M86,104 H162" />
      <g className="tag"><rect x="170" y="86" width="72" height="42" rx="4" /><text x="206" y="102">EXHIBIT A</text><path className="sig" d="M182,116 q6,-9 12,0 t12,0 t12,-3 t10,1" /></g>
    </svg>
  )
  if (k === 2) return (
    <svg viewBox="0 0 260 150" className="cc-art" aria-hidden="true">
      <rect className={`ln drv ${broken ? 'bad' : ''}`} x="12" y="30" width="72" height="46" rx="6" /><text className="lab" x="48" y="57">ORIGINAL</text>
      <rect className="ln drv ok" x="176" y="30" width="72" height="46" rx="6" /><text className="lab" x="212" y="57">COPY</text>
      <path className="flow" d="M84,53 H176" />
      <g className={`lock ${broken ? 'open' : ''}`} transform="translate(130 53)"><rect x="-17" y="-15" width="34" height="30" rx="5" />
        <path d={broken ? 'M-5,-3 v-5 a5,5 0 0 1 10,0 v-3' : 'M-5,-3 v-5 a5,5 0 0 1 10,0 v5'} /><rect className="body" x="-7" y="-3" width="14" height="10" rx="2" /></g>
      <text className={`lab s ${broken ? 'bad' : ''}`} x="130" y="88">{broken ? 'opened without protection' : 'write blocker: read-only'}</text>
      <text className={`fp ${broken ? 'bad' : 'ok'}`} x="48" y="116">{short(broken ? fp.b : fp.a)}</text>
      <text className="fp ok" x="212" y="116">{short(fp.a)}</text>
      <text className={`eq ${broken ? 'bad' : 'ok'}`} x="130" y="119">{broken ? '≠' : '='}</text>
      <text className="lab s" x="130" y="140">digital fingerprints (SHA-256)</text>
    </svg>
  )
  if (k === 3) return (
    <svg viewBox="0 0 260 150" className="cc-art" aria-hidden="true">
      <path className="ln" d="M36,22 V124" />
      {(['USB stick plugged in', 'Files copied to it', 'Files deleted'] as const).map((t, i) => (
        <g key={t} className="ev" style={{ animationDelay: `${i * 0.35}s` }}><circle cx="36" cy={30 + i * 36} r="4" /><text x="50" y={34 + i * 36}>{t}</text></g>
      ))}
      <g className="ev rec" style={{ animationDelay: '1.3s' }}><path d="M146,98 l6,6 l12,-14" /><text x="170" y="103">recovered</text></g>
      <g className="lens"><circle cx="206" cy="44" r="22" /><path d="M222,60 L240,78" /></g>
    </svg>
  )
  return (
    <div className="cc-court">
      <p className="q"><i className="lbl">Defence lawyer</i>“Could anyone have changed this evidence?”</p>
      <p className={`a ${broken ? 'bad' : ''}`}><i className="lbl">Examiner</i>{broken ? '“The original was opened without protection. Its fingerprint no longer matches.”' : '“No. Every hand is in the log, and the fingerprint still matches.”'}</p>
      <span className={`stamp ${broken ? 'bad' : ''}`}>{broken ? 'Excluded' : 'Admitted'}</span>
    </div>
  )
}

export function Custody() {
  const [fp, setFp] = useState({ a: '', b: '' })
  const [n, setN] = useState(-1)          // last step done
  const [view, setView] = useState<number | null>(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => { void Promise.all([sha256(BYTES), sha256(OPENED)]).then(([a, b]) => setFp({ a, b })) }, [])
  useScript(async (wait, reduced) => {
    if (reduced) { setN(STEPS.length - 1); return }
    if (!(await wait(500))) return
    for (let i = 0; i < STEPS.length; i++) { setN(i); if (!(await wait(i === 2 ? 3300 : 2700))) return }
  })
  const k = Math.max(0, view ?? n)
  const s = STEPS[k]
  const done = n >= STEPS.length - 1
  return (
    <div className={`dm-panel case ${broken ? 'is-broken' : ''}`}>
      <div className="dm-head"><span>Case file · sample</span><span>Detect → preserve → examine → court</span></div>
      <div className="cc-body">
        <div className="cc-scene">
          <span className="cc-step"><b>{String(k + 1).padStart(2, '0')}</b>{s.verb}</span>
          <div className="cc-art-wrap" key={`${k}-${broken}`}><Scene k={k} fp={fp} broken={broken} /></div>
          <p className="cc-line">{k === 4 && broken ? 'Skip one step, and the same evidence is thrown out.' : s.line}</p>
        </div>
        <div className="cc-log">
          <span className="lbl">Chain of custody</span>
          <ol onMouseLeave={() => setView(null)}>
            {STEPS.map((x, i) => {
              const bad = broken && (i === 2 || i === 4)
              return (
                <li key={x.verb} className={`${i <= n ? 'on' : ''} ${i === k ? 'cur' : ''} ${bad ? 'bad' : ''}`} onMouseEnter={() => { if (i <= n) setView(i) }}>
                  <i aria-hidden="true">{bad ? '✗' : i <= n ? '✓' : ''}</i>
                  <span><b>{bad && i === 2 ? 'Original opened directly' : bad ? 'Evidence excluded' : x.log}</b><em>{x.course}</em></span>
                </li>
              )
            })}
          </ol>
          {done && <button className="cc-try" onClick={() => { setBroken((b) => !b); setView(null) }}>{broken ? '↺ Keep every step' : 'What if one step is skipped?'}</button>}
        </div>
      </div>
    </div>
  )
}
