import type { ProjectRecord } from './types'

export const projects: ProjectRecord[] = [
  {
    slug: 'mcp-security-framework',
    title: 'MCP Security Framework',
    eyebrow: '// automated security scanning for MCP servers',
    status: 'FLAGSHIP',
    featured: true,
    summary:
      'A TypeScript framework that scans MCP servers for security vulnerabilities using 14 detectors across injection, privilege escalation, and data exposure categories.',
    highlights: [
      'Built 14 detectors covering injection, privilege escalation, data exposure, and transport risks.',
      'Scans 60+ community MCP targets; produces structured SARIF output for CI/CD integration.',
    ],
    tags: ['mcp', 'typescript', 'sarif', 'docker', 'devsecops'],
    techStack: ['TypeScript', 'Docker', 'SARIF', 'GitHub Actions'],
    overview: {
      problem:
        'MCP servers expose new attack surfaces — injection via tool descriptions, privilege escalation through server-to-server trust, data exfiltration via oversized responses — with no standardized tooling to detect them.',
      approach:
        'I built a modular TypeScript scanner that spins up MCP servers in Docker-sandboxed environments and runs 14 detectors against their exposed surface. Each detector produces structured SARIF findings that CI/CD pipelines can consume directly.',
      results:
        'The framework scans 60+ community MCP targets with 90%+ detection accuracy across categories. SARIF output integrates directly into GitHub Actions security dashboards.',
    },
    metrics: [
      { label: 'detectors', value: '14' },
      { label: 'scan targets', value: '60+' },
      { label: 'accuracy', value: '90%+' },
      { label: 'output', value: 'SARIF' },
    ],
    links: [
      {
        label: '-> Request project walkthrough',
        href: 'mailto:felixwang1222@gmail.com?subject=MCP%20Security%20Framework',
      },
    ],
  },
  {
    slug: 'ai-enhanced-edr-triage',
    title: 'AI-Enhanced EDR Triage',
    eyebrow: '// LLM-assisted alert triage on Wazuh telemetry',
    status: 'FLAGSHIP',
    summary:
      'A triage system that feeds Wazuh EDR telemetry into an LLM pipeline to classify alerts and surface actionable context for analysts.',
    highlights: [
      'LLM triage pipeline classifies Wazuh alerts with analyst-readable context and severity scoring.',
      'Validated against brute-force, SQL injection, and DDoS attack simulations.',
    ],
    tags: ['edr', 'wazuh', 'llm', 'python', 'react'],
    techStack: ['Python', 'Wazuh', 'React', 'SQLite'],
    overview: {
      problem:
        'EDR platforms generate high alert volumes with limited context — analysts spend most of their time triaging noise instead of investigating real threats.',
      approach:
        'I built a pipeline that pulls Wazuh telemetry, routes alerts through an LLM for classification and context enrichment, and surfaces results in a React analyst console with severity scoring.',
      results:
        'The system was validated against brute-force, SQL injection, and DDoS simulations. Analyst review time dropped significantly — triage decisions are backed by LLM-generated context rather than raw log entries.',
    },
    metrics: [
      { label: 'source', value: 'Wazuh EDR' },
      { label: 'validation', value: 'BF / SQLi / DDoS' },
      { label: 'cache', value: 'SQLite' },
      { label: 'ui', value: 'React analyst console' },
    ],
    links: [
      {
        label: '-> Request project walkthrough',
        href: 'mailto:felixwang1222@gmail.com?subject=AI-Enhanced%20EDR%20Triage',
      },
    ],
  },
  {
    slug: 'internal-pentest',
    title: 'Internal Pentest',
    eyebrow: '// grey-box assessment and remediation guidance',
    status: 'FLAGSHIP',
    summary:
      'A structured internal assessment focused on authentication, session handling, authorization boundaries, and reproducible reporting.',
    highlights: [
      'Grey-box assessment across authentication, sessions, access control, and API behavior.',
      '14 validated findings with reproducible evidence, severity ratings, and remediation guidance.',
    ],
    tags: ['appsec', 'burp-suite', 'idor', 'auth'],
    techStack: ['Burp Suite', 'Manual Testing', 'API Security', 'Session Analysis'],
    overview: {
      problem:
        'Internal systems often fail at the seams between auth, session state, and authorization logic.',
      approach:
        'I performed a grey-box assessment using manual testing and structured evidence capture to validate exploitable paths.',
      results:
        'The assessment produced 14 validated findings with remediation guidance that engineering teams could act on directly.',
    },
    metrics: [
      { label: 'validated', value: '14 findings' },
      { label: 'focus', value: 'Auth / Session / IDOR' },
      { label: 'method', value: 'Grey-box' },
      { label: 'tooling', value: 'Burp Suite' },
    ],
    links: [
      {
        label: '-> Request redacted report details',
        href: 'mailto:felixwang1222@gmail.com?subject=Internal%20Pentest',
      },
    ],
  },
  {
    slug: 'telus-ai-hackathon',
    title: 'TELUS AI Hackathon',
    eyebrow: '// AI-assisted AppSec MVP under hackathon pressure',
    status: 'SELECTED',
    summary:
      'A fast-built AppSec prototype that uses Semgrep output and LLM triage to make findings more actionable for developers.',
    highlights: [
      'Hackathon MVP that reframes SAST findings into clearer developer-facing guidance.',
      'Structured Semgrep input + LLM triage focused on security review acceleration, not demo gimmicks.',
    ],
    tags: ['hackathon', 'semgrep', 'llm', 'appsec'],
    techStack: ['Semgrep', 'TypeScript', 'Structured JSON', 'Prompt Design'],
    overview: {
      problem:
        'Static analysis overwhelms teams when findings arrive without enough context or prioritization.',
      approach:
        'I combined structured Semgrep output with LLM-assisted triage and developer-facing remediation guidance in a fast-moving MVP.',
      results:
        'A strong example of product judgment and AI-assisted AppSec execution under constrained time.',
    },
    metrics: [
      { label: 'format', value: 'Semgrep JSON' },
      { label: 'output', value: 'Developer fix guidance' },
      { label: 'context', value: 'Code-aware triage' },
      { label: 'mode', value: 'Hackathon MVP' },
    ],
    links: [
      {
        label: '-> Request demo notes',
        href: 'mailto:felixwang1222@gmail.com?subject=TELUS%20AI%20Hackathon',
      },
    ],
  },
  {
    slug: 'threat-modelling-viva',
    title: 'Threat Modelling (VIVA)',
    eyebrow: '// STRIDE analysis across system boundaries',
    status: 'SELECTED',
    summary:
      'A complete threat-modeling exercise that maps trust boundaries, prioritizes controls, and drives remediation.',
    highlights: [
      'Mapped trust boundaries and control gaps across the web app, database, server, and network.',
      'Closed 12 identified threats by turning STRIDE analysis into prioritized remediation work.',
    ],
    tags: ['threat-modeling', 'stride', 'cvss', 'architecture'],
    techStack: ['STRIDE', 'CVSS', 'Data Flow Mapping', 'Control Analysis'],
    overview: {
      problem:
        'Complex systems fail when trust boundaries are implicit and control gaps stay invisible too long.',
      approach:
        'I modeled the system with STRIDE, mapped flows and trust boundaries, and prioritized mitigation work using CVSS-backed severity.',
      results:
        'The work closed 12 identified threats and demonstrates systems-level security judgment beyond point-in-time testing.',
    },
    metrics: [
      { label: 'model', value: 'STRIDE' },
      { label: 'remediated', value: '12 threats' },
      { label: 'scope', value: 'App / DB / Server / Network' },
      { label: 'severity', value: 'CVSS mapped' },
    ],
    links: [
      {
        label: '-> Request threat-model summary',
        href: 'mailto:felixwang1222@gmail.com?subject=Threat%20Modelling%20(VIVA)',
      },
    ],
  },
]

export const projectSlugs = projects.map((p) => p.slug)
export const projectLookup = new Map(projects.map((p) => [p.slug, p]))
