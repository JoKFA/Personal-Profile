// The subject file tells one story: security learned from the network up. Every step is a drive
// in the archive (years: user, spec G17; dates: resume). Nothing here is new fact; it is order.
import type { RoleId } from './types'

export const HEADLINE = 'Security learned from the network up: routing, then detection, then pipelines, then AI agents. Now assessing risk at a Canadian credit union.'

export interface Chapter { years: string; title: string; line: string; steps: { year: string; id: string; what: string; role: RoleId | null }[] }
export const CHAPTERS: Chapter[] = [
  { years: '2021 – 2022', title: 'Infrastructure first', line: 'Systems administration, then a four-site network built and monitored end to end.', steps: [
    { year: '2021', id: 'ED-03', what: 'Diploma, Computer Information Systems Administration · BCIT', role: 'it' },
    { year: '2022', id: 'X-008', what: 'VLANs, OSPF, ACLs, PAT, firewalls and SIEM across four sites', role: 'it' },
  ] },
  { years: '2023 – 2024', title: 'Into detection', line: 'Logs became detections, detections became playbooks, and an LLM joined the triage loop.', steps: [
    { year: '2023', id: 'X-006', what: 'Splunk lab: SPL detections mapped to ATT&CK, with runbooks', role: 'soc' },
    { year: '2024', id: 'SR-03', what: 'BCIT Cyber Security Office: awareness for 1,000+, 20+ policies, 4 IR playbooks', role: 'grc' },
    { year: '2024', id: 'X-002', what: 'Wazuh alerts summarised by an LLM, cached, reviewed by an analyst', role: 'soc' },
    { year: '2024', id: 'SR-04', what: 'Sole IT and security contact for a 500+ person non-profit', role: 'it' },
  ] },
  { years: '2025', title: 'Security in the pipeline', line: 'Checks moved into CI, attacks were tested by hand, and AI tools got a scanner of their own.', steps: [
    { year: '2025', id: 'SR-02', what: 'CI security gates, AWS Security Hub, IAM clean-up, ~30% lower AWS cost', role: 'cloud' },
    { year: '2025', id: 'X-003', what: 'Grey-box pentest: 14 validated findings with fixes', role: 'soc' },
    { year: '2025', id: 'X-005', what: 'STRIDE threat model: 12 threats found and remediated', role: 'grc' },
    { year: '2025', id: 'X-001', what: 'MCP Security Framework: 14 detectors, 60+ servers tested', role: 'ai' },
    { year: '2025', id: 'X-007', what: 'Distributed password vault on GCP (MASc coursework)', role: 'cloud' },
  ] },
  { years: '2026', title: 'AI and risk', line: 'AI inside code review, risk ranked by exploitation, and risk decisions at a financial institution.', steps: [
    { year: '2026', id: 'X-004', what: 'AI reviewer that judges SAST findings and proposes safe fixes', role: 'ai' },
    { year: '2026', id: 'X-009', what: 'PwnScan: CVSS × EPSS × exposure. Top 3, CMPT 783', role: 'it' },
    { year: '2026', id: 'SR-01', what: 'Coast Capital: 50+ security assessments, 20+ vendor reviews', role: 'grc' },
  ] },
]

export const PRINCIPLES: { title: string; body: string; proof: string[] }[] = [
  { title: 'Evidence over claims', body: 'Findings come with the request that proves them; assessments leave a record someone can audit.', proof: ['X-003', 'X-001', 'SR-01'] },
  { title: 'Security other people can use', body: 'Training for staff, a threat report for leadership, a fix a developer can merge.', proof: ['SR-03', 'X-005', 'X-004'] },
  { title: 'Automate triage, keep people on decisions', body: 'Models write the context and flag the noise; a person approves what changes.', proof: ['X-002', 'X-004', 'X-001'] },
  { title: 'Risk and cost in the same sentence', body: 'Prioritise by what is actually exploited, and cut spend while tightening access.', proof: ['X-009', 'SR-02'] },
]

/** Three numbers that carry the story, each with what it means. */
export const KEY_NUMBERS: [string, string, string][] = [
  ['50+', 'security assessments', 'at a credit union, with risk treatment decisions'],
  ['60+', 'MCP servers tested', 'by a scanner I designed for AI agent tools'],
  ['1,000+', 'people trained', 'in a security awareness programme built from scratch'],
]
