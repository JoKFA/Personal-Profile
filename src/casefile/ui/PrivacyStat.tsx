// The recon claims nothing leaves the browser; this lets anyone check it. Counted live in the page:
// requests to any other origin, and cookies. The link runs Mozilla's header scan on this host.
import { useEffect, useState } from 'react'

const OBSERVATORY = `https://developer.mozilla.org/en-US/observatory/analyze?host=${typeof location !== 'undefined' ? location.hostname : ''}`

export function PrivacyStat() {
  const [n, setN] = useState({ third: 0, cookies: 0 })
  useEffect(() => {
    const f = () => {
      const third = performance.getEntriesByType('resource').filter((r) => { try { const u = new URL(r.name, location.href); return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== location.origin } catch { return false } }).length
      const cookies = document.cookie ? document.cookie.split(';').filter((c) => c.trim()).length : 0
      setN((o) => (o.third === third && o.cookies === cookies ? o : { third, cookies }))
    }
    f(); const h = setInterval(f, 4000); return () => clearInterval(h)
  }, [])
  return (
    <span className="privacy" title="Counted live in this page">
      <b>{n.third}</b> trackers · <b>{n.cookies}</b> cookies · <a href={OBSERVATORY} target="_blank" rel="noopener noreferrer">headers ↗</a>
    </span>
  )
}
