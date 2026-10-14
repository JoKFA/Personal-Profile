import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import '../../styles/tokens.css'
import './PhoneApp.css'
import { startPhone, type PhoneHandle } from './controller'
import { EntryBridge, isFirstVisit } from './gate/entry'
import PhoneName from './PhoneName'

// The entry page (a first visit only) is its own chunk's worth of code: a return visit never loads it.
const PhoneGate = lazy(() => import('./gate/PhoneGate'))

/**
 * The phone shell (plan M1, P2): baked stills and clips on a fixed stage, a native-scroll reel over it. A separate chunk:
 * it imports no three.js, no CasefileApp, no Hud, no archive.css and nothing under scene/. React only hosts the DOM that controller.ts builds.
 * A first visit starts with the entry page (P4) over it: hold the print to verify, then the entrance plays.
 */
export default function PhoneApp() {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  // decided once per load; the bridge outlives React's double-mount in development
  const [bridge] = useState(() => (isFirstVisit() ? new EntryBridge(matchMedia('(prefers-reduced-motion: reduce)').matches) : null))
  const [gate, setGate] = useState(!!bridge)
  useEffect(() => {
    const host = ref.current!
    const html = document.documentElement, body = document.body
    // the desktop's body rules (overflow hidden) are off while the phone shell runs
    const hadCf = body.classList.contains('cf-body')
    body.classList.remove('cf-body'); body.classList.add('ph-body'); html.classList.add('ph')
    if (bridge) { html.classList.add('ph-entry'); bridge.whenDone(() => setGate(false)) }
    let handle: PhoneHandle | null = null, dead = false
    startPhone(host, () => dead, bridge ?? undefined).then((h) => { if (dead) h.dispose(); else handle = h }).catch((e: unknown) => { console.error('phone shell failed to start', e); if (!dead) setFailed(true) })
    return () => {
      dead = true; handle?.dispose()
      html.classList.remove('ph', 'ph-locked', 'ph-entry'); body.classList.remove('ph-body'); if (hadCf) body.classList.add('cf-body')
    }
  }, [bridge])
  return (
    <>
      <div className="ph-host" ref={ref}>{failed ? <p className="ph-fail" role="alert">The archive could not be loaded. Reload to try again.</p> : null}</div>
      <PhoneName />
      {gate && !failed && bridge ? <Suspense fallback={null}><PhoneGate bridge={bridge} /></Suspense> : null}
    </>
  )
}
