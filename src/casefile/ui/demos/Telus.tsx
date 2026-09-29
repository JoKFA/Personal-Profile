// TELUS AI Hackathon: the model reads each Semgrep finding with its code, decides whether it is
// real, explains why, and proposes a fix that keeps behaviour; a person approves.
import { useState } from 'react'
import { useScript } from './useLoop'

const FINDINGS = [
  { rule: 'xss.direct-response-write · CWE-79', file: 'routes/search.js:41', code: 'res.send(`<h2>Results for ${q}</h2>`)', verdict: 'valid', why: 'q comes straight from req.query and is written into HTML unescaped.', fix: "res.render('search', { q, results })", safe: 'Template auto-escapes; same markup, same route.' },
  { rule: 'sqli.string-concat · CWE-89', file: 'db/report.js:18', code: 'db.query("SELECT * FROM r WHERE id=" + ADMIN_ID)', verdict: 'false positive', why: 'ADMIN_ID is a compile-time constant; no user input reaches the query.', fix: null, safe: 'Dismissed with the reason recorded; no change proposed.' },
  { rule: 'path-traversal · CWE-22', file: 'files/get.js:9', code: 'fs.readFile(path.join(DIR, req.params.name))', verdict: 'valid', why: '"../" in name escapes DIR.', fix: 'const f = path.resolve(DIR, name); if (!f.startsWith(DIR)) return 404', safe: 'Legit filenames behave the same; tests unchanged.' },
] as const
const STEPS = ['Semgrep', 'AI verdict', 'Safe fix', 'Human review'] as const

export function Telus() {
  const [i, setI] = useState(0), [step, setStep] = useState(0)
  useScript(async (wait, reduced) => {
    if (reduced) { setStep(3); return }
    for (let k = 0; ; k++) {
      setI(k % 3)
      for (let s = 0; s < 4; s++) { setStep(s); if (!(await wait(s === 0 ? 900 : 1500))) return }
      if (!(await wait(1200))) return
    }
  })
  const f = FINDINGS[i], fp = f.verdict === 'false positive'
  return (
    <div className="dm-panel">
      <div className="dm-head"><span>PR review · AI-assisted AppSec</span><span className="live">sample findings</span></div>
      <div className="dm-stages">{STEPS.map((s, n) => <span key={s} className={n < step ? 'done' : n === step ? 'on' : ''}>{s}</span>)}</div>
      <div className="tl">
        <div className="lbl">{f.rule} · {f.file}</div>
        <pre className={step >= 1 && !fp ? 'del' : ''}>{f.code}</pre>
        {step >= 1 && <div className={`verdict ${fp ? 'fp' : 'valid'}`}><b>{fp ? 'False positive' : 'Valid'}</b><span>{f.why}</span></div>}
        {step >= 2 && (f.fix ? <pre className="add">+ {f.fix}</pre> : <div className="verdict fp"><b>No fix</b><span>Finding closed.</span></div>)}
        {step >= 2 && <div className="lbl safe">{f.safe}</div>}
      </div>
      <div className={`dm-cap ${step >= 3 ? 'pass' : ''}`}><b>{step >= 3 ? 'approved' : 'review'}</b><span>{step >= 3 ? (fp ? 'reviewer agreed · finding dismissed with reason' : 'reviewer approved · fix ready to merge') : 'a person decides before anything is merged'}</span></div>
    </div>
  )
}
