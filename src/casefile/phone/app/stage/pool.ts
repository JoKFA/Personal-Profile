// A pool of 2-3 <video> elements reused for every clip by swapping `src` (plan §2.4). Muted + inline so the browser may play them
// without a gesture; the first touch "primes" each one (play then pause) to unlock them on iOS.
export class VideoPool {
  readonly els: HTMLVideoElement[] = []
  private used = new Map<HTMLVideoElement, number>()
  private clock = 0
  /** play() goes through here so a forced rejection (?phone-reject) and the real thing share a path */
  play: (v: HTMLVideoElement) => Promise<void> = (v) => v.play()

  constructor(parent: HTMLElement, n = 3) {
    for (let i = 0; i < n; i++) {
      const v = document.createElement('video'); v.className = 'ph-vid'
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto'; v.disablePictureInPicture = true
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1
      v.disableRemotePlayback = true
      // P6a: inline only, no controls, no way to full screen, no AirPlay, nothing to download
      v.controls = false; v.autoplay = false; v.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback'); v.setAttribute('x-webkit-airplay', 'deny'); v.setAttribute('disablepictureinpicture', '')
      parent.appendChild(v); this.els.push(v); this.used.set(v, 0)
    }
  }

  holding(key: string) { return this.els.find((v) => v.dataset.key === key) }
  touch(v: HTMLVideoElement) { this.used.set(v, ++this.clock) }

  /** put `key` on the least recently used element that is not busy; returns it (null when all are busy) */
  assign(key: string, url: string, busy: ReadonlySet<HTMLVideoElement> = new Set()): HTMLVideoElement | null {
    const have = this.holding(key)
    if (have) { this.touch(have); return have }
    let pick: HTMLVideoElement | null = null, at = Infinity
    for (const v of this.els) if (!busy.has(v) && (this.used.get(v) ?? 0) < at) { at = this.used.get(v) ?? 0; pick = v }
    if (!pick) return null
    pick.dataset.key = key; pick.src = url; pick.style.visibility = ''; pick.load(); this.touch(pick)   // (the interior's player hides an element it has released: a new clip on it shows)
    return pick
  }
  /** keep these keys, free the elements holding anything else (their buffers go with the source) */
  release(except: Set<string>) {
    for (const v of this.els) if (v.dataset.key && !except.has(v.dataset.key) && v.classList.contains('on') === false) { v.removeAttribute('src'); delete v.dataset.key; v.load() }
  }
  /** every element given a source again (after a bfcache restore the buffers may be gone) */
  reattach() { for (const v of this.els) if (v.dataset.key) { const s = v.getAttribute('src'); if (s) { v.src = s; v.load() } } }
}
