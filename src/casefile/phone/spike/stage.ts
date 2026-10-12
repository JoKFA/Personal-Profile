// P0.2 phone spike stage: baked stills and clips only (no three.js, no scene code).
// Plain DOM driven from the video's media time (requestVideoFrameCallback), never from CSS transitions,
// except the 120 ms clip->still cross-fade, which is the handoff rule itself (plan 2.2).

type Pt = [number, number]
type Quad = Pt[]
interface Rect { x0: number; y0: number; x1: number; y1: number }
interface StillAsset { file: string; reticle?: Rect; quad?: Quad; die?: Pt }
interface ClipAsset { file: string; frames: number; fps: number; quads?: Quad[] }
interface Manifest { master: { w: number; h: number }; fps: number; assets: Record<string, StillAsset & ClipAsset> }

export type SpikeState = 'loading' | 'cover' | 'panning' | 'x001' | 'opening' | 'window'
export interface FrameRecord { clip: string; t: number; mediaTime: number; presented: number; index: number; quadIndex: number }
export interface Handoff { clip: string; cold: boolean; inputAt: number; playAt: number; firstFrameAt: number; latencyMs: number; endAt: number; stillShownAt: number }
export interface LayerInfo { name: string; el: HTMLImageElement | HTMLVideoElement; alpha: number; z: number }

export interface SpikeApi {
  state: SpikeState
  ready: boolean
  cold: boolean
  frames: FrameRecord[]
  handoffs: Handoff[]
  csp: string[]
  manifest: Manifest | null
  swipe(inputAt?: number): void
  open(inputAt?: number): void
  reset(): void
  show(name: 'cover' | 'x001' | 'window'): void
  layers(): LayerInfo[]
  marks(): Pt[]
}
declare global { interface Window { __spike?: SpikeApi } }

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const corners = (r: Rect): Quad => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]]

export function createSpike(root: HTMLElement): () => void {
  const q = new URLSearchParams(location.search)
  const dir = q.get('assets') ? `/phone-spike/${q.get('assets')}/` : '/phone-spike/'
  const cold = q.has('cold')
  // ?lead=N: the DOM's frame index runs N clip frames ahead of the presented frame (to measure the page layer's lag on the compositor)
  const lead = Number(q.get('lead') || 0)
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement) => { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e }
  const stage = el('div', 'sp-stage', root)
  const mkImg = (name: string, file: string) => { const i = el('img', 'sp-img', stage); i.alt = ''; i.draggable = false; i.dataset.layer = name; i.decoding = 'sync'; i.src = dir + file; return i }
  const imgs = { cover: mkImg('cover', 'stop-YW-000.webp'), x001: mkImg('x001', 'stop-X-001.webp'), window: mkImg('window', 'window-X-001.webp') }
  const mkVid = (name: string) => {
    const v = el('video', 'sp-vid', stage); v.dataset.layer = name
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '')
    return v
  }
  const vids = { pan: mkVid('pan'), open: mkVid('open') }
  const marks = [0, 1, 2, 3].map(() => el('i', 'sp-mk', stage))
  const bar = el('div', 'sp-bar', root)
  const btn = (label: string, id: string) => { const b = el('button', 'sp-btn', bar); b.textContent = label; b.dataset.id = id; b.type = 'button'; return b }
  const bSwipe = btn('Swipe up', 'swipe'), bOpen = btn('Open', 'open'), bReset = btn('Reset', 'reset')

  let manifest: Manifest | null = null
  let s = innerWidth / 390
  const markPos: Pt[] = [[0, 0], [0, 0], [0, 0], [0, 0]]
  const api: SpikeApi = {
    state: 'loading', ready: false, cold, frames: [], handoffs: [], csp: [], manifest: null,
    swipe: (t) => void swipe(t), open: (t) => void open(t), reset: () => void reset(), show: (n) => { showStill(n); place(n === 'window' ? manifest!.assets['window-X-001'].quad! : reticle(n === 'cover' ? 'stop-YW-000' : 'stop-X-001')) },
    layers: () => {
      const out: LayerInfo[] = []
      for (const [name, e] of Object.entries(imgs)) out.push({ name, el: e, alpha: Number(getComputedStyle(e).opacity), z: Number(getComputedStyle(e).zIndex) })
      for (const [name, e] of Object.entries(vids)) out.push({ name, el: e, alpha: Number(getComputedStyle(e).opacity), z: Number(getComputedStyle(e).zIndex) })
      return out.filter((l) => l.alpha > 0).sort((a, b) => a.z - b.z)
    },
    marks: () => markPos.map((p) => [p[0], p[1]] as Pt),
  }
  window.__spike = api
  const onCsp = (e: SecurityPolicyViolationEvent) => api.csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`)
  document.addEventListener('securitypolicyviolation', onCsp)

  const layout = () => {
    s = innerWidth / 390
    stage.style.width = `${390 * s}px`; stage.style.height = `${866 * s}px`
    place(markPos)
  }
  const place = (p: Pt[]) => { p.forEach(([x, y], i) => { markPos[i] = [x, y]; marks[i].style.transform = `translate(${x * s}px, ${y * s}px)` }) }
  const showStill = (n: 'cover' | 'x001' | 'window') => { for (const [k, e] of Object.entries(imgs)) e.style.opacity = k === n ? '1' : '0' }
  const reticle = (name: string) => corners(manifest!.assets[name].reticle!)
  const setButtons = () => {
    bSwipe.disabled = api.state !== 'cover'; bOpen.disabled = api.state !== 'x001'; bReset.disabled = api.state !== 'window'
    root.dataset.state = api.state
  }
  const setState = (st: SpikeState) => { api.state = st; setButtons() }

  // the sources: warm = both clips loaded up front; cold = a clip's source is set at the tap
  const clipFile = { pan: 'pan-YW-000-X-001', open: 'open-X-001' } as const
  const attach = (k: 'pan' | 'open') => { const v = vids[k]; v.src = dir + manifest!.assets[clipFile[k]].file; v.load() }
  const ready = (v: HTMLVideoElement) => v.readyState >= 3 ? Promise.resolve() : new Promise<void>((res) => { const f = () => { if (v.readyState >= 3) { v.removeEventListener('canplay', f); v.removeEventListener('loadeddata', f); res() } }; v.addEventListener('canplay', f); v.addEventListener('loadeddata', f) })

  let busy = false
  /** image -> clip -> image, with the handoff rules of plan 2.2 */
  async function playClip(k: 'pan' | 'open', inputAt: number, from: 'cover' | 'x001', to: 'x001' | 'window', onFrame: (index: number, mediaTime: number) => void): Promise<void> {
    const v = vids[k], asset = manifest!.assets[clipFile[k]], name = clipFile[k]
    if (!v.getAttribute('src')) attach(k)
    await ready(v)
    const fps = asset.fps, last = asset.frames - 1
    const h: Handoff = { clip: name, cold, inputAt, playAt: 0, firstFrameAt: 0, latencyMs: 0, endAt: 0, stillShownAt: 0 }
    return new Promise<void>((resolve) => {
      let first = true, ended = false
      const end = () => {
        if (ended) return; ended = true
        h.endAt = performance.now()
        // the still appears under the clip's last frame (the video is above the stills now), then the clip fades out over 120 ms
        showStill(to); h.stillShownAt = performance.now()
        v.classList.add('fade'); v.style.opacity = '0'
        let done = false
        const fin = () => { if (done) return; done = true; v.classList.remove('fade'); v.style.zIndex = ''; v.style.opacity = ''; try { v.currentTime = 0 } catch { /* */ } api.handoffs.push(h); resolve() }
        v.addEventListener('transitionend', fin, { once: true }); setTimeout(fin, 200)
      }
      // a presented frame: requestVideoFrameCallback where it exists; otherwise the video's clock, polled each animation frame (a proxy: it moves when the picture does)
      const hasRvfc = typeof v.requestVideoFrameCallback === 'function'
      let seen = v.currentTime, polled = 0
      const nextFrame = () => {
        if (hasRvfc) { v.requestVideoFrameCallback(cb); return }
        const poll = (now: number) => { if (ended) return; if (v.currentTime !== seen) { seen = v.currentTime; cb(now, { mediaTime: seen, presentedFrames: ++polled } as VideoFrameCallbackMetadata) } else requestAnimationFrame(poll) }
        requestAnimationFrame(poll)
      }
      const cb = (now: number, meta: VideoFrameCallbackMetadata) => {
        if (first) {
          first = false; h.firstFrameAt = now; h.latencyMs = now - h.inputAt
          // the clip's first frame is on the compositor: now the still can go
          v.style.zIndex = '3'; imgs[from].style.opacity = '0'
        }
        const index = Math.round(meta.mediaTime * fps), qi = Math.min(last, Math.max(0, index + lead))
        onFrame(qi, meta.mediaTime)
        api.frames.push({ clip: name, t: now, mediaTime: meta.mediaTime, presented: meta.presentedFrames, index, quadIndex: qi })
        if (index >= last) end(); else nextFrame()
      }
      v.addEventListener('ended', end, { once: true })
      nextFrame()
      h.playAt = performance.now()
      void v.play().catch(() => end())
    })
  }

  async function swipe(inputAt = performance.now()) {
    if (busy || api.state !== 'cover' || !manifest) return
    busy = true; setState('panning')
    const a = reticle('stop-YW-000'), b = reticle('stop-X-001'), dur = manifest.assets[clipFile.pan].frames / manifest.fps
    await playClip('pan', inputAt, 'cover', 'x001', (_i, mt) => { const k = smooth(mt / dur); place(a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)] as Pt)) })
    place(b); setState('x001'); busy = false
  }
  async function open(inputAt = performance.now()) {
    if (busy || api.state !== 'x001' || !manifest) return
    busy = true; setState('opening')
    const quads = manifest.assets[clipFile.open].quads!, ret = reticle('stop-X-001')
    await playClip('open', inputAt, 'x001', 'window', (i, mt) => {
      // as overlay.ts: the reticle's corners lock onto the face's corners (0.16 s), each taking the nearest free one, then ride them
      const lock = smooth(mt / 0.16), used = new Set<number>(), out: Pt[] = []
      ret.forEach(([x, y], c) => {
        let best = 0, bd = Infinity
        quads[i].forEach((p, j) => { if (used.has(j)) return; const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = j } })
        used.add(best); out[c] = [lerp(x, quads[i][best][0], lock), lerp(y, quads[i][best][1], lock)]
      })
      place(out)
    })
    setState('window'); busy = false
  }
  async function reset() {
    if (busy || api.state !== 'window') return
    for (const k of ['pan', 'open'] as const) { const v = vids[k]; if (cold) { v.removeAttribute('src'); v.load() } else { try { v.currentTime = 0 } catch { /* */ } } }
    showStill('cover'); place(reticle('stop-YW-000')); setState('cover')
  }

  // gestures: a vertical drag past 12 px starts the pan at once (pointer events: touch and mouse alike)
  let sy = 0, tracking = false
  const down = (e: PointerEvent) => { sy = e.clientY; tracking = true }
  const move = (e: PointerEvent) => { if (tracking && sy - e.clientY > 12) { tracking = false; void swipe(e.timeStamp) } }
  const up = () => { tracking = false }
  root.addEventListener('pointerdown', down); root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up)
  bSwipe.addEventListener('click', (e) => void swipe(e.timeStamp)); bOpen.addEventListener('click', (e) => void open(e.timeStamp)); bReset.addEventListener('click', () => void reset())
  addEventListener('resize', layout)
  layout(); setButtons()

  let dead = false
  void (async () => {
    manifest = await (await fetch(dir + 'manifest.json')).json() as Manifest
    api.manifest = manifest
    if (dead) return
    if (!cold) { attach('pan'); attach('open') }
    await Promise.all([...Object.values(imgs).map((i) => i.decode().catch(() => undefined)), ...(cold ? [] : [ready(vids.pan), ready(vids.open)])])
    if (dead) return
    showStill('cover'); place(reticle('stop-YW-000')); setState('cover'); api.ready = true
  })()

  return () => {
    dead = true; removeEventListener('resize', layout); document.removeEventListener('securitypolicyviolation', onCsp)
    root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up)
    stage.remove(); bar.remove(); delete window.__spike
  }
}
