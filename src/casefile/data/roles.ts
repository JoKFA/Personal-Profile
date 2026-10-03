import type { Drawer, Role, RoleId } from './types'

export const ROLES: Role[] = [
  {
    id: 'ai', name: 'AI Security',
    seats: 'AI Security Engineer · AppSec · Product Security',
    fit: 'Tests AI agents before they reach real tools: 14 MCP detectors across 60+ servers, AI-assisted code review, prompt-injection defence.',
  },
  {
    id: 'cloud', name: 'Cloud & DevSecOps',
    seats: 'DevSecOps · Cloud Security Analyst · Security Automation',
    fit: 'Security gates in CI, AWS Security Hub, IAM least privilege, and ~30% lower monthly AWS cost at a startup.',
  },
  {
    id: 'soc', name: 'Security Operations',
    seats: 'SOC Analyst · Vulnerability Analyst · Security Analyst',
    fit: 'Detection on Wazuh and Splunk, 4 IR playbooks, a 14-finding grey-box pentest, and CVE × EPSS risk ranking.',
  },
  {
    id: 'grc', name: 'GRC & Awareness',
    seats: 'GRC Analyst · Third-Party Risk · Security Awareness',
    fit: '50+ internal security assessments and 20+ vendor reviews at a credit union; awareness training for 1,000+ people.',
  },
  {
    id: 'it', name: 'IT & Network',
    seats: 'IT Security · Network Administration · Infrastructure',
    fit: 'Sole IT contact for 500+ people; VLANs, OSPF, ACLs, PAT, firewalls and SIEM built across a four-site network.',
  },
]
export const ROLE_IDS = ROLES.map((r) => r.id)
export const roleById = (id: RoleId) => ROLES.find((r) => r.id === id)!

export const DRAWERS: Drawer[] = [
  { lane: 0, name: 'Profile & Education', code: 'PRO' },
  { lane: 1, name: 'AI Security', code: 'AIS' },
  { lane: 2, name: 'Cloud & DevSecOps', code: 'DEV' },
  { lane: 3, name: 'Security Operations', code: 'SOC' },
  { lane: 4, name: 'GRC & Awareness', code: 'GRC' },
  { lane: 5, name: 'IT & Network', code: 'NET' },
]
/** each drawer after Subject is one "Hiring for" direction */
export const DRAWER_ROLE: (RoleId | null)[] = [null, 'ai', 'cloud', 'soc', 'grc', 'it']
