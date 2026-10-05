// The visitor's browser fingerprint drawn as a real fingerprint (spec §30): an orientation field
// with cores and deltas (Sherlock–Monro), evenly spaced ridges traced along it (Jobard–Lefer),
// inked with pressure, breaks and pores; then pulled into the 16 × 16 bits of its SHA-256.
// Everything is seeded by the hash, so the same browser always gets the same print.

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
export const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const eout = (t: number) => 1 - Math.pow(1 - t, 3)
export const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function makeNoise(rnd: () => number) {
  const perm = new Uint8Array(512), val = new Float32Array(256)
  for (let i = 0; i < 256; i++) { val[i] = rnd(); perm[i] = i }
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, s = perm[i]; perm[i] = perm[j]; perm[j] = s }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]], c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]]
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

// SHA-256 (FIPS 180-4), synchronous so the print is ready on the first frame (crypto.subtle is async)
const primes = (n: number) => { const p: number[] = []; for (let k = 2; p.length < n; k++) if (p.every((q) => k % q)) p.push(k); return p }
const SHA_K = primes(64).map((q) => ((Math.cbrt(q) % 1) * 2 ** 32) >>> 0)
const SHA_H = primes(8).map((q) => ((Math.sqrt(q) % 1) * 2 ** 32) >>> 0)
export function sha256(msg: string) {
  const bytes = new TextEncoder().encode(msg), l = bytes.length, total = ((l + 9 + 63) >> 6) << 6
  const buf = new Uint8Array(total); buf.set(bytes); buf[l] = 0x80
  const dv = new DataView(buf.buffer); dv.setUint32(total - 4, (l * 8) >>> 0); dv.setUint32(total - 8, Math.floor((l * 8) / 2 ** 32))
  const H = SHA_H.slice(), W = new Uint32Array(64)
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4)
    for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) | 0 }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + W[i]) | 0
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

export interface Box { cx: number; cy: number; w: number; h: number }
export interface Print extends Box {
  seed: number; dsep: number; step: number; lines: Float32Array[]; whorl: boolean
  mask: (x: number, y: number) => number; noise: (x: number, y: number) => number
  minutiae: { x: number; y: number }[]
}

export function buildPrint(hex: string, box: Box): Print {
  const seed = parseInt(hex.slice(0, 8), 16) >>> 0
  const rnd = mulberry32(seed), noise = makeNoise(mulberry32(seed ^ 0x9e3779b9))
  const { cx, cy, w, h } = box, ax = w / 2, ay = h / 2
  const whorl = rnd() < 0.45, side = rnd() < 0.5 ? -1 : 1, j = (s: number) => (rnd() - 0.5) * s
  const cores = whorl ? [[-0.07 + j(0.06), -0.13 + j(0.05)], [0.08 + j(0.06), 0.03 + j(0.05)]] : [[side * 0.06 + j(0.08), -0.1 + j(0.06)]]
  const deltas = whorl ? [[-0.62 + j(0.06), 0.5 + j(0.05)], [0.62 + j(0.06), 0.48 + j(0.05)]] : [[-side * 0.54 + j(0.08), 0.52 + j(0.06)]]
  const nox = rnd() * 50, noy = rnd() * 50
  const theta = (x: number, y: number) => {
    const u = (x - cx) / ax, v = (y - cy) / ay
    let a = 0
    for (const d of deltas) a += Math.atan2(v - d[1], u - d[0])
    for (const c of cores) a -= Math.atan2(v - c[1], u - c[0])
    return a * 0.5 + 1.0 * u * sstep(0.05, -0.95, v) + 0.24 * (noise(u * 1.7 + nox, v * 1.7 + noy) - 0.5)
  }
  const mask = (x: number, y: number) => {
    const u = (x - cx) / ax, v = (y - cy) / ay, vv = v < 0 ? -v : v * 1.06
    return Math.pow(Math.abs(u) * (1 + 0.1 * Math.max(0, v)), 2.4) + Math.pow(vv, 2.1) + 0.07 * (noise(u * 3.2 + 17, v * 3.2 + 9) - 0.5)
  }
  const dsep = Math.max(4.6, h / 66), dtest = dsep * 0.5, step = dsep * 0.22
  const cs = dsep, gx0 = cx - ax - cs * 2, gy0 = cy - ay - cs * 2
  const gw = Math.ceil((w + cs * 4) / cs), gh = Math.ceil((h + cs * 4) / cs)
  const grid: number[][] = Array.from({ length: gw * gh }, () => [])
  const sing = [...cores, ...deltas].map(([u, v]) => [cx + u * ax, cy + v * ay])
  const selfGap = Math.ceil((dsep * 3) / step), maxSteps = Math.ceil(((w + h) * 3) / step)
  const cellOf = (x: number, y: number) => { const i = Math.floor((x - gx0) / cs), k = Math.floor((y - gy0) / cs); return i < 0 || k < 0 || i >= gw || k >= gh ? -1 : k * gw + i }
  const crowded = (x: number, y: number, d: number, line: number, idx: number) => {
    const rr = Math.ceil(d / cs), ci = Math.floor((x - gx0) / cs), ck = Math.floor((y - gy0) / cs), d2 = d * d
    for (let k = ck - rr; k <= ck + rr; k++) {
      if (k < 0 || k >= gh) continue
      for (let i = ci - rr; i <= ci + rr; i++) {
        if (i < 0 || i >= gw) continue
        const cell = grid[k * gw + i]
        for (let q = 0; q < cell.length; q += 4) {
          const dx = cell[q] - x, dy = cell[q + 1] - y
          if (dx * dx + dy * dy < d2 && (cell[q + 2] !== line || Math.abs(cell[q + 3] - idx) > selfGap)) return true
        }
      }
    }
    return false
  }
  const dir = (x: number, y: number, px: number, py: number): [number, number] => { const a = theta(x, y); let dx = Math.cos(a), dy = Math.sin(a); if (dx * px + dy * py < 0) { dx = -dx; dy = -dy } return [dx, dy] }
  const nearSing = (x: number, y: number, d: number) => sing.some(([sx, sy]) => (sx - x) ** 2 + (sy - y) ** 2 < d * d)
  const lines: Float32Array[] = []
  let lineId = 0
  function trace(sx: number, sy: number): Float32Array | null {
    if (mask(sx, sy) > 0.97 || nearSing(sx, sy, dsep * 0.6) || crowded(sx, sy, dsep * 0.92, -1, 0)) return null
    const id = lineId++, touched = new Set<number>()
    const put = (x: number, y: number, idx: number) => { const c = cellOf(x, y); if (c >= 0) { grid[c].push(x, y, id, idx); touched.add(c) } }
    put(sx, sy, 0)
    const [d0x, d0y] = dir(sx, sy, 1, 0.0001)
    const run = (px0: number, py0: number, sign: number) => {
      const out: number[] = []
      let x = sx, y = sy, px = px0, py = py0, idx = 0
      for (let s = 0; s < maxSteps; s++) {
        const [dx, dy] = dir(x, y, px, py), [ex, ey] = dir(x + dx * step * 0.5, y + dy * step * 0.5, dx, dy)
        const nx = x + ex * step, ny = y + ey * step
        idx += sign
        if (mask(nx, ny) > 1 || nearSing(nx, ny, dsep * 0.45) || crowded(nx, ny, dtest, id, idx)) break
        x = nx; y = ny; px = ex; py = ey
        put(x, y, idx); out.push(x, y)
      }
      return out
    }
    const fwd = run(d0x, d0y, 1), bwd = run(-d0x, -d0y, -1)
    const n = (fwd.length + bwd.length) / 2 + 1
    if (n * step < dsep * 2.4) {
      for (const c of touched) { const a = grid[c], keep: number[] = []; for (let q = 0; q < a.length; q += 4) if (a[q + 2] !== id) keep.push(a[q], a[q + 1], a[q + 2], a[q + 3]); grid[c] = keep }
      return null
    }
    const pts = new Float32Array(n * 2)
    let o = 0
    for (let q = bwd.length - 2; q >= 0; q -= 2) { pts[o++] = bwd[q]; pts[o++] = bwd[q + 1] }
    pts[o++] = sx; pts[o++] = sy
    for (let q = 0; q < fwd.length; q++) pts[o++] = fwd[q]
    lines.push(pts)
    return pts
  }
  // evenly spaced ridges (Jobard–Lefer): every accepted ridge seeds its neighbours one ridge-width away
  const queue: Float32Array[] = []
  const grow = () => {
    while (queue.length) {
      const L = queue.shift()!, n = L.length / 2, k = Math.max(1, Math.round(dsep / step))
      for (let i = 0; i < n; i += k) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1)
        let tx = L[b * 2] - L[a * 2], ty = L[b * 2 + 1] - L[a * 2 + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl
        for (const sg of [1, -1]) { const s = trace(L[i * 2] - ty * dsep * sg, L[i * 2 + 1] + tx * dsep * sg); if (s) queue.push(s) }
      }
    }
  }
  const s0 = trace(cx, cy + ay * 0.55) || trace(cx + ax * 0.3, cy + ay * 0.2)
  if (s0) queue.push(s0)
  grow()
  // whatever the front could not reach (around the cores and deltas)
  for (let y = cy - ay; y < cy + ay; y += dsep * 0.7) for (let x = cx - ax; x < cx + ax; x += dsep * 0.7) { const s = trace(x, y); if (s) { queue.push(s); grow() } }

  // minutiae: ridge endings well inside the print, one in each quarter, on the side the labels are
  const ends: { x: number; y: number }[] = []
  lines.forEach((p) => {
    const n = p.length / 2
    if (n * step < dsep * 5) return
    for (const e of [0, n - 1]) { const x = p[e * 2], y = p[e * 2 + 1]; if (mask(x, y) < 0.7 && !nearSing(x, y, dsep * 2.6)) ends.push({ x, y }) }
  })
  const picks: { x: number; y: number }[] = []
  for (let b = 0; b < 4; b++) {
    const y0 = cy - ay * 0.7 + (b * ay * 1.4) / 4, y1 = y0 + (ay * 1.4) / 4, want = cx + ax * (b % 2 ? 0.42 : 0.2)
    const ok = (e: { x: number; y: number }, d: number) => e.y >= y0 && e.y < y1 && e.x > cx && picks.every((p) => Math.hypot(p.x - e.x, p.y - e.y) > d)
    const near = (a: { x: number }, z: { x: number }) => Math.abs(a.x - want) - Math.abs(z.x - want)
    const c = ends.filter((e) => ok(e, dsep * 7)).sort(near)[0] || ends.filter((e) => ok(e, dsep * 2)).sort(near)[0]
    picks.push(c || { x: want, y: (y0 + y1) / 2 })
  }
  return { seed, cx, cy, w, h, dsep, step, lines, mask, noise, minutiae: picks, whorl }
}

export interface Inked { ink: HTMLCanvasElement; glow: HTMLCanvasElement; x0: number; y0: number; w: number; h: number }
/** The print in ink (pressure, starved ink, breaks, pores) and the same ridges as light, for the scan. */
export function paintPrint(P: Print, dpr: number, ink: string): Inked {
  const pad = 32, x0 = P.cx - P.w / 2 - pad, y0 = P.cy - P.h / 2 - pad
  const make = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
    const c = document.createElement('canvas'); c.width = Math.ceil((P.w + pad * 2) * dpr); c.height = Math.ceil((P.h + pad * 2) * dpr)
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr); g.lineCap = 'round'; g.lineJoin = 'round'; return [c, g]
  }
  const [inkC, gi] = make(), [glowC, gg] = make(), rnd = mulberry32(P.seed ^ 0x51ed27), chunk = 3
  const stroke = (g: CanvasRenderingContext2D, pts: Float32Array, a: number, b: number, dx: number, dy: number) => { g.beginPath(); g.moveTo(pts[a * 2] + dx, pts[a * 2 + 1] + dy); for (let i = a + 1; i <= b; i++) g.lineTo(pts[i * 2] + dx, pts[i * 2 + 1] + dy); g.stroke() }
  for (const pts of P.lines) {
    const n = pts.length / 2
    let skip = 0
    for (let i = 0; i < n - 1; i += chunk) {
      const e = Math.min(n - 1, i + chunk)
      if (skip > 0) { skip--; continue }
      if (rnd() < 0.014) { skip = rnd() < 0.65 ? 0 : 1; continue } // a break in the ridge
      const mx = pts[i * 2], my = pts[i * 2 + 1], m = P.mask(mx, my), fade = sstep(1.0, 0.76, m)
      if (fade <= 0.01) continue
      // pressure: inkier in the middle of the pad, lighter where it lifts off; the ink itself is uneven
      const press = P.noise(mx * 0.009 + 5, my * 0.009 + 3), starve = P.noise(mx * 0.07 + 40, my * 0.07 + 12)
      const wv = P.dsep * (0.08 + 0.21 * press) * (1.15 - 0.4 * m), a = fade * (0.62 + 0.38 * starve)
      gi.lineWidth = wv; gi.globalAlpha = 0.5 * a; gi.strokeStyle = '#fbf9f4'; stroke(gi, pts, i, e, 0.5, 0.7)
      gi.globalAlpha = 0.94 * a; gi.strokeStyle = ink; stroke(gi, pts, i, e, 0, 0)
      gg.lineWidth = wv * 2.8; gg.globalAlpha = 0.32 * fade; gg.strokeStyle = '#f0d49a'; stroke(gg, pts, i, e, 0, 0)
      gg.lineWidth = Math.max(0.6, wv * 0.9); gg.globalAlpha = 0.95 * fade; gg.strokeStyle = '#fff6df'; stroke(gg, pts, i, e, 0, 0)
      // a pore: a pinprick of paper inside a wide ridge
      if (wv > P.dsep * 0.17 && rnd() < 0.16) { const q = i + ((rnd() * chunk) | 0); gi.globalAlpha = 0.85; gi.fillStyle = '#eeebe4'; gi.beginPath(); gi.arc(pts[q * 2], pts[q * 2 + 1], wv * 0.26, 0, Math.PI * 2); gi.fill() }
    }
  }
  return { ink: inkC, glow: glowC, x0, y0, w: P.w + pad * 2, h: P.h + pad * 2 }
}

export interface Morph {
  parts: { x: number; y: number; tx: number; ty: number; kx: number; ky: number; dl: number; dur: number; fade: number }[]
  cells: { i: number; j: number; x: number; y: number; dl: number }[]
  c: number
}
/** The hash pulls the ridges into its own 16 × 16 bits: far points leave first, so all land together. */
export function buildMorph(P: Print, lat: { cx: number; cy: number; size: number }): Morph {
  const n = 16, c = lat.size / n, x0 = lat.cx - lat.size / 2, y0 = lat.cy - lat.size / 2, maxD = Math.hypot(lat.size, P.h) / 2
  const rnd = mulberry32(P.seed ^ 0xa5a5a5), parts: Morph['parts'] = []
  for (const pts of P.lines) {
    const m = pts.length / 2, every = Math.max(1, Math.round((P.dsep * 1.05) / P.step))
    for (let i = (rnd() * every) | 0; i < m; i += every) {
      const x = pts[i * 2], y = pts[i * 2 + 1], fade = sstep(1.0, 0.8, P.mask(x, y)); if (fade < 0.05) continue
      const cj = clamp(Math.floor((x - x0) / c), 0, n - 1), ci = clamp(Math.floor((y - y0) / c), 0, n - 1)
      const tx = x0 + (cj + 0.5 + (rnd() - 0.5) * 0.45) * c, ty = y0 + (ci + 0.5 + (rnd() - 0.5) * 0.45) * c
      const dx = tx - x, dy = ty - y, bend = (rnd() - 0.5) * 0.4
      const q = clamp(Math.hypot(dx, dy) / (maxD * 0.9))
      parts.push({ x, y, tx, ty, kx: x + dx * 0.5 - dy * bend, ky: y + dy * 0.5 + dx * bend, dl: 0.3 * (1 - q) + rnd() * 0.06, dur: 0.4 + 0.3 * q, fade })
    }
  }
  const cells: Morph['cells'] = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = x0 + (j + 0.5) * c, y = y0 + (i + 0.5) * c
    cells.push({ i, j, x, y, dl: (0.3 * Math.hypot(x - lat.cx, y - lat.cy)) / maxD })
  }
  return { parts, cells, c }
}
