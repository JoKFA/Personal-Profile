// The subject file tells one story: security learned from the network up. Every step is a drive
// in the archive (years: user, spec G17; dates: resume). Facts come from the resume system's
// experience_db.yaml and golden bullets; the wording here says what actually happened, in plain
// terms, rather than repeating resume bullets. Nothing here is a new fact; it is order.
import type { RoleId } from './types'

export const HEADLINE = 'Security learned from the network up: routing, then detection, then pipelines, then AI agents. Now assessing risk at a Canadian credit union.'

/** A step marked `key` is shown; the rest of a chapter sits behind "more". */
export interface Step { year: string; id: string; what: string; role: RoleId | null; key?: boolean }
export interface Chapter { years: string; title: string; line: string; steps: Step[] }
export const CHAPTERS: Chapter[] = [
  { years: '2021 – 2022', title: 'Infrastructure first', line: 'Trained as a systems administrator, then built a four-site network with a six-person team and put a SIEM on top of it.', steps: [
    { year: '2022', id: 'X-008', what: 'Built a four-site enterprise network from scratch with a team of six, every layer hands-on: routing and switching, firewalls and VPNs, servers, and a SIEM and IPS watching it.', role: 'it', key: true },
    { year: '2021', id: 'ED-03', what: 'Diploma, Computer Information Systems Administration · BCIT', role: 'it' },
  ] },
  { years: '2023 – 2024', title: 'Detection and people', line: 'Learned to read what systems report, then what people do: detections, playbooks, and an awareness programme with a measured result.', steps: [
    { year: '2024', id: 'SR-03', what: 'Built BCIT’s awareness programme from scratch; later phishing simulations showed ~15% fewer successful attempts. Wrote 4 incident-response playbooks.', role: 'grc', key: true },
    { year: '2023', id: 'X-006', what: 'Home SOC lab: Sysmon and firewall logs into Splunk, SPL detections for brute force, privilege escalation and lateral movement.', role: 'soc', key: true },
    { year: '2024', id: 'X-002', what: 'An LLM writes the first triage note for each Wazuh alert; repeats are cached and an analyst decides.', role: 'soc' },
    { year: '2024', id: 'SR-04', what: 'Sole IT and security contact for a 500+ person non-profit.', role: 'it' },
  ] },
  { years: '2025', title: 'Security where code ships', line: 'Moved checks to the point of merge, and tested applications and AI tools the way an attacker would.', steps: [
    { year: '2025', id: 'SR-02', what: 'Put Trivy, GitGuardian and Semgrep in front of every merge, removed excess AWS access, and cut monthly spend ~30%.', role: 'cloud', key: true },
    { year: '2025', id: 'X-003', what: 'Team grey-box pentest of a staging web app; my part was the access-control findings, each proven and paired with a fix.', role: 'soc' },
    { year: '2025', id: 'X-001', what: 'A scanner that sandboxes MCP servers and tests them for prompt injection, tool poisoning and leaked credentials; run on 60+ servers.', role: 'ai', key: true },
    { year: '2025', id: 'X-005', what: 'STRIDE threat model of a non-profit’s systems: 12 threats found, all remediated.', role: 'grc' },
    { year: '2025', id: 'X-007', what: 'Distributed password vault on GCP (graduate coursework, CMPT 756).', role: 'cloud' },
  ] },
  { years: '2026', title: 'Risk at a financial institution', line: 'Now on the defending side of a regulated business: deciding what a change or a vendor adds to risk, and writing it down so it can be audited.', steps: [
    { year: '2026', id: 'SR-01', what: 'Coast Capital: 50+ security risk assessments and 20+ third-party reviews, each ending in a rating and a treatment recommendation.', role: 'grc', key: true },
    { year: '2026', id: 'X-004', what: 'TELUS AI Hackathon: an LLM triages SAST findings and proposes fixes a developer approves.', role: 'ai', key: true },
    { year: '2026', id: 'X-009', what: 'PwnScan: finds IoT devices on a network and ranks their CVEs by CVSS × EPSS × exposure. Top 3, CMPT 783.', role: 'it' },
  ] },
]

export const PRINCIPLES: { title: string; body: string; proof: string[] }[] = [
  { title: 'Evidence over claims', body: 'Findings come with the request that proves them; assessments leave a record someone can audit.', proof: ['X-003', 'X-001', 'SR-01'] },
  { title: 'Security other people can use', body: 'Training for staff, a threat report for leadership, a fix a developer can merge.', proof: ['SR-03', 'X-005', 'X-004'] },
  { title: 'Automate triage, keep people on decisions', body: 'Models write the context and flag the noise; a person approves what changes.', proof: ['X-002', 'X-004', 'X-001'] },
  { title: 'Risk and cost in the same sentence', body: 'Prioritise by what is actually exploited, and cut spend while tightening access.', proof: ['X-009', 'SR-02'] },
]

/** Three numbers, each proving a different kind of work, all from real jobs (evidence tier 1). */
export const KEY_NUMBERS: [string, string, string][] = [
  ['50+', 'security risk assessments', 'at Coast Capital, a regulated Canadian financial institution, plus 20+ third-party reviews'],
  ['~15%', 'fewer phishing successes', 'in later simulations, after the awareness programme I built at BCIT'],
  ['~30%', 'lower monthly AWS spend', 'at VibesMeet, while removing excess IAM access'],
]

