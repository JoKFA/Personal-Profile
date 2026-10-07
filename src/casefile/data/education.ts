// Education records. Program names and course descriptions from the institutions' own pages
// (SFU Graduate Calendar: Master of Cybersecurity, CMPT 782/783; BCIT program pages for the
// BTech in Forensic Investigation (Digital Forensics and Cybersecurity Option) and the CISA
// diploma); courses taken from the SFU unofficial transcript (grades are not shown). Which
// project came out of which course is only linked where the resume system says so; the rest is
// listed in docs/casefile-spec.md §22 for the user to confirm.
import type { Entry } from './types'

export const EDUCATION_ENTRIES: Entry[] = [
  {
    id: 'ED-01', slug: 'sfu-master-of-cybersecurity', kind: 'education', title: 'Master of Cybersecurity',
    org: 'Simon Fraser University', dates: 'Sept 2025 – Apr 2027 (expected)', place: 'Burnaby, BC',
    kicker: 'Education · graduate', year: '2025',
    summary: 'A full-time graduate cohort built around two six-unit labs: first trained as a penetration tester, then as a defender of systems, networks and cloud, with a co-op in industry.',
    roles: 'all', slot: { lane: 0, row: 0 },
    facts: [['Program', 'Full-time cohort · co-op integrated'], ['Core', 'Cybersecurity Lab I & II · Applied Cryptography · Distributed & Cloud Systems'], ['Co-op', 'Information Security, Coast Capital Savings'], ['Built here', 'PwnScan (Top 3) · CryptoLab vault · MCP scanner · pentest']],
    // X-003 and X-001 came out of CMPT 782, Cybersecurity Lab I (user confirmed 2026-09-29)
    courses: [
      { code: 'CMPT 782', title: 'Cybersecurity Lab I', out: 'A team grey-box pentest (my part: the access-control findings), and a scanner for MCP servers', ids: ['X-003', 'X-001'] },
      { code: 'CMPT 783', title: 'Cybersecurity Lab II', out: 'PwnScan: IoT devices found and their CVEs ranked by real risk · Top 3', ids: ['X-009'] },
      { code: 'CMPT 789', title: 'Applied Cryptography', out: 'CryptoLab vault: scrypt keys, AES-256-GCM, Shamir k-of-n recovery', href: 'https://github.com/JoKFA/CryptoLab-SecurePWMSystem' },
      { code: 'CMPT 756', title: 'Distributed and Cloud Systems', out: 'A GFS-style password vault on GCP, across three zones', ids: ['X-007'] },
      { code: 'CMPT 626', title: 'Graduate Co-op', out: 'Security risk assessments at Coast Capital Savings', ids: ['SR-01'] },
    ],
    sections: [
      { eyebrow: '01 · Lab I', title: 'Trained as a penetration tester', body: 'Cybersecurity Lab I simulates real attacks on software systems: discover a vulnerability, exploit it, and decide what an attacker would gain. Out of it came a team grey-box pentest of a staging web app (my part: the access-control findings), and a scanner that tests MCP servers before an AI agent may use them.' },
      { eyebrow: '02 · Lab II', title: 'Then as a defender', body: 'Cybersecurity Lab II studies attacks on systems, networks and cloud infrastructure, and how to detect and prevent them. My team’s project, PwnScan, finds IoT devices on a network and ranks their CVEs by what is actually exploitable; it placed in the top 3.' },
      { eyebrow: '03 · Systems', title: 'Cryptography and the cloud underneath', body: 'Applied Cryptography produced CryptoLab, a client-side password vault: keys derived with scrypt, entries sealed with AES-256-GCM so tampered metadata fails to decrypt, an HMAC-chained audit log, and Shamir k-of-n recovery shares. Distributed and Cloud Systems produced a GFS-style vault on GCP, one master and three chunk servers across zones.' },
    ],
    related: ['X-009', 'X-003', 'X-001', 'X-007', 'SR-01'],
    demo: 'quorum', demoNote: ['Sample key · real 2-of-3 Shamir recovery, run in your browser', 'Shamir recovery: CryptoLab, CMPT 789'],
    seo: { title: 'Yaoting Wang | Master of Cybersecurity, SFU', description: 'SFU Master of Cybersecurity: penetration testing and defence labs, applied cryptography, distributed and cloud systems, and an industry co-op in information security.' },
  },
  {
    id: 'ED-02', slug: 'bcit-btech-digital-forensics-cybersecurity', kind: 'education', title: 'BTech, Digital Forensics & Cybersecurity',
    org: 'BCIT', dates: 'Sept 2023 – May 2025', place: 'Burnaby, BC',
    kicker: 'Education · bachelor', year: '2023',
    summary: 'Digital evidence and cyber defence in one degree: forensic imaging and analysis, network security, and the criminal law that decides whether evidence holds up.',
    roles: 'all', slot: { lane: 0, row: 0 },
    facts: [['Program', 'Forensic Investigation · Digital Forensics & Cybersecurity option'], ['Capstone', 'SecureInsight (EDR + AI), with a thesis'], ['Core', 'Digital forensics · evidence imaging · Network Security 1 & 2'], ['Internships', 'BCIT Cyber Security Office · VibesMeet']],
    courses: [
      { code: 'FSCT 8611', title: 'Graduation Project', out: 'SecureInsight (EDR + AI): Wazuh alerts explained by an LLM; redundant alerts 65% → 12%', ids: ['X-002'] },
      { code: 'FSCT 7509', title: 'Intro to Digital Forensics & Evidence Imaging', out: 'Imaging, write blocking, chain of custody' },
      { code: 'FSCT 8513', title: 'Digital Forensics 1', out: 'Forensic analysis of disks and artefacts' },
      { code: 'FSCT 7511', title: 'Cybersecurity Foundation', out: 'Controls, threats and frameworks' },
      { code: 'FSCT 8540 · 8560', title: 'Network Security 1 & 2', out: 'Firewalls, IDS/IPS and VPNs' },
      { code: 'FSCT 7002', title: 'Criminal Law 2: Legal Evidence', out: 'Evidence that holds up in court' },
      { code: 'Internship', title: 'BCIT Cyber Security Office · VibesMeet', out: 'Awareness, policy and IR at BCIT; CI security gates and AWS at VibesMeet', ids: ['SR-03', 'SR-02'] },
    ],
    sections: [
      { eyebrow: '01 · Evidence', title: 'Evidence first', body: 'The degree starts from how digital evidence is acquired without changing it: imaging, write blocking, hashing and chain of custody, then forensic analysis of what the image contains.' },
      { eyebrow: '02 · Defence', title: 'Networks, attacked and defended', body: 'Two network security courses and a cybersecurity foundation course cover the other side: controls, detection and the architecture that keeps an incident small.' },
      { eyebrow: '03 · Capstone', title: 'Security alerts a non-specialist can act on', body: 'My graduation project and thesis, “Improving Endpoint Security: Automation and Usability Through AI Integration”, built SecureInsight, EDR plus AI: Wazuh collects endpoint alerts, an LLM turns each into a plain summary, a risk rating and the next step, and a SQLite cache stops repeats from costing anything. In the lab study, redundant alerts fell from 65% to 12% and alerts handled per hour rose from 15 to 150.' },
      { eyebrow: '04 · Practice', title: 'Two internships during the degree', body: 'At BCIT’s Cyber Security Office: an awareness programme built from scratch, 20+ policies checked against NIST CSF and ISO 27001, and 4 incident-response playbooks. At VibesMeet: security gates in CI, AWS Security Hub, IAM clean-up and ~30% lower cloud spend.' },
    ],
    related: ['X-002', 'SR-03', 'SR-02'],
    demo: 'custody', demoNote: ['Sample case · real SHA-256 fingerprints', 'Each step tagged with the course that taught it'],
    seo: { title: 'Yaoting Wang | BTech, Digital Forensics & Cybersecurity, BCIT', description: 'BCIT Bachelor of Technology in Forensic Investigation, Digital Forensics and Cybersecurity option: evidence imaging and analysis, network security, and criminal law.' },
  },
  {
    id: 'ED-03', slug: 'bcit-diploma-computer-information-systems-administration', kind: 'education', title: 'Diploma, Computer Information Systems Administration',
    org: 'BCIT', dates: 'Sept 2021 – May 2023', place: 'Burnaby, BC',
    kicker: 'Education · diploma', year: '2021',
    summary: 'Two years of running real infrastructure: Cisco routing and switching, Active Directory, Linux, and the databases and scripts that hold it together. Where the story starts.',
    roles: 'all', slot: { lane: 0, row: 0 },
    facts: [['Program', 'Full-time · theory with hands-on labs'], ['Core', 'Cisco routing & switching · Active Directory & IAM · Linux & Windows Server'], ['Also', 'Databases and programming essentials'], ['Capstone', 'Four-site enterprise network, team of six']],
    courses: [
      { code: 'Capstone', title: 'Cisco routing and switching', out: 'A four-site enterprise network built from scratch: routing, firewalls, servers, SIEM and IPS', ids: ['X-008'] },
      { code: 'Systems', title: 'Active Directory and cloud IAM', out: 'Identity and access: directory users, groups and cloud roles' },
      { code: 'Systems', title: 'Linux and Windows Server administration', out: 'Servers configured and kept running' },
      { code: 'Data', title: 'Databases and programming', out: 'Scripts and data behind the services' },
    ],
    sections: [
      { eyebrow: '01 · Infrastructure', title: 'Install, configure, monitor, troubleshoot', body: 'The program trains administrators of LANs and WANs: Cisco routers, switches, firewalls and wireless, Active Directory and Linux, with theory and lab work side by side.' },
      { eyebrow: '02 · Capstone', title: 'A network with four sites', body: 'With a team of six I built a four-site network from scratch and worked every layer: OSPF, VLANs, ACLs, PAT and MPLS between sites; firewalls and VPN tunnels; the servers; and a SIEM and IPS watching all of it.' },
    ],
    related: ['X-008'],
    demo: 'stack', demoNote: ['Sample ticket · layers are the program’s subjects', 'Program: BCIT CISA diploma page'],
    seo: { title: 'Yaoting Wang | Diploma, Computer Information Systems Administration, BCIT', description: 'BCIT Computer Information Systems Administration diploma: Cisco routing and switching, Active Directory, Linux administration, and a four-site enterprise network.' },
  },
]
