import { Navigate, useParams } from 'react-router-dom'
import { projects, projectLookup } from '../data/projects'

export function ProjectCaseStudyPage() {
  const { slug } = useParams<{ slug: string }>()
  const project = slug ? projectLookup.get(slug) : undefined

  if (!project) {
    return <Navigate to="/" replace />
  }

  const idx = projects.findIndex((p) => p.slug === slug)
  const nextProject = projects[(idx + 1) % projects.length]

  return (
    <>
      {/* ── Back bar ── */}
      <div className="case-back-bar">
        <div className="site-shell">
          <a className="case-back-link" href="/#work">← back to work</a>
        </div>
      </div>

      {/* ── Project header ── */}
      <header className="case-header">
        <div className="site-shell">
          <p className="case-eyebrow" aria-hidden="true">{project.eyebrow}</p>
          <h1 className="case-title">{project.title}</h1>
          <p className="case-summary">{project.summary}</p>
          <div className="case-meta-row">
            <span className="status-chip">{project.status}</span>
          </div>
          <div className="case-meta-tags">
            {project.tags.map((tag) => (
              <span key={tag} className="tag" aria-hidden="true">{tag}</span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body: content + sidebar ── */}
      <div className="site-shell case-body">
        <main className="case-content">
          <section aria-label="problem">
            <p className="case-section-label" aria-hidden="true">01 / problem</p>
            <h2 className="case-section-heading">Problem</h2>
            <p className="case-section-body">{project.overview.problem}</p>
          </section>

          <section aria-label="approach">
            <p className="case-section-label" aria-hidden="true">02 / approach</p>
            <h2 className="case-section-heading">Approach</h2>
            <p className="case-section-body">{project.overview.approach}</p>
            <ul className="case-highlights" aria-label="key points">
              {project.highlights.map((h, i) => (
                <li key={i} className="case-highlight">
                  <span className="highlight-number" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="highlight-text">{h}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="results">
            <p className="case-section-label" aria-hidden="true">03 / results</p>
            <h2 className="case-section-heading">Results</h2>
            <p className="case-section-body">{project.overview.results}</p>
          </section>
        </main>

        {/* ── Sidebar ── */}
        <aside className="case-sidebar" aria-label="project details">
          <div>
            <p className="sidebar-label" aria-hidden="true">// stack</p>
            <div className="sidebar-tags">
              {project.techStack.map((tech) => (
                <span key={tech} className="tag">{tech}</span>
              ))}
            </div>
          </div>

          {project.links.length > 0 && (
            <div>
              <p className="sidebar-label" aria-hidden="true">// links</p>
              <div className="sidebar-links">
                {project.links.map((link) => (
                  <a key={link.href} className="sidebar-link" href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="sidebar-label" aria-hidden="true">// metrics</p>
            <div className="sidebar-metrics">
              {project.metrics.map((metric) => (
                <div key={metric.label} className="sidebar-metric">
                  <span className="metric-key">{metric.label}</span>
                  <span className="metric-val">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Next project ── */}
      {nextProject && (
        <section className="next-project-section" aria-label="next project">
          <div className="site-shell">
            <a className="next-project-card" href={`/projects/${nextProject.slug}`}>
              <p className="next-label" aria-hidden="true">// next project</p>
              <h2 className="next-title">{nextProject.title}</h2>
              <p className="next-summary">{nextProject.summary}</p>
            </a>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="site-shell footer-row">
          <p className="footer-copy" aria-hidden="true">// yaoting.wang · {new Date().getFullYear()}</p>
          <a className="ghost-button" href="/#contact">get in touch</a>
        </div>
      </footer>
    </>
  )
}
