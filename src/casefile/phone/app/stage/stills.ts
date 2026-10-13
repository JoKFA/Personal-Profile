// The stage's pictures: a few <img> elements, at most `limit` alive at once (each decodes to about 12 MB). The least recently
// used one that is not pinned is released when a new one comes (its element is removed and its source emptied).
export class Stills {
  private els = new Map<string, HTMLImageElement>()
  private loading = new Map<string, Promise<void>>()
  private used = new Map<string, number>()
  private clock = 0
  private parent: HTMLElement
  readonly limit: number
  constructor(parent: HTMLElement, limit = 6) { this.parent = parent; this.limit = limit }

  get alive() { return this.els.size }
  keys() { return [...this.els.keys()] }
  has(key: string) { return this.els.has(key) }
  get(key: string) { const e = this.els.get(key); if (e) this.used.set(key, ++this.clock); return e }

  /** make sure `key` is loaded and decoded; `pinned` keys are never released to make room */
  load(key: string, url: string, pinned: Iterable<string> = []): Promise<void> {
    const have = this.loading.get(key)
    if (have && this.els.has(key)) { this.used.set(key, ++this.clock); return have }
    const img = document.createElement('img')
    img.className = 'ph-img'; img.alt = ''; img.draggable = false; img.decoding = 'async'; img.dataset.key = key
    img.src = url
    this.parent.appendChild(img); this.els.set(key, img); this.used.set(key, ++this.clock)
    const p = img.decode().catch(() => undefined)
    this.loading.set(key, p)
    this.evict(new Set([...pinned, key]))
    return p
  }

  /** resolves when `key`'s picture is decoded (immediately when it is not loading) */
  ready(key: string) { return this.loading.get(key) ?? Promise.resolve() }

  evict(pinned: Set<string>) {
    while (this.els.size > this.limit) {
      let victim: string | null = null, at = Infinity
      for (const k of this.els.keys()) if (!pinned.has(k) && (this.used.get(k) ?? 0) < at) { at = this.used.get(k) ?? 0; victim = k }
      if (!victim) return
      this.drop(victim)
    }
  }
  drop(key: string) {
    const e = this.els.get(key); if (!e) return
    e.removeAttribute('src'); e.remove()
    this.els.delete(key); this.loading.delete(key); this.used.delete(key)
  }
  /** the picture on top of the others: the one with opacity 1 */
  show(key: string) {
    for (const [k, e] of this.els) { e.classList.remove('fadeout'); if (k === key) { e.style.opacity = '1'; e.style.zIndex = '' } else e.style.opacity = '0' }
  }
}
