import type { ProjectRecord } from '../data/types'

export function ProjectCard({ project }: { project: ProjectRecord }) {
  return (
    <a
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
          {project.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
        <div className="tags-row">
          {project.tags.map((tag) => (
            <span key={tag} className="tag" aria-hidden="true">{tag}</span>
          ))}
        </div>
      </article>
    </a>
  )
}
