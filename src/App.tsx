import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import CasefileApp from './casefile/CasefileApp'
import { hookFlags } from './casefile/flags'
import { warmPhone } from './casefile/phone/app/early'
import PhoneName from './casefile/phone/app/PhoneName'

// The phone shell (plan M1 P2): decided once per load. A touch screen whose short side is under 600 px gets baked stills and clips on a
// native-scroll reel (its own chunk, no three.js); everything else gets the archive as before. (?phone-app forces it on any device in a build with the test hooks; flags.ts.)
const PhoneApp = lazy(() => import('./casefile/phone/app/PhoneApp'))
const PHONE = (() => {
  try {
    const f = hookFlags()
    if (f.bake) return false   // the bake renders the desktop archive
    return f.phoneApp || (window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600)
  } catch { return false }
})()

if (PHONE) warmPhone()   // the shell's chunk, the entry page's chunk and the manifest are asked for side by side

// One archive for every route: "/" and "/projects/:slug" share the same scene instance, so
// opening or closing a file never rebuilds the 3D archive. Old v2 links still land.
export default function App() {
  if (PHONE) return <Suspense fallback={<PhoneName />}><PhoneApp /></Suspense>
  return (
    <Routes>
      <Route path="/portfolio" element={<Navigate to="/" replace />} />
      <Route path="*" element={<CasefileApp />} />
    </Routes>
  )
}
