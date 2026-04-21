import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { profile } from '../data/profile'

const navLinks = [
  { label: 'work', href: '/#work' },
  { label: 'experience', href: '/#experience' },
  { label: 'contact', href: '/#contact' },
]

export function NavBar() {
  const [open, setOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header className="nav-shell">
      <div className="site-shell nav-row">
        <Link className="brand-link" to="/">
          <span>yaoting.wang</span>
          <span className="brand-slash">/</span>
          <span>portfolio</span>
        </Link>

        <nav className="nav-links" aria-label="site">
          {navLinks.map((link) => (
            <a key={link.href} className="nav-link" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <a
            className="ghost-button resume-button"
            href={profile.resumePath}
            target="_blank"
            rel="noopener noreferrer"
          >
            resume.pdf →
          </a>
          <button
            type="button"
            className="hamburger-button"
            aria-label="open navigation"
            aria-expanded={open}
            aria-controls="mobile-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`hamburger-icon${open ? ' open' : ''}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div
        className={`drawer-backdrop${open ? ' open' : ''}`}
        aria-hidden={!open}
      >
        <div
          ref={drawerRef}
          id="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="navigation"
          className={`drawer-panel${open ? ' open' : ''}`}
        >
          <nav className="drawer-nav" aria-label="mobile navigation">
            {navLinks.map((link) => (
              <a
                key={link.href}
                className="drawer-link"
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            className="ghost-button drawer-resume"
            href={profile.resumePath}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            resume.pdf →
          </a>
        </div>
      </div>
    </header>
  )
}
