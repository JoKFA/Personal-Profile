import type { ProjectRecord } from './types'

export const projects: ProjectRecord[] = [
  {
    slug: 'mcp-security-framework',
    title: 'MCP Security Framework',
    eyebrow: '// securing the boundary between LLMs and tools',
    status: 'FLAGSHIP',
    featured: true,
    summary:
      'A Python security assessment framework that discovers arbitrary MCP servers, launches them in isolated Docker sandboxes, normalizes stdio/SSE transports, and runs 14 detectors for MCP-specific risks.',
    highlights: [
      'Designed AMSAW v2: automatic MCP sandboxing and wrapping for GitHub repos, npm packages, local folders, and live URLs.',
      'Built a detector engine for injection, data exposure, access control, tool poisoning, shadowing, and behavior-change risks.',
    ],
    tags: ['mcp', 'python', 'docker', 'ai-security', 'security-research'],
    techStack: ['Python', 'Docker', 'MCP', 'SARIF', 'JSON', 'SSE / stdio'],
    overview: {
      problem:
        'MCP servers sit between LLMs and real systems: files, APIs, databases, internal tools, and third-party services. A misconfigured server can leak credentials, expose arbitrary files, trust poisoned tool descriptions, or give agents more authority than developers intended. The ecosystem has strong research on attack patterns, but developers still need practical tooling that can test their own servers before deployment.',
      approach:
        'I built MCPSF as a five-phase assessment pipeline: discover the MCP server, provision it inside Docker, normalize stdio and SSE through a Universal Bridge, run detectors through a SafeAdapter, then emit evidence-rich reports. The important engineering work is AMSAW v2: automatic sandboxing and wrapping so users can point the tool at a repo, package, local folder, or URL without hand-writing Docker commands or transport adapters.',
      results:
        'The framework was evaluated against Damn Vulnerable MCP challenges and 20+ open-source MCP servers. It reproduced designed exploit classes, surfaced realistic risks such as broad filesystem access and credential leakage, and produced JSON, SARIF, CLI, audit, and metadata reports with standards mapping for developer review.',
    },
    caseSections: [
      {
        eyebrow: '01 / threat model',
        title: 'MCP creates a new security boundary',
        body:
          'The project starts from a simple security observation: once an LLM can call tools, the MCP server becomes the enforcement point between untrusted instructions and sensitive systems. Traditional web scanners do not understand MCP resources, prompts, tool descriptions, or stdio/SSE transport behavior, so the framework needed MCP-native discovery, execution, and evidence collection.',
        points: [
          'Covered injection, data exposure, access control, enumeration, and tool-level abuse classes.',
          'Mapped findings to CWE, OWASP LLM/API categories, and CVSS so results are explainable to security and engineering audiences.',
        ],
      },
      {
        eyebrow: '02 / AMSAW v2',
        title: 'Automatic sandboxing was a first-class feature',
        body:
          'AMSAW v2 is the part I want the project to be remembered for. Instead of asking users to configure every target by hand, it tries to infer the source type, language, transport, entry point, dependencies, host, and port, then launches the server in an isolated Docker runtime. That turns messy real-world MCP projects into something the detector engine can safely test.',
        points: [
          'Accepts GitHub repositories, npm packages, local directories, remote URLs, and already-running endpoints.',
          'Uses Docker isolation, dependency installation, CLI auto-detection, crash recovery, targeted retries, and cleanup.',
          'Handles Python and Node MCP servers across stdio and SSE without making detector authors care about transport details.',
        ],
      },
      {
        eyebrow: '03 / assessment engine',
        title: 'Detectors run behind safety guardrails',
        body:
          'The detector engine is modular, but the detectors do not talk to targets directly. A SafeAdapter sits between probes and the MCP server to enforce request budgets, rate limits, timeouts, scope controls, and evidence redaction. That made active security testing more responsible while still allowing meaningful probes against resources, tools, prompts, and configuration surfaces.',
        points: [
          'Implemented 14 detectors including prompt injection, indirect injection, command/code execution, credential exposure, insecure storage, unauthenticated access, excessive permissions, privilege abuse, tool poisoning, tool shadowing, rug-pull behavior, and enumeration.',
          'Each detector returns status, confidence, signals, evidence, remediation context, and standards mapping.',
        ],
      },
      {
        eyebrow: '04 / validation',
        title: 'Validated on vulnerable labs and real servers',
        body:
          'I validated the framework against Damn Vulnerable MCP challenges and a set of real-world open-source MCP servers. The vulnerable targets proved the framework could reproduce known exploit classes; the real servers showed where broad permissions, file access, metadata exposure, and tool-description risks appear in normal utility servers.',
        points: [
          'Produced repeatable assessments with typical runtimes in the 30-90 second range per target.',
          'Generated JSON, SARIF, CLI summaries, audit logs, and metadata for both manual review and automation workflows.',
        ],
      },
      {
        eyebrow: '05 / engineering lessons',
        title: 'The hard part was making automation survive real projects',
        body:
          'The main lesson was that automatic discovery is fragile in the wild. MCP servers live in monorepos, use custom launch commands, bind to localhost, require native dependencies, and expose different transports. The framework handles this with AST analysis, provisioning heuristics, fat Docker images, transport normalization, failure reporting, and cleanup paths instead of assuming every project is tidy.',
      },
    ],
    metrics: [
      { label: 'detectors', value: '14' },
      { label: 'pipeline', value: '5 phases' },
      { label: 'targets', value: 'DV-MCP + 20+' },
      { label: 'runtime', value: '30-90s' },
    ],
    links: [
      {
        label: '-> View GitHub repository',
        href: 'https://github.com/JoKFA/MCP-Security-Framework',
      },
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
