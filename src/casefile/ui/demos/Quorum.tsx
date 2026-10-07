// SFU Master of Cybersecurity, "Quorum". CryptoLab (CMPT 789) splits a vault's recovery key into
// Shamir shares: one share reveals nothing, any two rebuild the key. Here the three shares are
// held by the three seats the degree trained: attacker (Lab I), defender (Lab II) and the person
// who signs off the risk (co-op). One view alone leaves every key possible (a fan of lines); two
// views agree on one line, and it hits the secret. The key and its shares are a random sample made
// on load; recovery runs real 2-of-3 Shamir over GF(256). The plot is drawn over the reals.
import { useMemo, useState } from 'react'
import { useScript } from './useLoop'

// GF(256), AES polynomial 0x11b, generator 3
const EXP = new Uint8Array(512), LOG = new Uint8Array(256)
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x ^= (x << 1) ^ (x & 0x80 ? 0x11b : 0); x &= 0xff } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] }
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0)
const div = (a: number, b: number) => (a ? EXP[LOG[a] + 255 - LOG[b]] : 0)
/** Degree-1 split: share(x) = key ^ coef·x, for x = 1, 2, 3. */
function split(key: number[], coef: number[]) { return [1, 2, 3].map((x) => key.map((k, i) => k ^ mul(coef[i], x))) }
/** Lagrange at 0 from two shares (in GF(2^8), minus is xor). */
function combine(x1: number, y1: number[], x2: number, y2: number[]) {
  const d = x1 ^ x2
  return y1.map((a, i) => mul(a, div(x2, d)) ^ mul(y2[i], div(x1, d)))
}
const hex = (b: number[]) => b.map((x) => x.toString(16).padStart(2, '0')).join(' ')

const SEATS = [
  { role: 'Attacker', from: 'Lab I · CMPT 782', sees: 'how a system is broken into', proof: 'access-control findings, team pentest' },
  { role: 'Defender', from: 'Lab II · CMPT 783', sees: 'how an attack is detected and stopped', proof: 'PwnScan · Top 3' },
  { role: 'Risk owner', from: 'Co-op · Coast Capital', sees: 'what the risk is worth to the business', proof: '50+ risk assessments' },
] as const

// the plot (px): x = 0 is the secret's axis; shares sit at x = 1, 2, 3 on one line
const X0 = 44, DX = 92, S = { x: X0, y: 58 }, SLOPE = 40 / DX
const pt = (i: number) => ({ x: X0 + DX * (i + 1), y: S.y + SLOPE * DX * (i + 1) })
const TRUE = (Math.atan(SLOPE) * 180) / Math.PI
const FAN = [-52, -36, -22, -10, 0, 12, 26, 40, 56]

export function Quorum() {
  const [sel, setSel] = useState<number[]>([])
  const [touched, setTouched] = useState(false)
  const [final, setFinal] = useState(false)
  const { key, shares } = useMemo(() => {
    const r = new Uint8Array(16); crypto.getRandomValues(r)
    const key = [...r.slice(0, 8)], coef = [...r.slice(8)].map((c) => c || 1)
    return { key, shares: split(key, coef) }
  }, [])
  useScript(async (wait, reduced) => {
    if (reduced) { setSel([0, 1, 2]); setFinal(true); return }
    for (;;) {
      if (touched) return
      setFinal(false); setSel([]); if (!(await wait(1400))) return
      setSel([0]); if (!(await wait(2600))) return
      setSel([0, 1]); if (!(await wait(2800))) return
      setSel([1, 2]); if (!(await wait(2600))) return
      setSel([0, 1, 2]); setFinal(true); if (!(await wait(6000))) return
    }
  }, [touched])
  const toggle = (i: number) => { setTouched(true); setFinal(false); setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort())) }
  const open = sel.length >= 2
  const rec = open ? combine(sel[0] + 1, shares[sel[0]], sel[1] + 1, shares[sel[1]]) : null
  const ok = rec !== null && hex(rec) === hex(key)
  const pivot = pt(sel[0] ?? 0)
  const say = final ? <>Attacker, defender, risk owner. <b>The degree trained all three.</b></>
    : open ? <>Any two views agree, and <b>the vault opens.</b></>
      : sel.length === 1 ? <>One view alone: every answer is still possible.</>
        : <>A vault’s recovery key, split between three people.</>
  return (
    <div className={`dm-panel qm ${open ? 'is-open' : ''}`}>
      <div className="dm-head"><span>CryptoLab · recovery key · sample 2-of-3</span><span className={open ? 'ok' : ''}>{open ? 'unlocked' : 'locked'}</span></div>
      <p className="qm-say" key={String(final) + open + sel.length}>{say}</p>
      <div className="qm-body">
        <svg className="qm-plot" viewBox="0 0 360 236" aria-hidden="true">
          <defs><clipPath id="qm-clip"><rect x={X0} y="8" width="310" height="200" /></clipPath></defs>
          <path className="ax" d={`M${X0},8 V208 H354`} />
          <text className="ax-t" x={X0 - 8} y="14" textAnchor="end">key</text>
          {[0, 1, 2].map((i) => <text key={i} className="ax-t" x={pt(i).x} y="224" textAnchor="middle">share {i + 1}</text>)}
          <g clipPath="url(#qm-clip)">
            <g className="qm-fan" style={{ transform: `translate(${pivot.x}px, ${pivot.y}px)`, opacity: sel.length ? 1 : 0 }}>
              {FAN.map((d, k) => <line key={k} x1="-420" x2="420" y1="0" y2="0" style={{ transform: `rotate(${open ? TRUE : TRUE + d}deg)` }} className={open ? 'one' : ''} />)}
            </g>
          </g>
          <circle className={`qm-secret ${open ? 'on' : ''}`} cx={S.x} cy={S.y} r={open ? 7 : 5} />
          {!open && sel.length === 1 && <text className="qm-q" x={X0 - 10} y="120" textAnchor="end">?</text>}
          {[0, 1, 2].map((i) => <circle key={i} className={`qm-pt ${sel.includes(i) ? 'on' : ''}`} cx={pt(i).x} cy={pt(i).y} r="6" onClick={() => toggle(i)} />)}
        </svg>
        <ul className="qm-seats">
          {SEATS.map((s, i) => (
            <li key={s.role}>
              <button aria-pressed={sel.includes(i)} onClick={() => toggle(i)}>
                <span className="n">{i + 1}</span>
                <span className="t"><b>{s.role}</b><em>{s.from}</em><span className="sees">Sees {s.sees}</span><span className="pf">{s.proof}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={`dm-cap ${open ? (ok ? 'pass' : 'fail') : ''}`}>
        <b>{open ? 'recovered' : 'key'}</b>
        <span className="qm-key">{rec ? hex(rec) : '?? ?? ?? ?? ?? ?? ?? ??'}</span>
        <span className="lbl">{open ? (ok ? 'matches the original' : 'mismatch') : `${sel.length} of 2 shares`}</span>
      </div>
    </div>
  )
}
