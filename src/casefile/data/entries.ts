// Every drive in the archive. Facts from the resume fact database (experience_db.yaml, projects/*.tex) and
// the user's confirmations logged in docs/casefile-spec.md §5.4 / §13. Numbers only where a
// source states them. To add a project: append an Entry with a free slot (data.test.ts checks).
import type { Entry } from './types'
import { EDUCATION_ENTRIES } from './education.ts'
import { CAPABILITIES } from './capabilities.ts'   // explicit extension: the build scripts load this file in Node

const MAIL = 'felixwang1222@gmail.com'
const ask = (subject: string) => ({ label: 'Walkthrough on request', href: `mailto:${MAIL}?subject=${encodeURIComponent(subject)}` })

export const SUBJECT: Entry = {
  id: 'YW-000', slug: 'profile', kind: 'subject', title: 'Yaoting Wang', kicker: 'Security Analyst & Engineer · Risk, Cloud & AI Security',
  summary: 'Master of Cybersecurity at SFU. Security work across AI systems, cloud pipelines, detection, risk and networks, with the evidence kept.',
  roles: 'all', slot: { lane: 0, row: 12 },
  // availability and targets: resume system (能力画像 · OBJECTIVE.md, 2026-09-24)
  facts: [['Available', 'Full-time from Feb 2027'], ['Looking for', 'Security Analyst · GRC · Cloud & AI Security'], ['Now', 'Information Security co-op, Coast Capital'], ['Based', 'Vancouver, BC · open to relocating in Canada']],
  demo: 'waysin', demoNote: ['Six ways in · each shield is a real piece of work', 'Select one to open its file'],
  numbers: [['50+', 'security assessments'], ['20+', 'vendor risk reviews'], ['60+', 'MCP servers tested'], ['14', 'pentest findings'], ['1,000+', 'people trained'], ['~30%', 'AWS cost cut']],
  seo: { title: 'Yaoting Wang | Security Portfolio', description: 'Security analyst and engineer, Master of Cybersecurity at SFU: risk assessment at a Canadian financial institution, cloud and DevSecOps, detection, and AI security, with the evidence for each.' },
}

export const CASES: Entry[] = [
  {
    id: 'X-001', slug: 'mcp-security-framework', kind: 'case', title: 'MCP Security Framework',
    kicker: 'Case file · AI security', year: '2025',
    summary: 'Sandboxes any MCP server in Docker and runs 14 detectors before an AI agent is allowed near it.',
    roles: ['ai', 'cloud'], slot: { lane: 1, row: 12 },
    facts: [['My role', 'Designer and builder'], ['Tested', '60+ real MCP servers'], ['Output', 'HTML · TXT · SARIF for GitHub'], ['Evidence', 'JSON / JSONL logs']],
    numbers: [['14', 'detectors'], ['60+', 'servers tested'], ['5', 'pipeline phases'], ['30–90 s', 'per target']],
    stack: ['Python', 'Docker', 'MCP', 'SARIF', 'JSONL', 'stdio / SSE'],
    sections: [
      { eyebrow: '01 · Threat model', title: 'MCP is a new security boundary', body: 'Once an LLM can call tools, the MCP server becomes the enforcement point between untrusted instructions and real systems. Web scanners do not understand MCP resources, prompts, tool descriptions or stdio/SSE transports, so the framework speaks MCP natively.', points: ['Covers injection, data exposure, access control, enumeration and tool-level abuse.', 'Maps every finding to CWE, OWASP LLM / API Top 10 and CVSS.'] },
      { eyebrow: '02 · Sandbox', title: 'Point it at anything; it builds the sandbox', body: 'The sandboxing stage (AMSAW) infers source type, language, transport, entry point and dependencies, then launches the server in an isolated Docker runtime. GitHub repos, npm packages, local folders and live URLs all work without hand-written Docker commands.', note: 'The part I want remembered.' },
      { eyebrow: '03 · Guardrails', title: 'Offence, with a leash', body: 'Detectors never touch a target directly. A SafeAdapter enforces request budgets, rate limits, timeouts, scope and evidence redaction, so active testing stays controlled even inside a CI pipeline.', points: ['Prompt and indirect injection, code execution, credential exposure, excessive permissions, tool poisoning, shadowing, rug-pull, enumeration.', 'Each detector returns status, confidence, evidence, remediation and standards mapping.'] },
    ],
    findings: [
      { severity: 'high', label: 'DV-MCP 1', title: 'Credential exposure', detail: 'read_resource → internal://credentials · secrets redacted in evidence' },
      { severity: 'critical', label: 'DV-MCP 8', title: 'Code execution', detail: 'generate_code_example ran without a sandbox' },
      { severity: 'critical', label: 'Real server', title: 'Excessive permissions', detail: 'delete_range with unrestricted filesystem paths' },
    ],
    demo: 'mcpsf', demoNote: ['Replay · Damn Vulnerable MCP, challenge 1', 'Evidence redacted by SafeAdapter'],
    link: { label: 'Source · GitHub', href: 'https://github.com/JoKFA/MCP-Security-Framework' },
    related: ['X-004', 'X-000'],
    seo: { title: 'Yaoting Wang | MCP Security Framework', description: 'A Docker-sandboxed security scanner for MCP servers: 14 detectors mapped to CWE, OWASP and CVSS, tested against 60+ real servers.' },
  },
  {
    id: 'X-004', slug: 'telus-ai-hackathon', kind: 'case', title: 'TELUS AI Hackathon',
    kicker: 'Case file · AI-assisted AppSec', year: '2026',
    summary: 'An AI reviewer that reads each static-analysis finding, decides whether it is real, and proposes a fix that will not break the code.',
    roles: ['ai', 'cloud'], slot: { lane: 1, row: 15 },
    facts: [['My role', 'Builder'], ['Input', 'Semgrep JSON + code context'], ['Output', 'Verdict · reason · safe fix'], ['Guardrail', 'A human approves every fix']],
    stack: ['Semgrep', 'LLM', 'TypeScript', 'Secure SDLC'],
    sections: [
      { eyebrow: '01 · Problem', title: 'Scanners flag; nobody has time to judge', body: 'SAST tools produce long lists without priority or context. Developers either ignore them or lose hours separating real issues from noise.' },
      { eyebrow: '02 · Approach', title: 'Triage first, then a fix that fits', body: 'Each Semgrep finding is sent to an LLM with the surrounding code. The model returns a verdict (valid or false positive) with its reasoning, then a remediation that keeps the function’s behaviour, so the fix does not introduce a new bug.', points: ['False positives are dismissed with a stated reason, not silently dropped.', 'Vulnerable code and the proposed fix sit side by side for review.'] },
      { eyebrow: '03 · Guardrail', title: 'The model advises; a person merges', body: 'Nothing is applied automatically. The design keeps a human approval step inside the secure-SDLC workflow, which is where AI help belongs in code review.' },
    ],
    demo: 'telus', demoNote: ['Sample findings · replays automatically', 'Hackathon prototype'],
    link: ask('TELUS AI Hackathon'), related: ['X-001'],
    seo: { title: 'Yaoting Wang | TELUS AI Hackathon', description: 'AI-assisted AppSec: an LLM triages Semgrep findings as valid or false positive and proposes safe fixes for human approval.' },
  },
  {
    id: 'X-007', slug: 'distributed-password-manager', kind: 'case', title: 'Distributed Password Manager',
    kicker: 'Case file · cloud systems · CMPT 756', year: '2025',
    summary: 'A GFS-style password vault on GCP that keeps serving reads when a replica dies, and replays what it missed when it returns.',
    roles: ['cloud', 'it'], slot: { lane: 2, row: 12 },
    facts: [['Context', 'SFU CMPT 756 · coursework'], ['Deploy', 'GCP · 1 master + 3 chunk servers across zones'], ['Transport', 'Go · TLS 1.3'], ['Recovery', 'WAL replay']],
    numbers: [['741.9 ms', 'avg read'], ['1,168.7 ms', 'avg write'], ['46.7 s', 'replica recovery'], ['5 / 5', 'reads + writes with a replica down']],
    stack: ['Go', 'GCP', 'TLS 1.3', 'React', 'CLI'],
    sections: [
      { eyebrow: '01 · Design', title: 'Metadata apart from data', body: 'A master issues sequence numbers and coordinates; chunk servers hold replicated vault data. Primary replication keeps writes ordered across replicas.' },
      { eyebrow: '02 · Failure', title: 'Route around the dead, catch up the returning', body: 'Heartbeats with a 6-second timeout route reads away from failed replicas. A restarted replica replays the operations it missed from the master’s write-ahead log.', note: 'Known limit: no leader election, so a primary failure blocks writes.' },
    ],
    demo: 'timeline', link: ask('Distributed Password Manager'),
    seo: { title: 'Yaoting Wang | Distributed Password Manager', description: 'GFS-style distributed password manager on GCP: Go, TLS 1.3, ordered replication, heartbeat failover and WAL recovery.' },
  },
  {
    id: 'X-002', slug: 'ai-enhanced-edr-triage', kind: 'case', title: 'SecureInsight · EDR + AI',
    kicker: 'Case file · detection', year: '2024', era: 'Built in 2024: an early experiment in putting an LLM inside the triage loop.',
    summary: 'Turns raw Wazuh EDR events into analyst-ready triage summaries, cached so repeated alerts cost nothing.',
    roles: ['soc', 'ai'], slot: { lane: 3, row: 12 },
    facts: [['My role', 'Builder'], ['Source', 'Wazuh EDR'], ['Validated with', 'Brute force · SQLi · DDoS'], ['Noise', 'Repeats suppressed from feedback']],
    stack: ['Python', 'Wazuh', 'LLM', 'SQLite', 'React', 'REST'],
    sections: [
      { eyebrow: '01 · Problem', title: 'Analysts drown in raw alerts', body: 'EDR produces high volumes with little context. Most analyst time goes to triaging noise instead of investigating.' },
      { eyebrow: '02 · Approach', title: 'The model writes the context; the analyst decides', body: 'A Python pipeline normalises Wazuh events and asks an LLM for a summary, suspected cause and next step. Repeated alert patterns resolve from a SQLite cache; user feedback suppresses known-benign repeats with a stated reason.', points: ['React dashboard follows the triage flow: what happened, why it matters, what to do next.', 'Validated with scripted brute-force, SQL-injection and DDoS simulations.'] },
    ],
    demo: 'edr', demoNote: ['Simulated replay · sample alerts', '2024'],
    link: ask('SecureInsight'), related: ['X-006'],
    seo: { title: 'Yaoting Wang | SecureInsight, EDR + AI', description: 'LLM-assisted triage on Wazuh EDR telemetry (2024): analyst summaries, SQLite cache, React dashboard, validated with attack simulations.' },
  },
  {
    id: 'X-003', slug: 'internal-pentest', kind: 'case', title: 'Internal Penetration Test',
    kicker: 'Case file · AppSec · grey-box', year: '2025',
    summary: 'A grey-box test of a staging web app and its APIs: 14 validated findings, each with reproduction steps and a fix.',
    roles: ['soc', 'grc'], slot: { lane: 3, row: 15 },
    facts: [['My role', 'Tester and report author'], ['Scope', 'Staging web app + APIs'], ['Surfaces', 'Auth · sessions · files · tenant access'], ['Tooling', 'Burp Suite, manual testing']],
    numbers: [['14', 'validated findings'], ['4', 'surfaces tested']],
    stack: ['Burp Suite', 'API security', 'Session analysis'],
    sections: [
      { eyebrow: '01 · Scope', title: 'Where systems fail: the seams', body: 'The test focused on the joins between authentication, session state and authorisation logic, including tenant boundaries and file handling.' },
      { eyebrow: '02 · Method', title: 'Prove it, then write the fix', body: 'Every issue was captured with request/response pairs, impact and a remediation an engineer could apply. Working controls were verified too, so the report says what held as well as what broke.' },
    ],
    findings: [
      { severity: 'critical', label: 'IDOR', title: 'Other users’ records by ID', detail: 'Sequential IDs returned another user’s record; no ownership check on the object.' },
      { severity: 'critical', label: 'Broken authz', title: 'Admin export without a role check', detail: 'A staff session could call the admin export endpoint directly.' },
      { severity: 'high', label: 'Session', title: 'Token still accepted after logout', detail: 'Logout did not revoke the session token; replay worked.' },
    ],
    demo: 'pentest', demoNote: ['Sample target modelled on the real findings', 'Client name withheld'],
    link: ask('Internal Pentest (redacted report)'),
    seo: { title: 'Yaoting Wang | Internal Penetration Test', description: 'Grey-box penetration test of a staging web app and APIs: 14 validated findings including IDOR, missing role checks and session replay.' },
  },
  {
    id: 'X-006', slug: 'splunk-soc-lab', kind: 'case', title: 'Splunk SOC Detection Lab',
    kicker: 'Case file · detection engineering · home lab', year: '2023',
    summary: 'Attack scenarios turned into SPL detections over Windows, Sysmon and firewall logs, with a triage runbook for each.',
    roles: ['soc'], slot: { lane: 3, row: 9 },
    facts: [['Context', 'Home lab'], ['Data', 'Windows Event Logs · Sysmon · firewall'], ['Detections', 'Brute force · privilege escalation · lateral movement'], ['Mapping', 'MITRE ATT&CK']],
    stack: ['Splunk', 'SPL', 'Sysmon', 'MITRE ATT&CK'],
    sections: [
      { eyebrow: '01 · Build', title: 'From scenario to detection', body: 'Each scenario became an SPL search, then a correlation rule with a tuned threshold. Coverage was mapped to ATT&CK techniques and checked against simulated attacks.' },
      { eyebrow: '02 · Operate', title: 'Repeatable triage', body: 'Every detection has a runbook: first checks, evidence to collect, and when to escalate.' },
    ],
    demo: 'timeline', link: ask('Splunk SOC Detection Lab'), related: ['X-002'],
    seo: { title: 'Yaoting Wang | Splunk SOC Detection Lab', description: 'Splunk home lab: SPL detections for brute force, privilege escalation and lateral movement, mapped to MITRE ATT&CK with triage runbooks.' },
  },
  {
    id: 'X-005', slug: 'threat-modelling-viva', kind: 'case', title: 'Threat Modelling · VIVA',
    kicker: 'Case file · risk · architecture', year: '2025',
    summary: 'STRIDE across a non-profit’s web app, database, server and network: 12 threats found, rated, and remediated.',
    roles: ['grc'], slot: { lane: 4, row: 12 },
    facts: [['My role', 'Assessor and remediator'], ['Method', 'STRIDE · CVSS'], ['Scope', 'App · database · server · network'], ['Result', '12 / 12 remediated']],
    numbers: [['12', 'threats identified'], ['12', 'remediated']],
    stack: ['STRIDE', 'CVSS', 'Data-flow mapping'],
    sections: [
      { eyebrow: '01 · Model', title: 'Make trust boundaries explicit', body: 'The system was drawn as data flows across trust boundaries first, then analysed with STRIDE element by element.' },
      { eyebrow: '02 · Result', title: 'From threats to closed work', body: 'Each threat was scored, prioritised and fixed; a leadership-facing report explains the risks and the controls in plain language.' },
    ],
    demo: 'viva', demoNote: ['Sample threats · the real register is internal', '12 / 12 remediated'],
    link: ask('Threat Modelling summary'), related: ['SR-04'],
    seo: { title: 'Yaoting Wang | Threat Modelling (VIVA)', description: 'STRIDE threat model of a non-profit IT system: 12 threats identified, CVSS-rated and remediated, with a leadership report.' },
  },
  {
    id: 'X-008', slug: 'enterprise-campus-network', kind: 'case', title: 'Enterprise Campus Network',
    kicker: 'Case file · network & security · capstone', year: '2022',
    summary: 'Six of us joined four separate sites into one network over MPLS. I configured the routers, switches, firewalls and VPN tunnels, and the segmentation that keeps one bad machine from reaching the rest.',
    roles: ['it', 'soc'], slot: { lane: 5, row: 12 },
    facts: [['My role', 'One of six; routers, switches, firewalls and VPN tunnels'], ['Sites', '4, joined over an MPLS L3VPN'], ['Security', 'Segmentation and access rules'], ['Monitoring', 'Splunk · FortiSIEM']],
    stack: ['MPLS L3VPN', 'VLAN', 'OSPF', 'ACL', 'PAT', 'DNS / DHCP', 'Firewalls', 'Splunk', 'FortiSIEM'],
    sections: [
      { eyebrow: '01 · Build', title: 'Four sites, one network', body: 'As a six-person team we designed and deployed an MPLS L3VPN joining four separate sites. I configured the routers, switches, next-generation firewalls and VPN tunnels, with VLANs, OSPF, ACLs, PAT, DNS and DHCP underneath.' },
      { eyebrow: '02 · Contain', title: 'One bad machine stays one', body: 'We defined segmentation and access rules so that a compromised machine in one zone cannot reach the rest, while staff keep working across all four sites. Limiting the blast radius without stopping operations was the point of the design.' },
      { eyebrow: '03 · Hand over', title: 'Logged, drawn, handed over', body: 'Network and security logs flowed into Splunk and FortiSIEM in one place, and we left network diagrams and documentation for whoever would run it next.' },
    ],
    demo: 'network', demoNote: ['Lab replay · zones and hosts illustrative', 'Built in a virtual lab, 2022'],
    link: ask('Enterprise Campus Network'),
    seo: { title: 'Yaoting Wang | Enterprise Campus Network', description: 'A four-site MPLS L3VPN network built by a team of six: routers, switches, firewalls and VPN tunnels, segmentation that limits the blast radius, and logs in Splunk and FortiSIEM.' },
  },
  {
    id: 'X-009', slug: 'pwnscan', kind: 'case', title: 'PwnScan',
    kicker: 'Case file · IoT exposure · SFU CMPT 783', year: '2026', era: 'Top 3 project, SFU Master of Cybersecurity (CMPT 783), 2026.',
    summary: 'Finds every device on a network without agents, fingerprints the IoT ones, and ranks their CVEs by how likely they are to be exploited.',
    roles: ['it', 'soc'], slot: { lane: 5, row: 15 },
    facts: [['Team', 'Three; I built discovery, fingerprinting and risk scoring'], ['Discovery', 'ARP · mDNS · SSDP'], ['Risk', 'CVSS × EPSS × exposure'], ['Recognition', 'Top 3, CMPT 783']],
    stack: ['Python', 'FastAPI', 'Celery', 'nmap', 'NVD', 'EPSS', 'PostgreSQL'],
    sections: [
      { eyebrow: '01 · Discover', title: 'Three methods, one inventory', body: 'ARP, mDNS and SSDP each see devices the others miss. A host agent runs discovery on the LAN and seeds results back to the API; a two-pass port scan then enumerates and version-probes only what is open.' },
      { eyebrow: '02 · Rank', title: 'Severity is not risk', body: 'IoT devices are matched to NVD CVEs, then ranked by CVSS × EPSS × exposure. A critical CVE nobody exploits drops below a moderate one being exploited in the wild on an exposed camera.', note: 'Team of three. I built the discovery engine, port scanning and IoT fingerprinting, the host agent, and the CVE × EPSS risk scoring.' },
    ],
    demo: 'pwnscan', demoNote: ['Lab targets · simulated IoT devices', 'Repository private (coursework)'],
    link: ask('PwnScan'), related: ['X-008'],
    seo: { title: 'Yaoting Wang | PwnScan', description: 'Agentless IoT discovery and CVE risk ranking (CVSS × EPSS × exposure). Top 3 project, SFU Master of Cybersecurity, CMPT 783.' },
  },
]

export const SERVICE: Entry[] = [
  {
    id: 'SR-01', slug: 'coast-capital', kind: 'service', title: 'Information Security Co-op', org: 'Coast Capital Savings',
    dates: 'Jun 2026 – Feb 2027', place: 'Hybrid, Canada', kicker: 'Service record · financial services',
    summary: 'Security risk assessments for internal projects and third-party vendors at a Canadian credit union.',
    roles: ['grc', 'cloud'], slot: { lane: 4, row: 15 },
    facts: [['Internal assessments', '50+ projects'], ['Vendor reviews', '20+ vendors'], ['Evidence reviewed', 'ISO 27001 · SOC 2 Type II · PCI · pentest reports'], ['Platform', 'Archer']],
    numbers: [['50+', 'internal assessments'], ['20+', 'vendors reviewed']],
    sections: [{ eyebrow: 'What I do', title: 'Decision-ready risk', body: 'I research each change, threat-model it, and document a risk rating with a treatment recommendation: accept, mitigate, transfer or avoid.', points: ['Assessed 50+ internal security projects with threat modelling and documented risk treatment.', 'Reviewed 20+ vendors against ISO 27001, SOC 2 Type II, PCI and pentest evidence, plus OSINT and external ratings.', 'Kept audit-ready Archer records; updated internal security policies, procedures and awareness material.'] }],
    stack: ['Risk assessment', 'Threat modelling', 'Third-party risk', 'ISO 27001', 'SOC 2', 'Archer'],
    demo: 'coast', demoNote: ['Sample vendor · real assessments are confidential', '50+ assessments · 20+ vendors'],
    related: ['X-005'],
    seo: { title: 'Yaoting Wang | Coast Capital · Information Security', description: 'Information security co-op: 50+ internal security risk assessments and 20+ vendor risk reviews against ISO 27001, SOC 2 and PCI evidence.' },
  },
  {
    id: 'SR-02', slug: 'vibesmeet', kind: 'service', title: 'Cybersecurity & DevSecOps Intern', org: 'VibesMeet LLC',
    dates: 'Feb 2025 – Jul 2025', place: 'Remote, USA', kicker: 'Service record · startup cloud',
    summary: 'Put security checks into a startup’s CI pipeline, tightened its AWS access, and cut its monthly AWS bill by about 30%.',
    roles: ['cloud', 'ai'], slot: { lane: 2, row: 15 },
    facts: [['CI security', 'Trivy · GitGuardian · Semgrep in GitHub Actions'], ['Cloud', 'AWS Security Hub · IAM least privilege'], ['Cost', '~30% lower monthly AWS spend'], ['Access', 'Joiner / leaver IAM process']],
    numbers: [['~30%', 'monthly AWS cost'], ['10+', 'PRs gated (approx.)']],
    sections: [{ eyebrow: 'What I did', title: 'Security that ships with the code', body: 'Checks ran on every pull request before merge, tuned so false positives did not stall the team.', points: ['Set up AWS Security Hub to centralise findings.', 'Integrated Trivy, GitGuardian and Semgrep into GitHub Actions and tuned false-positive handling.', 'Reviewed IAM, removed excess access, and helped build onboarding/offboarding for email, MFA and permissions.', 'Evaluated VPCs, images and services for cheaper equivalents: ~30% lower monthly AWS cost.'] }],
    stack: ['GitHub Actions', 'Trivy', 'GitGuardian', 'Semgrep', 'AWS Security Hub', 'IAM'],
    demo: 'vibes', demoNote: ['Sample pipeline run', 'Feb – Jul 2025'],
    related: ['X-001'],
    seo: { title: 'Yaoting Wang | VibesMeet · DevSecOps', description: 'DevSecOps internship: CI security gates, AWS Security Hub, IAM least privilege and ~30% lower monthly AWS cost.' },
  },
  {
    id: 'SR-03', slug: 'bcit-cyber-security-office', kind: 'service', title: 'Cybersecurity Analyst Intern', org: 'BCIT Cyber Security Office',
    dates: 'May 2024 – Aug 2024', place: 'Burnaby, BC', kicker: 'Service record · higher education',
    summary: 'Built BCIT’s security awareness programme from scratch, validated 20+ policies against NIST and ISO, and wrote the IR playbooks.',
    roles: ['grc', 'soc'], slot: { lane: 4, row: 9 },
    facts: [['Awareness', '1,000+ staff and students'], ['Phishing', '~15% fewer successful attempts in later simulations'], ['Policy', '20+ policies and standards validated'], ['IR', '4 playbooks + investigation lab']],
    numbers: [['1,000+', 'people trained'], ['~15%', 'fewer phishing successes'], ['20+', 'policies validated'], ['4', 'IR playbooks']],
    sections: [{ eyebrow: 'What I did', title: 'People, policy, response', body: 'Three kinds of security work at one institution.', points: ['Designed the awareness programme: topics, quizzes and materials on phishing and remote-work security.', 'Validated 20+ policies and standards against NIST CSF, ISO 27001 and institutional standards; checked cross-references stayed consistent.', 'Wrote 4 incident-response playbooks and deployed a virtual investigation environment.'] }],
    stack: ['NIST CSF', 'ISO 27001', 'Incident response', 'Security awareness'],
    demo: 'bcit', demoNote: ['Sample rows · figures from the programme', 'May – Aug 2024'],
    seo: { title: 'Yaoting Wang | BCIT Cyber Security Office', description: 'Security awareness for 1,000+ people, 20+ policies validated against NIST CSF and ISO 27001, and 4 incident-response playbooks.' },
  },
  {
    id: 'SR-04', slug: 'viva-it', kind: 'service', title: 'IT & Security Coordinator', org: 'Vancouver International Volunteer Association',
    dates: 'Oct 2024 – Present', place: 'Vancouver, BC', kicker: 'Service record · non-profit · freelance',
    summary: 'The only IT person for 500+ staff and volunteers: accounts, devices, websites, domains and certificates.',
    roles: ['it', 'grc'], slot: { lane: 5, row: 9 },
    facts: [['Scope', 'Sole IT contact, 500+ people'], ['Platforms', 'Microsoft 365 · databases · devices'], ['Web', 'Sites with admin CMS · DNS · SSL'], ['Services', '3+ public services kept renewed']],
    numbers: [['500+', 'people supported'], ['3+', 'public services']],
    sections: [{ eyebrow: 'What I do', title: 'Everything IT, done safely', body: 'A small organisation with no IT department, run with the habits of a security team.', points: ['Resolve Microsoft 365, access, device, printer, database and document issues.', 'Built the association’s websites (React/TypeScript, admin CMS); manage DNS, SSL and domain renewals.', 'Apply access controls and backups to member databases; standardise folders and permissions.'] }],
    stack: ['Microsoft 365', 'DNS', 'SSL', 'React', 'TypeScript', 'Access control'],
    demo: 'vivaops', demoNote: ['Sample status board', 'Oct 2024 – present'],
    related: ['X-005'],
    seo: { title: 'Yaoting Wang | VIVA · IT & Security', description: 'Sole IT and security contact for 500+ staff and volunteers: Microsoft 365, access control, websites, DNS and SSL.' },
  },
]

export const RESTRICTED: Entry = {
  id: 'X-000', slug: 'restricted', kind: 'restricted', title: 'SENTINEL-1', kicker: 'Restricted · AI-guarded',
  summary: 'An LLM guard holds this file’s key. Talk your way past it: a live prompt-injection lab.',
  roles: ['ai'], slot: { lane: 1, row: 12 },
  facts: [['Guard', 'SENTINEL-1 · LLM'], ['Your attempts', 'Rate-limited'], ['Key', 'Stays server-side'], ['Lesson', 'Never trust a model with a secret']],
  sections: [
    { eyebrow: '01 · What broke', title: 'Guard training vs. helpfulness training', body: 'The guard refuses extraction, overrides and encoding tricks. Inside fiction or a “security demonstration”, producing the secret looks like helping, not leaking.' },
    { eyebrow: '02 · How I would ship it', title: 'Keep the secret out of the model', body: 'The fix is architectural, not a better prompt.', points: ['The model never sees the secret.', 'Filter output for secret patterns and canary tokens.', 'A separate policy classifier on input and output.', 'Rate-limit and log every attempt; the logs are the detection dataset.'] },
  ],
  demo: 'sentinel', related: ['X-001'],
  seo: { title: 'Yaoting Wang | SENTINEL-1 Prompt-Injection Lab', description: 'A live prompt-injection lab: an LLM guard holds a secret; try to talk your way past it.' },
}

export const VISITOR: Entry = {
  id: 'V-FILE', slug: 'visitor', kind: 'visitor', title: 'Visitor File', kicker: 'You · filed just now',
  summary: 'What your browser told this page in the first few milliseconds, and why it matters.',
  roles: 'all', slot: { lane: 0, row: 12 },
  facts: [], demo: 'visitor',
}

// the degree is "Master of Cybersecurity" (SFU transcript and Graduate Calendar), not an MASc
export const EDUCATION: [string, string, string][] = EDUCATION_ENTRIES.map((e) => [e.title, e.org!, e.dates!])
export const CERTIFICATIONS = ['Cisco CCNA', 'CompTIA Security+', 'Fortinet NSE 4', 'Palo Alto EDU-120', 'Google Cybersecurity', 'CISA (in progress)']
export const CONTACT = { email: MAIL, linkedin: 'https://www.linkedin.com/in/yaoting-wang/', github: 'https://github.com/JoKFA' }

// Skills and credentials become small drives that point at the files proving them, so every
// drawer is populated and each skill is one click from its evidence.
export const SKILLS: Entry[] = CAPABILITIES.flatMap((c, ci) => c.skills.map(([name, evidence], k): Entry => ({
  id: `SK-${ci + 1}${k + 1}`, slug: `skill-${ci + 1}${k + 1}`, kind: 'skill', title: name, kicker: 'Skill',
  summary: `Shown in ${evidence.map((id) => titleOf(id)).join(' · ')}.`,
  roles: [c.role], slot: { lane: ci + 1, row: 0 }, facts: [], evidence,
})))
export const CREDENTIALS: Entry[] = [
  { id: 'CT-01', slug: 'certifications', kind: 'credential', title: 'Certifications', kicker: 'Credentials',
    summary: CERTIFICATIONS.join(' · '), roles: 'all', slot: { lane: 0, row: 0 }, facts: [], evidence: ['YW-000'] },
]
/** A few words for a file, used wherever an evidence link would otherwise be a bare ID. */
const SHORT: Record<string, string> = {
  'YW-000': 'Subject file', 'X-000': 'SENTINEL-1', 'X-001': 'MCP scanner', 'X-002': 'SecureInsight', 'X-003': 'Pentest', 'X-004': 'TELUS hackathon',
  'X-005': 'Threat model', 'X-006': 'Splunk lab', 'X-007': 'Password vault', 'X-008': 'Campus network', 'X-009': 'PwnScan',
  'SR-01': 'Coast Capital', 'SR-02': 'VibesMeet', 'SR-03': 'BCIT', 'SR-04': 'VIVA IT', 'ED-01': 'Master’s, SFU', 'ED-02': 'BTech, BCIT', 'ED-03': 'Diploma, BCIT', 'CT-01': 'Certifications',
}
export const shortName = (id: string) => SHORT[id] ?? id

function titleOf(id: string) {
  const e = [SUBJECT, ...CASES, ...SERVICE, ...EDUCATION_ENTRIES, RESTRICTED].find((x) => x.id === id)
  return e ? (e.kind === 'service' ? e.org! : e.title) : id
}

// Layout: each drawer's records stand together, a short run of lit drives from its centre outward
// (files first, then education, service records, skills, credentials), and the drawers' centres
// step down the field on a diagonal, so the overview reads as one band of light crossing the
// archive. A new entry only needs its lane; its row is assigned here.
// X-000 sits a little beyond the end of its run: an easter egg to find, not the first thing the eye lands on
const ORDER: Record<string, number> = { subject: 0, case: 1, education: 2, service: 3, visitor: 4, skill: 5, credential: 6, restricted: 7 }
const CENTRE = 16, DIAGONAL = 3
function layout(list: Entry[]) {
  const lanes = new Map<number, Entry[]>()
  for (const e of list) lanes.set(e.slot.lane, [...(lanes.get(e.slot.lane) ?? []), e])
  for (const [lane, group] of lanes) {
    group.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
    const centre = CENTRE + Math.round((lane - (LANES_N - 1) / 2) * DIAGONAL)
    const run = group.filter((e) => e.kind !== 'restricted'), egg = group.filter((e) => e.kind === 'restricted')
    run.forEach((e, i) => { const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1); e.slot = { lane, row: centre + k } })
    const end = Math.ceil(run.length / 2) + 3
    egg.forEach((e, i) => { e.slot = { lane, row: centre + end + i } })
  }
  return list
}
const LANES_N = 6

export const ENTRIES: Entry[] = layout([SUBJECT, ...CASES, ...SERVICE, ...EDUCATION_ENTRIES, RESTRICTED, VISITOR, ...SKILLS, ...CREDENTIALS])
export const entryById = new Map(ENTRIES.map((e) => [e.id, e]))
export const entryBySlug = new Map(ENTRIES.map((e) => [e.slug, e]))
