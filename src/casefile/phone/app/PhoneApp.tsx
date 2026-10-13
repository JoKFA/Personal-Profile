import { useEffect, useRef, useState } from 'react'
import '../../styles/tokens.css'
import './PhoneApp.css'
import { startPhone, type PhoneHandle } from './controller'

/**
 * The phone shell (plan M1, P2): baked stills and clips on a fixed stage, a native-scroll reel over it. A separate chunk:
 * it imports no three.js, no CasefileApp, no Hud, no archive.css and nothing under scene/. React only hosts the DOM that controller.ts builds.
 */
export default function PhoneApp() {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const host = ref.current!
    const html = document.documentElement, body = document.body
    // the desktop's body rules (overflow hidden) are off while the phone shell runs
    const hadCf = body.classList.contains('cf-body')
    body.classList.remove('cf-body'); body.classList.add('ph-body'); html.classList.add('ph')
    let handle: PhoneHandle | null = null, dead = false
    startPhone(host, () => dead).then((h) => { if (dead) h.dispose(); else handle = h }).catch(() => { if (!dead) setFailed(true) })
    return () => {
      dead = true; handle?.dispose()
      html.classList.remove('ph', 'ph-locked'); body.classList.remove('ph-body'); if (hadCf) body.classList.add('cf-body')
    }
  }, [])
  return <div className="ph-host" ref={ref}>{failed ? <p className="ph-fail" role="alert">The archive could not be loaded. Reload to try again.</p> : null}</div>
}
