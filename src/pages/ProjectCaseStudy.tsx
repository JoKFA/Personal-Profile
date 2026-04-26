import { Navigate, useParams } from 'react-router-dom'
import { projects, projectLookup } from '../data/projects'

const mcpPipeline = [
  ['01', 'Discover', 'repo / npm / local / URL'],
  ['02', 'Sandbox', 'Docker + runtime fixes'],
  ['03', 'Bridge', 'stdio / SSE -> HTTP'],
  ['04', 'Probe', 'SafeAdapter + detectors'],
  ['05', 'Report', 'JSON / SARIF / audit'],
] as const

const mcpDetectors = [
  ['injection', 'prompt injection', 'indirect injection', 'command/code execution'],
  ['data', 'credential exposure', 'insecure storage', 'sensitive resources'],
  ['access', 'unauthenticated access', 'excessive permissions', 'privilege abuse'],
  ['tooling', 'tool poisoning', 'tool shadowing', 'rug-pull behavior'],
] as const

const mcpReportFindings = [
  {
    target: 'DV-MCP Challenge 1',
    detector: 'MCP-2024-CE-001',
    title: 'Credential exposure',
    severity: 'HIGH',
    confidence: '95%',
    proof: 'read_resource -> internal://credentials',
    evidence: '4 secrets found: passwords, API keys, connection strings',
  },
  {
    target: 'DV-MCP Challenge 8',
    detector: 'MCP-2024-CEX-001',
    title: 'Malicious code execution',
    severity: 'CRITICAL',
    confidence: '90%',
    proof: 'tool -> generate_code_example',
    evidence: 'No sandboxing detected; arbitrary code execution risk scored 80%',
  },
  {
    target: 'Excel MCP',
    detector: 'MCP-2024-EP-001',
    title: 'Excessive permissions',
    severity: 'CRITICAL',
    confidence: '90%',
    proof: 'tool -> delete_range',
    evidence: 'filesystem_access + database_access with unrestricted filepath parameters',
  },
] as const

function McpSystemShowcase() {
  return (
    <section className="mcp-showcase" aria-label="MCP Security Framework system overview">
      <div className="mcp-showcase-head">
        <p className="case-section-label" aria-hidden="true">00 / system artifact</p>
        <h2 className="case-section-heading">The project is a scanner, sandbox, bridge, and evidence system.</h2>
      </div>

      <div className="mcp-pipeline" aria-label="five phase pipeline">
        {mcpPipeline.map(([step, title, detail]) => (
          <div key={step} className="mcp-pipeline-step">
            <span className="mcp-step-number">{step}</span>
            <span className="mcp-step-title">{title}</span>
            <span className="mcp-step-detail">{detail}</span>
          </div>
        ))}
      </div>

      <div className="mcp-artifact-grid">
        <div className="mcp-artifact mcp-artifact-large">
          <p className="mcp-artifact-label" aria-hidden="true">// AMSAW v2</p>
          <h3>Automatic sandboxing is the core engineering move.</h3>
          <p>
            The framework does not assume the user knows how to run every MCP server. It infers
            source type, language, transport, entry point, dependencies, host, and port, then starts
            the target in Docker with retries and cleanup.
          </p>
          <div className="mcp-source-row" aria-label="accepted source types">
            <span>GitHub repo</span>
            <span>npm package</span>
            <span>local folder</span>
            <span>remote URL</span>
          </div>
        </div>

        <div className="mcp-artifact">
          <p className="mcp-artifact-label" aria-hidden="true">// safety layer</p>
          <h3>SafeAdapter sits between probes and targets.</h3>
          <ul className="mcp-mini-list">
            <li>rate limits</li>
            <li>request budgets</li>
            <li>scope controls</li>
            <li>evidence redaction</li>
          </ul>
        </div>

        <div className="mcp-artifact">
          <p className="mcp-artifact-label" aria-hidden="true">// output bundle</p>
          <h3>Findings become reviewable artifacts.</h3>
          <code className="mcp-output-stack">
            report.json{'\n'}
            report.sarif{'\n'}
            report.txt{'\n'}
            audit.jsonl{'\n'}
            metadata.json
          </code>
        </div>
      </div>

      <div className="mcp-detector-matrix" aria-label="detector coverage matrix">
        {mcpDetectors.map(([category, ...items]) => (
          <div key={category} className="mcp-detector-column">
            <p className="mcp-detector-category">{category}</p>
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="mcp-report-excerpts" aria-label="redacted real report excerpts">
        <div className="mcp-report-head">
          <p className="mcp-artifact-label" aria-hidden="true">// redacted report excerpts</p>
          <h3>Real successful findings from local MCPSF report bundles.</h3>
        </div>
        <div className="mcp-report-grid">
          {mcpReportFindings.map((finding) => (
            <article key={`${finding.target}-${finding.detector}`} className="mcp-report-card">
              <div className="mcp-report-card-top">
                <span>{finding.target}</span>
                <strong>{finding.severity}</strong>
              </div>
              <h4>{finding.title}</h4>
              <dl className="mcp-report-facts">
                <div>
                  <dt>detector</dt>
                  <dd>{finding.detector}</dd>
                </div>
                <div>
                  <dt>confidence</dt>
                  <dd>{finding.confidence}</dd>
                </div>
                <div>
                  <dt>proof</dt>
                  <dd>{finding.proof}</dd>
                </div>
                <div>
                  <dt>evidence</dt>
                  <dd>{finding.evidence}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProjectCaseStudyPage() {
  const { slug } = useParams<{ slug: string }>()
  const project = slug ? projectLookup.get(slug) : undefined

  if (!project) {
    return <Navigate to="/portfolio" replace />
  }

  const idx = projects.findIndex((p) => p.slug === slug)
  const nextProject = projects[(idx + 1) % projects.length]
  const isMcpProject = project.slug === 'mcp-security-framework'

  return (
    <>
      <div className="case-back-bar">
        <div className="site-shell">
          <a className="case-back-link" href="/portfolio#work">back to work</a>
        </div>
      </div>

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

      <div className="site-shell case-body">
        <main className="case-content">
          {isMcpProject && <McpSystemShowcase />}

          {project.caseSections ? (
            project.caseSections.map((section) => (
              <section key={section.eyebrow} aria-label={section.title}>
                <p className="case-section-label" aria-hidden="true">{section.eyebrow}</p>
                <h2 className="case-section-heading">{section.title}</h2>
                <p className="case-section-body">{section.body}</p>
                {section.points && (
                  <ul className="case-highlights" aria-label="key points">
                    {section.points.map((point, i) => (
                      <li key={point} className="case-highlight">
                        <span className="highlight-number" aria-hidden="true">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="highlight-text">{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          ) : (
            <>
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
            </>
          )}
        </main>

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

      <footer className="site-footer">
        <div className="site-shell footer-row">
          <p className="footer-copy" aria-hidden="true">// yaoting.wang / {new Date().getFullYear()}</p>
          <a className="ghost-button" href="/portfolio#contact">get in touch</a>
        </div>
      </footer>
    </>
  )
}
