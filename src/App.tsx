import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { StatusStrip } from './components/StatusStrip'
import { HomePage } from './pages/Home'
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

const pageVariants = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const pageTransition = { duration: 0.2, ease: 'easeInOut' as const }

function AppFrame() {
  useHashAlias()
  useScrollReset()
  const location = useLocation()

  return (
    <>
      <NavBar />
      <main className="page-frame">
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
              <Route path="/" element={<HomePage />} />
              <Route path="/projects/:slug" element={<ProjectCaseStudyPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <StatusStrip />
    </>
  )
}

export default function App() {
  return <AppFrame />
}
