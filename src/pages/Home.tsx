import { ContactForm } from '../components/ContactForm'
import { ScrollReveal } from '../components/ScrollReveal'
import { heroSignals, experienceSnapshot, socialLinks, profile } from '../data/profile'
import { projects } from '../data/projects'

export function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="hero-section" aria-label="introduction">
        <div className="site-shell">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="hero-eyebrow" aria-hidden="true">// MASc Cybersecurity · SFU · 2026</p>
              <h1 className="hero-name">{profile.name}</h1>
              <p className="hero-positioning">{profile.positioning}</p>
            </div>
            <div className="hero-signals" aria-label="current focus">
              {heroSignals.map((signal) => (
                <div key={signal.label} className="hero-signal">
                  <span className="signal-label" aria-hidden="true">{signal.label}</span>
                  <span className="signal-value">{signal.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Work ── */}
      <section id="work" className="work-section" aria-label="selected projects">
        <div className="site-shell">
          <ScrollReveal>
            <div className="section-head">
              <span className="section-number" aria-hidden="true">01 / work</span>
              <h2 className="section-title">Selected projects</h2>
            </div>
          </ScrollReveal>
          <div className="projects-grid">
            {projects.map((project) => (
              <a
                key={project.slug}
                href={`/projects/${project.slug}`}
                className={`project-card${project.featured ? ' featured' : ''}`}
              >
                <article>
                  <div className="card-top">
                    <div>
                      <p className="card-eyebrow" aria-hidden="true">{project.eyebrow}</p>
                      <h3 className="card-title">{project.title}</h3>
                    </div>
                    <span className="status-chip">{project.status}</span>
                  </div>
                  <p className="card-summary">{project.summary}</p>
                  <ul className="card-highlights">
                    {project.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                  <div className="tags-row">
                    {project.tags.map((tag) => (
                      <span key={tag} className="tag" aria-hidden="true">{tag}</span>
                    ))}
                  </div>
                </article>
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Experience ── */}
      <section id="experience" className="experience-section" aria-label="work experience">
        <div className="site-shell">
          <ScrollReveal>
            <div className="section-head">
              <span className="section-number" aria-hidden="true">02 / experience</span>
              <h2 className="section-title">Work experience</h2>
            </div>
          </ScrollReveal>
          <div className="experience-rows">
            {experienceSnapshot.map((exp) => (
              <ScrollReveal key={exp.organization}>
                <div className="experience-row">
                  <p className="exp-org">{exp.organization}</p>
                  <div className="exp-content">
                    <p className="exp-role">{exp.title}</p>
                    <p className="exp-bullet">{exp.bullet}</p>
                  </div>
                  <p className="exp-period">{exp.period}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <div className="experience-footer">
            <a
              className="ghost-button"
              href={profile.resumePath}
              target="_blank"
              rel="noopener noreferrer"
            >
              full resume →
            </a>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Contact ── */}
      <section id="contact" className="contact-section" aria-label="contact">
        <div className="site-shell">
          <div className="contact-grid">
            <ScrollReveal>
              <div>
                <h2 className="contact-heading">Let's work<br />together.</h2>
                <p className="contact-copy">
                  Open to AppSec, DevSecOps, and AI-security roles. Fastest response via email.
                </p>
                <div className="contact-channels">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      className="contact-channel"
                      href={link.href}
                      target={link.href.startsWith('mailto') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                    >
                      <span className="channel-label">{link.label.toLowerCase()}</span>
                      <span>→</span>
                    </a>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <ContactForm />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="site-shell footer-row">
          <p className="footer-copy" aria-hidden="true">// yaoting.wang · {new Date().getFullYear()}</p>
          <p className="footer-copy">{profile.email}</p>
        </div>
      </footer>
    </>
  )
}
