export interface ContactPayload {
  name: string
  email: string
  message: string
  company?: string
  honeypot?: string
}

export interface MetricRecord {
  label: string
  value: string
}

export interface ProjectLink {
  label: string
  href: string
}

export interface ProjectCaseSection {
  eyebrow: string
  title: string
  body: string
  points?: string[]
}

export interface ProjectRecord {
  slug: string
  title: string
  eyebrow: string
  status: string
  summary: string
  highlights: string[]
  tags: string[]
  techStack: string[]
  featured?: boolean
  overview: {
    problem: string
    approach: string
    results: string
  }
  caseSections?: ProjectCaseSection[]
  metrics: MetricRecord[]
  links: ProjectLink[]
}

export interface ExperienceRecord {
  title: string
  organization: string
  location: string
  period: string
  bullet: string
}
