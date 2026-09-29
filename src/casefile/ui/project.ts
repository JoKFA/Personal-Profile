// Map a DOM box (0,0)–(w,h) onto a screen quadrilateral with a CSS matrix3d (a homography).
// Formula from RhineLabUI src/hud-projection.ts `hudQuadMatrix` (MIT, Copyright (c) 2026 LBEILC).
export type P = { x: number; y: number }

export function quadMatrix(width: number, height: number, quad: P[]): string {
  const [a, b, c, d] = quad
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y
  const det = dx1 * dy2 - dx2 * dy1
  const g = Math.abs(det) > 1e-9 ? (dx3 * dy2 - dx2 * dy3) / det : 0
  const h = Math.abs(det) > 1e-9 ? (dx1 * dy3 - dx3 * dy1) / det : 0
  const m = [(b.x - a.x + g * b.x) / width, (b.y - a.y + g * b.y) / width, 0, g / width,
    (d.x - a.x + h * d.x) / height, (d.y - a.y + h * d.y) / height, 0, h / height,
    0, 0, 1, 0, a.x, a.y, 0, 1]
  return `matrix3d(${m.map((v) => +v.toFixed(6)).join(',')})`
}
