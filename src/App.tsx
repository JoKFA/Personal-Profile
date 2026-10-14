import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import CasefileApp from './casefile/CasefileApp'
import { warmPhone } from './casefile/phone/app/early'
import PhoneName from './casefile/phone/app/PhoneName'

// ?phone-spike: the phone plan's P0 stage (baked stills and clips); a separate chunk, no scene code, nothing for any other URL
const Spike = lazy(() => import('./casefile/phone/spike/Spike'))
const SPIKE = new URLSearchParams(window.location.search).has('phone-spike')

// The phone shell (plan M1 P2): decided once per load. A touch screen whose short side is under 600 px gets baked stills and clips on a
// native-scroll reel (its own chunk, no three.js); everything else gets the archive as before. ?phone-app forces it, for tests on a desktop browser.
const PhoneApp = lazy(() => import('./casefile/phone/app/PhoneApp'))
const PHONE = (() => {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.has('bake')) return false   // the bake renders the desktop archive
    return q.has('phone-app') || (window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600)
  } catch { return false }
})()

if (PHONE) warmPhone()   // the shell's chunk, the entry page's chunk and the manifest are asked for side by side

// One archive for every route: "/" and "/projects/:slug" share the same scene instance, so
// opening or closing a file never rebuilds the 3D archive. Old v2 links still land.
export default function App() {
  if (SPIKE) return <Suspense fallback={null}><Spike /></Suspense>
  if (PHONE) return <Suspense fallback={<PhoneName />}><PhoneApp /></Suspense>
  return (
    <Routes>
      <Route path="/portfolio" element={<Navigate to="/" replace />} />
      <Route path="*" element={<CasefileApp />} />
    </Routes>
  )
}
