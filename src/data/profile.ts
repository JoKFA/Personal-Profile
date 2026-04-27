import type { ExperienceRecord } from './types'

export const profile = {
  name: 'Yaoting Wang',
  location: 'Vancouver, BC',
  email: 'felixwang1222@gmail.com',
  githubUrl: 'https://github.com/JoKFA',
  linkedinUrl: 'https://www.linkedin.com/in/yaoting-wang/',
  resumePath: '/resume.pdf',
  positioning:
    'MASc cybersecurity student building practical security controls for AI systems, cloud workflows, and security operations. I turn security ideas into working projects: sandboxed AI tooling, DevSecOps automation, threat analysis, operational controls, and clear risk communication.',
}

export const experienceSnapshot: ExperienceRecord[] = [
  {
    title: 'Cybersecurity & DevSecOps Engineer Intern',
    organization: 'VibesMeet LLC',
    location: 'Remote, USA',
    period: 'Feb 2025 – Jul 2025',
    bullet:
      'Integrated Trivy, GitGuardian, and Terraform scanning into GitHub Actions across 10+ pull requests before merge.',
  },
  {
    title: 'Cybersecurity Analyst Intern',
    organization: 'BCIT Cyber Security Office',
    location: 'Burnaby, BC',
    period: 'May 2024 – Aug 2024',
    bullet:
      'Delivered phishing awareness training to 1,000+ staff, contributing to a 15% drop in reported incidents the next quarter.',
  },
  {
    title: 'Freelance IT & Security Coordinator',
    organization: 'Vancouver Intl. Volunteer Assoc.',
    location: 'Vancouver, BC',
    period: 'Oct 2024 – Present',
    bullet:
      'Sole IT contact for 500+ staff and volunteers across Microsoft 365, email, databases, and device access.',
  },
]

export const socialLinks = [
  { label: 'Email', href: `mailto:${profile.email}` },
  { label: 'LinkedIn', href: profile.linkedinUrl },
  { label: 'GitHub', href: profile.githubUrl },
]
