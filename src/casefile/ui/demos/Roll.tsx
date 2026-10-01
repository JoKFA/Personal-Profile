// Digits that roll into place, one strip per digit (after RhineLabUI's rolling clock).
// Non-digits are set as plain characters.
export function Roll({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`roll ${className}`} aria-label={value}>
      {[...value].map((d, k) => /\d/.test(d) ? (
        <span key={k} className="roll-d" aria-hidden="true">
          <span className="roll-s" style={{ transform: `translateY(${-Number(d) * 10}%)`, transitionDelay: `${k * 60}ms` }}>
            {'0123456789'.split('').map((n) => <span key={n}>{n}</span>)}
          </span>
        </span>
      ) : <span key={k} aria-hidden="true">{d}</span>)}
    </span>
  )
}
