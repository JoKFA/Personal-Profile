// Where each entry's facts come from. Test-only: never imported by the app, so none of this
// (local paths, private repos, confirmation notes) ships in the public bundle.
export const SOURCES: Record<string, string[]> = {
  'YW-000': ['experience_db.yaml', 'main.tex (education, certifications)'],
  'X-001': ['project_mcp_security_framework', 'projects/mcp_security_framework.tex', 'src/data/projects.ts (reviewed against the GitHub project)'],
  'X-004': ['project_telus_ai_appsec', 'projects/telus_ai_hackathon_appsec.tex'],
  'X-007': ['project_gfs_password_manager', 'projects/gfs_password_manager.tex'],
  'X-002': ['project_ai_edr_triage', 'projects/ai_siem_edr_automation.tex'],
  'X-003': ['experience_db: internal pentest entry', 'projects/internal_pentest_*.tex', 'user confirmation 2026-09-28 (the three findings are real)'],
  'X-006': ['project_splunk_soc_lab', 'projects/splunk_soc_homelab.tex'],
  'X-005': ['project_viva_threat_model', 'projects/threat_modelling_viva.tex', 'user confirmation 2026-09-15 (all 12 remediated)'],
  'X-008': ['project_enterprise_campus_network', 'user statement 2026-09-28 (hands-on: VLAN, OSPF, ACL, PAT, DNS, DHCP, SIEM, firewall)'],
  'X-009': ['E:\\Codebase\\SFU783-Project (git history, worker/tasks/cve.py)', 'Presentation 783.pdf', 'user statement 2026-09-28 (Top 3)'],
  'SR-01': ['work_coastcapital_information_security'],
  'SR-02': ['work_vibesmeet_devsecops'],
  'SR-03': ['work_bcit_cybersecurity_office'],
  'SR-04': ['work_viva_it_security'],
  'X-000': ['src/server/redteam.ts'],
  'V-FILE': ['browser APIs, computed locally'],
  'ED-01': ['SFU unofficial transcript 2026-09-07 (degree name, courses)', 'github.com/JoKFA/CryptoLab-SecurePWMSystem README (CMPT 789, user 2026-09-29)', 'user 2026-09-29: pentest and MCP scanner from CMPT 782 Lab I', 'sfu.ca Graduate Calendar: Master of Cybersecurity, CMPT 782 / 783', 'project_gfs_password_manager (CMPT 756)', 'X-009 sources (CMPT 783)'],
  'ED-02': ['bcit.ca: Forensic Investigation (Digital Forensics and Cybersecurity Option), BTech, program matrix', 'Final Report _Grad Project.pdf (FSCT 8611; Table 3: redundancy 65% → 12%, alerts/hour 15 → 150)', 'user 2026-09-29: capstone = EDR AI; BCIT and VibesMeet internships during the BTech', '能力画像.md (dates; forensic tools confirmed 2026-09-07)', 'work_bcit_cybersecurity_office (dates inside the degree)'],
  'ED-03': ['bcit.ca: Computer Information Systems Administration, Diploma', '能力画像.md / main.tex (dates)', 'project_enterprise_campus_network (coursework, 2022)'],
}
