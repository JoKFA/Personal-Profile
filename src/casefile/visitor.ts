// Visitor recon: what a browser tells any page in the first milliseconds. Computed locally;
// nothing is sent anywhere.
export interface Visitor {
  id: string; hash: number; ms: number
  os: string; browser: string; tz: string; city: string; time: string; langs: string; cores: number; gpu: string | null
  referrer: string | null; scheme: string; screen: string
  facts: string[]
  rows: [string, string][]
}

const esc = (v: unknown) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function reconVisitor(): Visitor {
  const t0 = performance.now(), ua = navigator.userAgent
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'an unlisted OS'
  let browser = 'a browser'
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string; version: string }[] } }).userAgentData?.brands?.filter((b) => !/Not|Chromium/i.test(b.brand))
  if (brands?.length) browser = `${brands[0].brand} ${brands[0].version}`
  else { const m = ua.match(/(Edg|Firefox|Chrome|Version)\/(\d+)/); if (m) browser = `${({ Edg: 'Edge', Version: 'Safari' } as Record<string, string>)[m[1]] || m[1]} ${m[2]}` }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const city = tz.split('/').pop()!.replace(/_/g, ' ')
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const langs = (navigator.languages || [navigator.language]).slice(0, 3).join(', ')
  const cores = navigator.hardwareConcurrency || 0
  let gpu: string | null = null
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const raw: string = ext ? gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''
    const m = raw.match(/(NVIDIA [^,(]+|GeForce [^,(]+|AMD [^,(]+|Radeon [^,(]+|Intel\(R\) [^,(]+|Apple [^,(]+|Mali[^,(]*|Adreno[^,(]*)/)
    gpu = m ? m[1].trim().replace(/\s+Direct3D.*$/, '') : null
  } catch { /* no WebGL */ }
  let referrer: string | null = null
  try { referrer = document.referrer ? new URL(document.referrer).hostname : null } catch { /* opaque */ }
  const scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  const screen = `${window.screen.width} × ${window.screen.height}`
  let h = 0; for (const c of [os, browser, tz, screen, langs, cores, gpu].join('|')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const id = 'V-' + h.toString(16).slice(-4).toUpperCase().padStart(4, '0')
  return {
    id, hash: h, ms: Math.max(1, Math.round(performance.now() - t0)),
    os, browser, tz, city, time, langs, cores, gpu, referrer, scheme, screen,
    facts: [
      `You're on <b>${esc(os)}</b>, using <b>${esc(browser)}</b>.`,
      `Your clock reads <b>${esc(time)}</b>, <b>${esc(city)}</b> time.`,
      `Your screen is <b>${esc(screen)}</b>, and you prefer <b>${scheme} mode</b>.`,
      cores ? `Your machine has <b>${cores} cores</b>${gpu ? ` and a <b>${esc(gpu)}</b>` : ''}.` : `You read <b>${esc(langs)}</b>.`,
    ],
    rows: [['Device', `${os} · ${browser}`], ['Local time', `${time}, ${city}`], ['Display', `${screen} · ${scheme} mode`], ['Languages', langs], ['Hardware', cores ? `${cores} cores${gpu ? ' · ' + gpu : ''}` : 'undisclosed'], ['Arrived', referrer || 'directly']],
  }
}
