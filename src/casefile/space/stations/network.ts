// 1 · Network engineering (X-008), drawn. Three remote sites reach the campus router over MPLS L3VPN
// (curves), a core switch carries the VLANs, a firewall (a glass wall etched with bricks, with a gate)
// stands between the users and the servers, and a SIEM watches. Business light runs through the
// gate all the time; a request from outside the zone hits the wall and is stopped; the SIEM keeps it.
import * as THREE from 'three'
import { ALERT, Art, CHAMPAGNE, circle, INK_SOFT, OLIVE, pane, rrect, smoothPath, type P2 } from '../art'
import { clamp01, COLOR, mix, win } from '../kit'
import type { Build, Station } from '../station'
import { evidencePlate, plinth } from './common'
import { along, at, edge, etch, FLOOR_Y, node, packet } from './flat'

export const buildNetwork: Build = (kit) => {
  const group = new THREE.Group(); group.name = 'station-network'
  plinth(group, kit, 21, 13.5)
  const A = new Art(group, 'flat', [0, FLOOR_Y, 0])
  etch(A, 21, 13.5, 1)

  // ── nodes: icons on floating tiles ──
  const sites = [node(A, kit, -7.8, 3.9, 'site', { size: 3 }), node(A, kit, -7.8, 0.5, 'site', { size: 3 }), node(A, kit, -7.8, -2.9, 'site', { size: 3 })]
  const router = node(A, kit, -3.6, 0.5, 'router', { size: 3.6 }), core = node(A, kit, 0.8, 0.5, 'coreSwitch', { size: 3.6 })
  const srvA = node(A, kit, 7.4, 2.8, 'server', { size: 3.2 }), srvB = node(A, kit, 7.4, -1.2, 'server', { size: 3.2 })
  const siem = node(A, kit, 4.8, 5.0, 'siem', { size: 3.2 }), laptop = node(A, kit, -0.6, -4.2, 'laptop', { size: 3.2 })
  const nodes = [...sites, router, core, srvA, srvB, siem, laptop]

  // ── the zone the wall protects ──
  const zone = A.stroke(rrect(7.4, 0.8, 4.8, 8.0, 0.6), { w: 0.06, color: CHAMPAGNE, opacity: 0.7, closed: true, z: 0.02 })

  // ── edges ──
  const links = sites.map((s) => edge(A, smoothPath([[s.u + 1.5, s.v], [-5.7, (s.v + 0.5) / 2], [-5.6, 0.5]]), { color: CHAMPAGNE, w: 0.07, opacity: 0.9 }))
  const eRC = edge(A, [[-1.8, 0.5], [-1.0, 0.5]])
  const pA: P2[] = [[2.6, 0.5], [3.6, 0.5], [5.4, 0.5], [5.4, 2.8], [5.8, 2.8]], pB: P2[] = [[5.4, 0.5], [5.4, -1.2], [5.8, -1.2]]
  const eA = edge(A, pA), eB = edge(A, pB)
  const pAtk: P2[] = [[1.2, -4.2], [2.6, -3.6], [3.5, -2.4]]
  const eAtk = edge(A, pAtk, { color: ALERT, w: 0.09, opacity: 0.95, glow: true })
  const eMon = edge(A, [[3.6, 3.8], [4.0, 4.4], [4.2, 4.6]], { w: 0.05, color: INK_SOFT })

  // ── the wall: a pane standing across the traffic, bricks etched on it, a gate in it ──
  const P = new Art(group, 'stand', [3.6, FLOOR_Y, 3.8], Math.PI / 2)
  const WL = 8.0, WH = 4.2
  pane(P, WL, WH, { x: WL / 2, r: 0.3, opacity: 0.3 })
  const GATE: [number, number] = [3.3, 4.7]
  const course = (v: number) => { const segs: [number, number][] = v < 1.9 ? [[0.1, GATE[0]], [GATE[1], WL - 0.1]] : [[0.1, WL - 0.1]]; for (const [a, b] of segs) P.stroke([[a, v], [b, v]], { w: 0.04, color: INK_SOFT, opacity: 0.7, z: 0.01 }) }
  const rows = 7, bh = WH / rows
  for (let r = 1; r < rows; r++) course(r * bh)
  for (let r = 0; r < rows; r++) for (let c = 0; c < 14; c++) { const u = 0.1 + (c + (r % 2 ? 0.5 : 0)) * 0.53; if (u > WL - 0.2 || (u > GATE[0] - 0.05 && u < GATE[1] + 0.05 && r * bh < 1.9)) continue; P.stroke([[u, r * bh], [u, (r + 1) * bh]], { w: 0.04, color: INK_SOFT, opacity: 0.7, z: 0.01 }) }
  P.stroke([[GATE[0], 0], [GATE[0], 1.9], [GATE[1], 1.9], [GATE[1], 0]], { w: 0.09, color: CHAMPAGNE, opacity: 1, z: 0.02 })
  const flash = P.fill(rrect(1.4, 1.9, 2.0, 2.0, 0.4), { color: ALERT, opacity: 0, z: 0.03, order: 3 })
  const ring = P.stroke(circle(1.4, 1.9, 0.65, 36), { w: 0.07, color: ALERT, glow: true, closed: true, z: 0.04 })

  // ── packets ──
  const biz = [packet(A), packet(A), packet(A)], bizB = [packet(A), packet(A)]
  const sitePath = smoothPath([[sites[1].u + 1.5, 0.5], [-5.7, 0.5], [-5.4, 0.5]]), pathAB = [...sitePath, [-1.8, 0.5] as P2, [-1.0, 0.5] as P2, ...pA]
  const atk = packet(A, ALERT, 0.2)
  const plate = evidencePlate(group, kit, [4.4, 0.6, 5.6], 0.1)

  const station: Station = {
    group,
    anchors: { sites: [...at(-7.8, 3.9, 1.4)], core: [...at(0.8, 0.5, 1.6)], wall: [3.6, FLOOR_Y + 4.4, -1.0], siem: [...at(4.8, 5.0, 1.6)], servers: [...at(7.4, 0.8, 1.8)], laptop: [...at(-0.6, -4.2, 1.4)] },
    result: { at: [3.6, 1.8, -0.8], halfH: 5.6, yaw: -0.3, elev: 0.62 },
    plate: plate.object,
    set(p, t, a) {
      // the tiles rise in, left to right, as the camera comes in; the lines are then drawn
      nodes.forEach((n, i) => n.pop(win(a, i * 0.05, i * 0.05 + 0.5)))
      zone.draw(win(a, 0.3, 0.8)); P.group.scale.y = 0.001 + 0.999 * win(a, 0.2, 0.7); P.group.visible = a > 0.2
      links.forEach((l, i) => l.draw(win(p, 0.06 + i * 0.01, 0.16 + i * 0.01))); eRC.draw(win(p, 0.1, 0.17)); eA.draw(win(p, 0.12, 0.2)); eB.draw(win(p, 0.13, 0.21)); eMon.draw(win(p, 0.14, 0.22))
      // business light runs through the gate for as long as the network is up
      const live = win(p, 0.14, 0.22) > 0.5
      biz.forEach((b, i) => { const s = (t * 0.08 + i / 3) % 1, q = along(pathAB, s); b.mesh.visible = live; b.mesh.position.set(q[0], q[1], 0.12) })
      bizB.forEach((b, i) => { const s = (t * 0.1 + i / 2) % 1, q = along([...pathAB.slice(0, 18), ...pB.slice(1)], s); b.mesh.visible = live && s > 0.5; b.mesh.position.set(q[0], q[1], 0.12) })
      // the request: draws toward the wall, and is stopped there
      const go = win(p, 0.3, 0.52), back = win(p, 0.6, 0.74), hit = p > 0.52 ? clamp01(1 - (p - 0.52) / 0.22) : 0
      eAtk.draw(win(p, 0.28, 0.34))
      atk.mesh.visible = p > 0.3 && back < 1; { const q = along(pAtk, go * (1 - back)); atk.mesh.position.set(q[0], q[1], 0.14) }
      ;(flash.material as THREE.MeshBasicMaterial).opacity = 0.55 * hit
      ring.draw(p > 0.52 ? 1 : 0); ring.mesh.scale.setScalar(1 + (1 - hit) * 1.2); ring.opacity(0.9 * (hit * 0.8 + 0.2))
      eAtk.color(p > 0.52 ? ALERT : ALERT)
      // the SIEM takes it in: red, then kept in champagne
      const kept = win(p, 0.86, 0.96)
      eMon.pulse(p > 0.58 && p < 0.9 ? { x: win(p, 0.58, 0.72), w: 0.18 } : null); eMon.color(p > 0.6 ? (kept > 0.5 ? CHAMPAGNE : ALERT) : INK_SOFT)
      siem.art.group.children.forEach(() => undefined)
      void OLIVE; void COLOR; void mix
      plate.land(win(p, 0.88, 1))
    },
    dispose() { A.dispose(); P.dispose() },
  }
  return station
}
