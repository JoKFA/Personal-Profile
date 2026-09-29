import { Navigate, Route, Routes } from 'react-router-dom'
import CasefileApp from './casefile/CasefileApp'

// One archive for every route: "/" and "/projects/:slug" share the same scene instance, so
// opening or closing a file never rebuilds the 3D archive. Old v2 links still land.
export default function App() {
  return (
    <Routes>
      <Route path="/portfolio" element={<Navigate to="/" replace />} />
      <Route path="*" element={<CasefileApp />} />
    </Routes>
  )
}
