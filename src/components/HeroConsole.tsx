/**
 * HERO CONSOLE — terminal + interactive isometric domain stack.
 *
 * Direct port of .codex-runtime/design/hero-concepts.html into React.
 * Imperative animations (ASCII reveal, typewriter) run inside one effect on mount.
 * Domain hover/click state lives in React; layer/holo styling driven by CSS class.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

const ASCII_BANNER = `██╗   ██╗ █████╗  ██████╗ ████████╗██╗███╗   ██╗ ██████╗
╚██╗ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝██║████╗  ██║██╔════╝
 ╚████╔╝ ███████║██║   ██║   ██║   ██║██╔██╗ ██║██║  ███╗
  ╚██╔╝  ██╔══██║██║   ██║   ██║   ██║██║╚██╗██║██║   ██║
   ██║   ██║  ██║╚██████╔╝   ██║   ██║██║ ╚████║╚██████╔╝
   ╚═╝   ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝╚═╝  ╚═══╝ ╚═════╝
██╗    ██╗ █████╗ ███╗   ██╗ ██████╗
██║    ██║██╔══██╗████╗  ██║██╔════╝
██║ █╗ ██║███████║██╔██╗ ██║██║  ███╗
██║███╗██║██╔══██║██║╚██╗██║██║   ██║
╚███╔███╔╝██║  ██║██║ ╚████║╚██████╔╝
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝`

const DIRECTIVE_HTML =
  'MASc cybersecurity student building practical security controls for <strong>AI systems</strong>, <strong>cloud workflows</strong>, and <strong>security operations</strong>. I turn security ideas into working projects: sandboxed AI tooling, DevSecOps automation, threat analysis, operational controls, and clear risk communication.'

const PROMPT_LABEL = '[yaoting@security-profile] ~'
const DEFAULT_UPLINK_CMD = 'await_match --listen'
const DEFAULT_UPLINK_OUTPUT = '> STANDBY: HOVER A DOMAIN TO MAP ROLE FIT...'

type DomainKey = '1' | '2' | '3' | '4' | '5'

interface Domain {
  key: DomainKey
  trigger: string
  layerLabel: string
  tag: string
  role: string
  node: string
  workbench: string // raw HTML, kept verbatim from design spec
}

const DOMAINS: Domain[] = [
  {
    key: '5',
    trigger: '[5] AI_APPSEC',
    layerLabel: 'AI_APPSEC',
    tag: 'L5 // AI_APPSEC_PATH',
    role: 'AI Security',
    node: 'profile.ai_appsec_path',
    workbench: `
      <div class="holo-role">AI Security Path</div>
      <p class="workbench-sub">Target: AI Security, AppSec, Product Security, Agent Safety</p>
      <div class="token-row">
        <span class="token">Agents</span><span class="token">MCP</span><span class="token">AI Hardening</span><span class="token">Prompt Injection</span><span class="token">Tool Permissions</span>
      </div>
      <div class="module-line"><strong>MCP project:</strong> discovers MCP servers, runs them inside Docker sandboxes, normalizes stdio/SSE traffic, and checks agent-facing risk with 14 detectors.</div>
      <div class="evidence-strip">
        <span class="evidence">60+ MCP targets</span><span class="evidence">SARIF / JSONL</span><span class="evidence">OWASP LLM/API</span><span class="evidence">CWE / CVSS</span>
      </div>
      <div class="module-line"><strong>Agent risk coverage:</strong> prompt injection, tool poisoning, credential exposure, excessive permissions, unsafe agent skills, and workflows where agents can touch real systems.</div>
    `,
  },
  {
    key: '4',
    trigger: '[4] CLOUD_DEVSECOPS',
    layerLabel: 'CLOUD_DEVSECOPS',
    tag: 'L4 // CLOUD_DEVSECOPS',
    role: 'Cloud / DevSecOps',
    node: 'profile.cloud_security',
    workbench: `
      <div class="holo-role">Cloud / DevSecOps Path</div>
      <p class="workbench-sub">Target: Junior DevSecOps, Cloud Security Analyst, Security Automation</p>
      <div class="token-row">
        <span class="token">AWS IAM</span><span class="token">GitHub Actions</span><span class="token">Terraform</span><span class="token">Docker</span><span class="token">Trivy</span><span class="token">GitGuardian</span>
      </div>
      <div class="evidence-strip">
        <span class="evidence">PR checks</span><span class="evidence">Secret scanning</span><span class="evidence">Container CVEs</span><span class="evidence">IaC review</span><span class="evidence">IAM review</span>
      </div>
      <div class="module-line"><strong>Pipeline checks:</strong> GitHub Actions security gates for secrets, container/dependency CVEs, and Terraform changes before merge.</div>
      <div class="module-line"><strong>Cloud controls:</strong> IAM least privilege, MFA, access review, exposed resources, secrets handling, and reliable deployment choices.</div>
      <div class="module-line"><strong>VibesMeet workflow:</strong> Trivy, GitGuardian, and Terraform scanning with findings converted into fix notes developers could act on.</div>
    `,
  },
  {
    key: '3',
    trigger: '[3] SEC_ANALYST',
    layerLabel: 'SEC_ANALYST',
    tag: 'L3 // SECURITY_ANALYST',
    role: 'Security Analyst',
    node: 'profile.security_analyst_path',
    workbench: `
      <div class="holo-role">Security Analyst Path</div>
      <p class="workbench-sub">Target: SOC Analyst, Vulnerability Analyst, Security Analyst</p>
      <div class="token-row">
        <span class="token">SOC</span><span class="token">Pentest</span><span class="token">Threat Modeling</span><span class="token">Detection</span><span class="token">Reporting</span>
      </div>
      <div class="module-line"><strong>Detection + triage:</strong> Splunk/Wazuh alert review, Burp-based web testing, and STRIDE threat modeling tied back to what happened, why it matters, and what to do next.</div>
      <div class="evidence-strip">
        <span class="evidence">Splunk</span><span class="evidence">Wazuh</span><span class="evidence">Sysmon</span><span class="evidence">EDR/XDR</span><span class="evidence">Fortinet</span><span class="evidence">Burp</span><span class="evidence">MITRE ATT&amp;CK</span><span class="evidence">CVSS</span>
      </div>
      <div class="module-line"><strong>Hands-on evidence:</strong> 4 IR playbooks, AI-assisted EDR triage, 14 validated findings, and 12 STRIDE-modeled threats across detection, testing, and analysis.</div>
    `,
  },
  {
    key: '2',
    trigger: '[2] GRC_AWARENESS',
    layerLabel: 'GRC_AWARENESS',
    tag: 'L2 // GRC_AWARENESS',
    role: 'GRC / Security Awareness',
    node: 'profile.grc_awareness_path',
    workbench: `
      <div class="holo-role">GRC / Security Awareness Path</div>
      <p class="workbench-sub">Target: GRC Analyst, Risk Analyst, Security Awareness</p>
      <div class="risk-flow">
        <div class="risk-node">risk</div><div class="risk-node">control</div><div class="risk-node">evidence</div><div class="risk-node">owner</div><div class="risk-node">action</div>
      </div>
      <div class="token-row">
        <span class="token">NIST CSF</span><span class="token">ISO 27001</span><span class="token">PIPEDA</span><span class="token">Policy</span><span class="token">Awareness</span>
      </div>
      <div class="module-line"><strong>Controls + evidence:</strong> translate technical findings into control language, evidence tracking, awareness content, and remediation summaries teams can follow.</div>
      <div class="module-line"><strong>Awareness + remediation:</strong> 20+ security standards, 1,000+ awareness audience, and 12 STRIDE-modeled threats tracked through remediation.</div>
    `,
  },
  {
    key: '1',
    trigger: '[1] IT_NETWORK',
    layerLabel: 'IT_NETWORK',
    tag: 'L1 // IT_NETWORK',
    role: 'IT / Network Security',
    node: 'profile.it_network_path',
    workbench: `
      <div class="holo-role">IT / Network / Systems Path</div>
      <p class="workbench-sub">Target: IT Security, Network Security, System / Security Operations</p>
      <div class="ops-zones">
        <span class="zone">Identity</span><span class="zone">Endpoints</span><span class="zone">M365</span><span class="zone">DNS / SSL</span><span class="zone">Network</span><span class="zone">Hosting</span><span class="zone">Databases</span>
      </div>
      <div class="ops-cue"><strong>Defense in depth:</strong> identity controls, endpoint hygiene, network paths, service reliability, backups/data, and user access working together.</div>
      <div class="ops-cue"><strong>Core systems:</strong> sole IT contact for 500+ staff/volunteers across Microsoft 365, access, devices, DNS/hosting, databases, and support workflows.</div>
      <div class="ops-cue"><strong>Secure operations:</strong> access reviews, firewall/VPN concepts, DNS/certificate reliability, AD/Azure AD basics, and operational controls that support secure teams.</div>
    `,
  },
]

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function HeroConsole() {
  // boot-sequence visibility: blocks 2-4 reveal in order
  const [block2, setBlock2] = useState(false)
  const [block3, setBlock3] = useState(false)
  const [block4, setBlock4] = useState(false)
  const [coreReady, setCoreReady] = useState(false)
  const [showDirCursor, setShowDirCursor] = useState(true)

  // domain interaction
  const [previewDomain, setPreviewDomain] = useState<DomainKey | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<DomainKey | null>(null)

  // refs for imperative animations
  const block1Ref = useRef<HTMLDivElement | null>(null)
  const asciiRef = useRef<HTMLPreElement | null>(null)
  const directiveRef = useRef<HTMLSpanElement | null>(null)
  const corePanelRef = useRef<HTMLDivElement | null>(null)
  const holoPanelRef = useRef<HTMLDivElement | null>(null)

  // ── boot sequence ──
  useEffect(() => {
    const reduced = prefersReducedMotion()
    const ascii = asciiRef.current
    const block1 = block1Ref.current
    const corePanel = corePanelRef.current
    if (!ascii || !block1 || !corePanel) return

    let cancelled = false
    const timers: number[] = []

    function revealAscii(el: HTMLElement, callback: () => void) {
      const lines = ASCII_BANNER.split('\n')
      let currentLine = 0
      el.textContent = ''
      const renderLine = () => {
        if (cancelled) return
        if (currentLine < lines.length) {
          el.textContent += lines[currentLine] + '\n'
          currentLine += 1
          timers.push(window.setTimeout(renderLine, 18))
        } else {
          callback()
        }
      }
      renderLine()
    }

    function typeWriter(el: HTMLElement, html: string, speed: number, callback: () => void) {
      let i = 0
      let isTag = false
      let text = ''
      const step = () => {
        if (cancelled) return
        if (i < html.length) {
          text += html.charAt(i)
          el.innerHTML = text
          if (html.charAt(i) === '<') isTag = true
          if (html.charAt(i) === '>') isTag = false
          i += 1
          if (isTag) step()
          else timers.push(window.setTimeout(step, speed))
        } else {
          callback()
        }
      }
      step()
    }

    // wait for a freshly-rendered ref (block3/block4 are conditionally rendered)
    function whenRef<T>(getRef: () => T | null, cb: (el: T) => void, attempts = 20) {
      const tick = () => {
        if (cancelled) return
        const el = getRef()
        if (el) {
          cb(el)
          return
        }
        if (attempts <= 0) return
        attempts -= 1
        timers.push(window.setTimeout(tick, 16))
      }
      tick()
    }

    if (reduced) {
      ascii.textContent = ASCII_BANNER
      block1.style.opacity = '1'
      corePanel.style.opacity = '1'
      setShowDirCursor(false)
      setBlock2(true)
      setBlock3(true)
      setBlock4(true)
      setCoreReady(true)
      // paint directive after block3 mounts
      whenRef(
        () => directiveRef.current,
        (el) => {
          el.innerHTML = DIRECTIVE_HTML
        },
      )
      return () => {
        cancelled = true
        timers.forEach((t) => window.clearTimeout(t))
      }
    }

    ascii.textContent = ''
    block1.style.opacity = '0'
    corePanel.style.opacity = '0'

    const reveal = () => {
      block1.style.transition = 'opacity 0.4s ease'
      block1.style.opacity = '1'
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          ascii.textContent = ASCII_BANNER
          revealAscii(ascii, () => {
            if (cancelled) return
            setBlock2(true)
            timers.push(
              window.setTimeout(() => {
                if (cancelled) return
                setBlock3(true)
                whenRef(
                  () => directiveRef.current,
                  (directive) => {
                    typeWriter(directive, DIRECTIVE_HTML, 4, () => {
                      if (cancelled) return
                      setShowDirCursor(false)
                      setBlock4(true)
                      corePanel.style.transition = 'opacity 1s ease, filter 1s ease'
                      corePanel.style.filter = 'blur(0px)'
                      corePanel.style.opacity = '1'
                      setCoreReady(true)
                    })
                  },
                )
              }, 180),
            )
          })
        }, 140),
      )
    }

    timers.push(window.setTimeout(reveal, 100))

    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  // ── domain interactions ──
  const domainByKey = useMemo(() => new Map(DOMAINS.map((domain) => [domain.key, domain])), [])
  const activeDomain = previewDomain ?? selectedDomain

  const activateFromHover = (key: DomainKey) => {
    if (typeof window !== 'undefined' && window.innerWidth <= 680) return
    setPreviewDomain(key)
  }

  const lockActivate = (key: DomainKey) => {
    setSelectedDomain(key)
    setPreviewDomain(null)
    if (typeof window !== 'undefined' && window.innerWidth <= 680 && holoPanelRef.current) {
      const panel = holoPanelRef.current
      window.setTimeout(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    }
  }

  const deactivate = () => {
    setPreviewDomain(null)
  }

  const activeDomainObj = activeDomain ? domainByKey.get(activeDomain) ?? null : null

  useEffect(() => {
    if (!selectedDomain) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (corePanelRef.current?.contains(target)) return
      setSelectedDomain(null)
      setPreviewDomain(null)
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelectedDomain(null)
      setPreviewDomain(null)
    }

    window.addEventListener('pointerdown', closeOnOutsidePointer, { passive: true })
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedDomain])

  const stageClass = `iso-stage${activeDomain ? ` active-${activeDomain}` : ''}`

  // uplink output: idle vs active
  const uplinkCmd = activeDomainObj ? `./connect_domain.sh --target ${activeDomainObj.node}` : DEFAULT_UPLINK_CMD

  return (
    <section className="hero-console" aria-label="introduction">
      <div className="hc-bg-grid" aria-hidden="true" />
      <div className="hc-terminal-shadow" aria-hidden="true" />

      <div className="hc-container">
        <div className="hc-terminal" aria-label="Profile terminal">
          <div ref={block1Ref}>
            <div className="hc-line">
              <span>{PROMPT_LABEL}</span>
              <span className="hc-char">$</span>
              <span className="hc-cmd">whoami</span>
            </div>
            <pre ref={asciiRef} className="hc-ascii" aria-label="Yaoting Wang">
              {ASCII_BANNER}
            </pre>
          </div>

          {block2 && (
            <div>
              <div className="hc-line">
                <span>{PROMPT_LABEL}</span>
                <span className="hc-char">$</span>
                <span className="hc-cmd">cat profile.dat</span>
              </div>
              <div className="hc-output">
                <div className="hc-data-grid">
                  <div className="hc-data-key">IDENTITY</div>
                  <div className="hc-data-val">
                    <strong>Yaoting Wang</strong> // MASc Cybersecurity student
                  </div>
                  <div className="hc-data-key">LOCATION</div>
                  <div className="hc-data-val">
                    Vancouver, BC // <strong>open to relocate in Canada</strong>
                  </div>
                  <div className="hc-data-key">STAGE</div>
                  <div className="hc-data-val">
                    New grad // <strong>multi-domain security, hands-on security builder</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {block3 && (
            <div>
              <div className="hc-line">
                <span>{PROMPT_LABEL}</span>
                <span className="hc-char">$</span>
                <span className="hc-cmd">./load_direction.sh</span>
              </div>
              <div className="hc-output">
                <div className="hc-directive">
                  <span ref={directiveRef} />
                  {showDirCursor && <span className="hc-cursor" aria-hidden="true" />}
                </div>
              </div>
            </div>
          )}

          {block4 && (
            <div>
              <div className="hc-line">
                <span>{PROMPT_LABEL}</span>
                <span className="hc-char">$</span>
                <span className="hc-cmd">{uplinkCmd}</span>
              </div>
              <div className={`hc-output hc-uplink${activeDomainObj ? ' active' : ''}`}>
                {activeDomainObj ? (
                  <>
                    {'> ROLE FIT MAPPED...'}
                    <br />
                    {'> ACTIVE DOMAIN: '}
                    <span className="hc-str">{`"${activeDomainObj.role.toUpperCase()}"`}</span>
                    <span className="hc-cursor" aria-hidden="true" />
                  </>
                ) : (
                  DEFAULT_UPLINK_OUTPUT
                )}
              </div>

              <div className="hc-actions">
                <a href="#work" className="hc-btn hc-btn-primary">
                  Execute: View_Work
                </a>
                <a href="#contact" className="hc-btn">
                  Init: Contact_Protocol
                </a>
              </div>
            </div>
          )}
        </div>

        <div
          ref={corePanelRef}
          className="hc-core"
          aria-label="Interactive security domain stack"
          style={{ opacity: coreReady ? 1 : undefined }}
        >
          <div className={stageClass}>
            <div className="hc-pillar" aria-hidden="true" />
            <div className="hc-iso-stack" aria-hidden="true">
              {DOMAINS.slice()
                .sort((a, b) => Number(a.key) - Number(b.key))
                .map((d) => (
                  <div
                    key={d.key}
                    className={`hc-layer hc-layer-${d.key}${activeDomain === d.key ? ' active-target' : ''}`}
                    data-layer={d.key}
                  >
                    <span className="hc-iso-label">{d.layerLabel}</span>
                  </div>
                ))}
            </div>

            <div className="hc-holo-slot">
              <div
                ref={holoPanelRef}
                className={`hc-holo${activeDomainObj ? ' visible' : ''}`}
                aria-hidden={activeDomainObj ? undefined : true}
              >
              <div className="hc-holo-header">
                <span>{activeDomainObj ? activeDomainObj.tag : 'DOMAIN_SCAN'}</span>
                <span>[ACTIVE]</span>
              </div>
              {activeDomainObj ? (
                <div
                  // workbench markup is authored locally above (no user input) — safe.
                  dangerouslySetInnerHTML={{ __html: activeDomainObj.workbench }}
                />
              ) : (
                <div>
                  <div className="holo-role">Select Domain</div>
                  <p className="workbench-sub">Hover over a layer to preview a security workbench.</p>
                </div>
              )}
              </div>
            </div>
          </div>

          <div className="hc-triggers">
            <div className="hc-target-header">// SELECT DOMAIN</div>
            {DOMAINS.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`hc-trigger${activeDomain === d.key ? ' active' : ''}`}
                onPointerDown={(event) => {
                  if (event.pointerType !== 'mouse') {
                    lockActivate(d.key)
                  }
                }}
                onMouseEnter={() => activateFromHover(d.key)}
                onMouseLeave={deactivate}
                onFocus={() => activateFromHover(d.key)}
                onBlur={deactivate}
                onClick={() => lockActivate(d.key)}
              >
                {d.trigger}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
