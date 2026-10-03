import type { RoleId } from './types'

// The subject file's capability matrix: each skill points at the drives that prove it.
export const CAPABILITIES: { role: RoleId; skills: [string, string[]][] }[] = [
  { role: 'ai', skills: [['MCP / agent tool security', ['X-001']], ['Prompt-injection defence', ['X-000', 'X-001']], ['AI-assisted code review', ['X-004']], ['LLM triage pipelines', ['X-002', 'X-004']]] },
  { role: 'cloud', skills: [['CI security gates', ['SR-02']], ['AWS Security Hub · IAM', ['SR-02']], ['Container & secret scanning', ['SR-02', 'X-001']], ['Distributed systems on GCP', ['X-007']]] },
  { role: 'soc', skills: [['Detection engineering (SPL, Wazuh)', ['X-006', 'X-002']], ['Incident-response playbooks', ['SR-03']], ['Web & API access control', ['X-003']], ['Vulnerability prioritisation', ['X-009']]] },
  { role: 'grc', skills: [['Security risk assessment', ['SR-01']], ['Third-party / vendor risk', ['SR-01']], ['Threat modelling (STRIDE)', ['X-005', 'SR-01']], ['NIST CSF · ISO 27001', ['SR-03', 'SR-01']], ['Security awareness', ['SR-03']]] },
  { role: 'it', skills: [['VLAN · OSPF · ACL · PAT', ['X-008']], ['Firewalls & SIEM', ['X-008']], ['Asset discovery (ARP/mDNS/SSDP)', ['X-009']], ['Microsoft 365 · DNS · SSL', ['SR-04']]] },
]
