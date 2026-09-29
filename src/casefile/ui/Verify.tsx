// Integrity check before a drive opens: the SHA-256 of the file settles digit by digit.
import { useEffect, useState } from 'react'

const HEX = '0123456789abcdef'
export function Verify({ hash, restricted }: { hash: string; restricted: boolean }) {
  const target = hash.slice(0, 32)
  const [n, setN] = useState(0)
  const [noise, setNoise] = useState('')
  useEffect(() => {
    const t0 = performance.now(); let raf = 0
    const f = (now: number) => { const k = Math.min(1, (now - t0) / 900); const m = Math.floor(k * target.length); setN(m); setNoise(Array.from({ length: target.length - m }, () => HEX[Math.floor(Math.random() * 16)]).join('')); if (k < 1) raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf)
  }, [target])
  const done = n >= target.length
  const rest = noise
  return (
    <div className="verify" role="status" aria-live="polite">
      <span className={`lbl ${done ? (restricted ? 'x' : 'ok') : ''}`}>
        {done ? (restricted ? '✓ integrity verified · key withheld · handing over to SENTINEL-1' : '✓ integrity verified · decrypting') : 'SHA-256 · verifying integrity'}
      </span>
      <b>{target.slice(0, n)}<i>{rest}</i></b>
      <svg className="verify-rule" viewBox="0 0 100 1" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0.5" x2="100" y2="0.5" pathLength={1} /></svg>
    </div>
  )
}
