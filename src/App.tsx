import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { StatusStrip } from './components/StatusStrip'
import { HomePage } from './pages/Home'
import { LandingPage } from './pages/Landing'
import { ProjectCaseStudyPage } from './pages/ProjectCaseStudy'

const HASH_ALIASES: Record<string, string> = {
  '#capabilities': '#work',
  '#briefing': '#contact',
  '#ctf': '#work',
}

function useHashAlias() {
  const location = useLocation()
  useEffect(() => {
    const alias = HASH_ALIASES[location.hash]
    if (alias) {
      window.history.replaceState(null, '', location.pathname + alias)
      window.requestAnimationFrame(() => {
        document.querySelector(alias)?.scrollIntoView({ block: 'start' })
      })
    }
  }, [location.hash, location.pathname])
}

function useScrollReset() {
  const location = useLocation()
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    } else {
      window.requestAnimationFrame(() => {
        document.querySelector(location.hash)?.scrollIntoView({ block: 'start' })
      })
    }
  }, [location.pathname, location.hash])
}

// Return-visitor skip: if they've already seen the lab, drop them at /portfolio.
// Visiting /?force=1 bypasses the skip so the lab can be revisited.
function useReturnVisitorSkip() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (location.pathname !== '/') return
    const params = new URLSearchParams(location.search)
    if (params.get('force') === '1') return
    try {
      if (localStorage.getItem('sentinel.visited') === '1') {
        navigate('/portfolio', { replace: true })
      }
    } catch {
      // localStorage blocked — show the lab as a default.
    }
  }, [location.pathname, location.search, navigate])
}

const pageVariants = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const pageTransition = { duration: 0.2, ease: 'easeInOut' as const }

function AppFrame() {
  useHashAlias()
  useScrollReset()
  useReturnVisitorSkip()
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <>
      {!isLanding && <NavBar />}
      <main className={isLanding ? 'page-frame page-frame--landing' : 'page-frame'}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/portfolio" element={<HomePage />} />
              <Route path="/projects/:slug" element={<ProjectCaseStudyPage />} />
              <Route path="*" element={<Navigate to="/portfolio" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {!isLanding && <StatusStrip />}
    </>
  )
}

export default function App() {
  return <AppFrame />
}
