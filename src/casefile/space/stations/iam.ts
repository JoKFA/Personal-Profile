// 2 · Cloud security & IAM (SR-02), drawn. A workload identity (a badge) reaches the cloud's resources
// through a policy, an aperture in a glass wall. First its reach is a wide fan covering everything
// (`s3:*` on `*`); the policy narrows it until one beam reaches the one resource the job needs. A
// request for the other is stopped at the aperture and that resource is locked.
import * as THREE from 'three'
import { ALERT, Art, CHAMPAGNE, circle, INK, INK_SOFT, OLIVE, pane, rrect, smoothPath, TRACE, type P2 } from '../art'
import { icons } from '../glyphs'
import { clamp01, mix, win } from '../kit'
import type { Build, Station } from '../station'
import { evidencePlate, plinth } from './common'
import { along, at, edge, etch, FLOOR_Y, node, packet } from './flat'

const VR = -1.4          // the beam's line: the badge, the aperture and the reports bucket all sit on it
export const buildIam: Build = (kit) => {
  const group = new THREE.Group(); group.name = 'station-iam'
  plinth(group, kit, 21, 13.8)
  const A = new Art(group, 'flat', [0, FLOOR_Y, 0])
  etch(A, 21, 13.8, 2)

  const badge = node(A, kit, -7.8, VR, 'badge', { size: 3.8 })
  const db = node(A, kit, 5.8, 5.0, 'database', { size: 3.1 }), compute = node(A, kit, 5.8, 1.8, 'chip', { size: 3.1 })
  const reports = node(A, kit, 5.8, VR, 'bucket', { size: 3.1 }), payroll = node(A, kit, 5.8, -4.6, 'bucket', { size: 3.1 })
  const nodes = [badge, db, compute, reports, payroll]

  // the cloud: a glass wall behind the resources, a cloud etched large on it
  const C = new Art(group, 'stand', [5.8, FLOOR_Y, -6.1])
  pane(C, 9.6, 4.9, { x: 0, r: 0.5, opacity: 0.4 })
  const cloud = C.stroke([...smoothPath([[-3.2, 0.9], [-3.4, 1.7], [-2.4, 2.3], [-1.5, 2.1]]), ...smoothPath([[-1.5, 2.1], [-1.1, 3.4], [0.5, 3.8], [1.5, 3.1]]), ...smoothPath([[1.5, 3.1], [2.8, 3.2], [3.5, 2.2], [3.2, 1.4]]), ...smoothPath([[3.2, 1.4], [3.5, 0.9], [3.0, 0.8]]), [-3.2, 0.9]], { w: 0.09, color: INK, opacity: 0.8, z: 0.02 })
  for (const x of [-2.2, -0.4, 1.4, 3.0]) C.stroke([[x, 0.7], [x, 0.1]], { w: 0.05, color: CHAMPAGNE, opacity: 0.8, z: 0.02 })

  // the policy: a glass wall across the beam, two shutters in it that close to a slit
  const PL = 9.4, V0 = VR - PL / 2
  const P = new Art(group, 'stand', [-2.0, FLOOR_Y, -V0], Math.PI / 2)
  pane(P, PL, 3.8, { x: PL / 2, r: 0.3, opacity: 0.34 })
  const u0 = PL / 2, shutters = [-1, 1].map((s) => { const a = P.child(0, 1.9, 0.02); a.fill(rrect(0, 0, 4.4, 3.4, 0.2), { color: INK, opacity: 0.2, z: 0 }); a.stroke(rrect(0, 0, 4.4, 3.4, 0.2), { w: 0.06, color: INK, opacity: 0.75, closed: true, z: 0.01 }); for (let i = 1; i < 6; i++) a.stroke([[-2.0, -1.7 + i * 0.57], [2.0, -1.7 + i * 0.57]], { w: 0.035, color: INK_SOFT, opacity: 0.6, z: 0.01 }); return { a, s } })

  // access: a fan (reach) that the policy narrows; then one beam
  const F = A.child(-5.8, VR, 0.04)
  const fan = F.fill([[0, 0], [9.4, 6.6], [9.4, -6.6]], { color: CHAMPAGNE, opacity: 0.2, z: 0 })
  const fanA = F.stroke([[9.4, 6.6], [0, 0], [9.4, -6.6]], { w: 0.07, color: CHAMPAGNE, opacity: 0.9, z: 0.01 })
  const beam = edge(A, [[-6.0, VR], [4.2, VR]], { color: TRACE, w: 0.13, glow: true, opacity: 1, z: 0.1 })
  const ok = packet(A), atk = packet(A, ALERT, 0.2)
  const pDeny: P2[] = [[-6.0, VR - 0.4], [-3.4, -2.8], [-2.4, -3.3]]
  const eDeny = edge(A, [[-6.0, VR - 0.4], [-3.4, -2.8], [-2.4, -3.3]], { color: ALERT, w: 0.08, glow: true, opacity: 0.95, z: 0.1 })
  const hit = P.stroke(circle(2.8, 1.5, 0.5, 30), { w: 0.07, color: ALERT, glow: true, closed: true, z: 0.04 })
  const okRing = A.stroke(rrect(5.8, VR, 3.6, 3.6, 0.6), { w: 0.1, color: OLIVE, opacity: 1, closed: true, z: 0.25 })
  const lock = A.child(5.8, -4.6, 0.5); icons.lock(lock); lock.group.scale.setScalar(1.5)
  const plate = evidencePlate(group, kit, [-1.8, 0.6, 6.0], 0.1)

  const station: Station = {
    group,
    anchors: { badge: [...at(-7.8, VR, 1.6)], gate: [-2.0, FLOOR_Y + 4.4, -VR], reports: [...at(5.8, VR, 1.4)], payroll: [...at(5.8, -4.6, 1.4)], cloud: [5.8, FLOOR_Y + 5.4, -6.1] },
    result: { at: [1.4, 1.4, 1.4], halfH: 6.6, yaw: -0.3, elev: 0.7 },
    plate: plate.object,
    set(p, t, a) {
      nodes.forEach((n, i) => n.pop(win(a, i * 0.1, i * 0.1 + 0.5)))
      cloud.draw(win(a, 0.3, 0.9)); C.group.visible = a > 0.2; P.group.visible = a > 0.2; P.group.scale.y = 0.001 + 0.999 * win(a, 0.2, 0.7)
      // 0 · everything reachable: a wide fan
      const reach = win(p, 0.06, 0.2)
      // 1 · the policy narrows it: the shutters close, the fan collapses onto the one line
      const narrow = win(p, 0.3, 0.5)
      F.group.scale.set(reach, Math.max(0.001, 1 - 0.985 * narrow), 1); F.group.visible = reach > 0.01 && narrow < 0.995
      ;(fan.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1 - narrow); fanA.opacity(0.9 * (1 - narrow))
      const gap = mix(PL - 1.2, 0.5, narrow)
      shutters.forEach(({ a, s }) => { a.group.position.x = u0 + s * (gap / 2 + 2.2) })
      beam.draw(win(p, 0.46, 0.56)); beam.pulse(p > 0.56 ? { x: (t * 0.4) % 1.3, w: 0.08 } : null)
      // 2 · the requests: the beam serves reports; payroll's is stopped at the aperture
      const go = clamp01((p - 0.58) / 0.1), back = win(p, 0.68, 0.78), served = p > 0.6
      ok.mesh.visible = served; { const q = along([[-6.0, VR], [4.2, VR]], (t * 0.5) % 1); ok.mesh.position.set(q[0], q[1], 0.14) }
      okRing.draw(win(p, 0.6, 0.66)); okRing.mesh.visible = p > 0.6
      eDeny.draw(win(p, 0.58, 0.66)); atk.mesh.visible = p > 0.58 && p < 0.9
      { const q = along(pDeny, go * (1 - back)); atk.mesh.position.set(q[0], q[1], 0.14); atk.mesh.scale.setScalar(1 - 0.7 * back) }
      hit.draw(p > 0.66 ? 1 : 0); hit.mesh.scale.setScalar(1 + 0.5 * (p > 0.66 ? Math.max(0, 1 - (p - 0.66) / 0.15) : 0)); hit.opacity(p > 0.66 ? 0.9 : 0)
      lock.group.visible = p > 0.68; lock.group.position.z = 0.5 + Math.max(0, 0.8 - (p - 0.68) * 8)
      plate.land(win(p, 0.88, 1))
      void CHAMPAGNE; void INK
    },
    dispose() { A.dispose(); C.dispose(); P.dispose(); F.dispose() },
  }
  return station
}
