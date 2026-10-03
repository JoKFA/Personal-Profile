// 6 · Risk review (SR-01), drawn. A vendor's crate rolls along a lane toward a company's door. It stops
// under an assessment arch: a sheet of light reads it against a checklist (scope, evidence, findings);
// the findings row fails and a red hazard shows in the crate. The barrier comes down in front of the
// door; the crate stays outside, its rating on record. The company stays clean.
import * as THREE from 'three'
import { ALERT, Art, CHAMPAGNE, INK, INK_SOFT, OLIVE, pane, rrect, TRACE } from '../art'
import { icons } from '../glyphs'
import { mix, win } from '../kit'
import type { Build, Station } from '../station'
import { evidencePlate, plinth } from './common'
import { at, etch, FLOOR_Y, node } from './flat'

const LV = -0.6          // the lane's centre line
export const buildRisk: Build = (kit) => {
  const group = new THREE.Group(); group.name = 'station-risk'
  plinth(group, kit, 22, 12.6)
  const A = new Art(group, 'flat', [0, FLOOR_Y, 0])
  etch(A, 22, 12.6, 6)

  // the lane
  for (const d of [-1.5, 1.5]) A.stroke([[-9.8, LV + d], [4.6, LV + d]], { w: 0.1, color: INK, opacity: 0.7, z: 0.02 })
  for (let i = 0; i < 12; i++) A.stroke([[-9.2 + i * 1.2, LV], [-8.6 + i * 1.2, LV]], { w: 0.07, color: INK_SOFT, opacity: 0.8, z: 0.02 })
  const company = node(A, kit, 7.8, LV + 0.4, 'building', { size: 5.6 })
  const door = A.dot(5.3, LV, 0.2, OLIVE, { glow: true, z: 0.3 })
  const board = node(A, kit, -6.4, 4.4, 'checklist', { size: 3.8 })
  // the checklist's marks: two pass, one fails
  const mark = (i: number, ok: boolean) => { const y = 0.6 - i * 0.6, a = board.icon.child(0.05, y, 0.02); if (ok) a.stroke([[-0.12, 0], [-0.03, -0.1], [0.14, 0.13]], { w: 0.08, color: OLIVE, z: 0 }); else { a.stroke([[-0.12, 0.12], [0.12, -0.12]], { w: 0.08, color: ALERT, z: 0 }); a.stroke([[-0.12, -0.12], [0.12, 0.12]], { w: 0.08, color: ALERT, z: 0 }) } return a }
  const marks = [mark(0, true), mark(1, true), mark(2, false)]
  // the arch the crate stops under, and its sheet of light
  const AR = new Art(group, 'stand', [-4.4, FLOOR_Y, -LV + 2.8], Math.PI / 2)
  pane(AR, 5.6, 4.2, { x: 2.8, r: 0.3, opacity: 0.26 })
  AR.stroke([[0, 0], [0, 4.2], [5.6, 4.2], [5.6, 0]], { w: 0.12, color: INK, opacity: 0.85, z: 0.02 })
  const sheet = AR.stroke([[2.8, 0.1], [2.8, 4.1]], { w: 0.2, color: TRACE, glow: true, z: 0.03 })
  // the crate and the hazard in it
  const crate = node(A, kit, -9.4, LV, 'crate', { size: 3.2, z: 0.1 })
  const virus = crate.art.child(0, 0.2, 0.2); icons.virus(virus); virus.group.visible = false
  const tagC = crate.art.child(0.9, 1.2, 0.2); tagC.fill(rrect(0, 0, 0.9, 0.42, 0.14), { color: ALERT, z: 0 }); tagC.group.visible = false
  // the barrier across the lane
  const post = node(A, kit, 2.6, LV + 2.4, 'gate', { size: 1.4, z: 0.04 }); void post
  const arm = A.child(2.6, LV + 1.8, 0.4); arm.stroke([[0, 0], [0, -3.6]], { w: 0.28, color: ALERT, opacity: 1, z: 0.01 }); for (let i = 0; i < 4; i++) arm.stroke([[-0.14, -0.3 - i * 0.9], [0.14, -0.55 - i * 0.9]], { w: 0.1, color: 0xffffff, z: 0.02 })
  const hold = A.stroke(rrect(-1.4, LV, 3.9, 3.9, 0.6), { w: 0.1, color: ALERT, closed: true, z: 0.3, opacity: 0.95 })
  const plate = evidencePlate(group, kit, [2.2, 0.6, 4.8], -0.05)

  const station: Station = {
    group,
    anchors: { crate: [...at(-4.4, LV, 2.2)], arch: [-4.4, FLOOR_Y + 4.6, -LV], board: [...at(-6.4, 4.4, 1.8)], door: [...at(7.8, LV + 0.4, 3.4)], barrier: [...at(2.6, LV, 1.6)] },
    result: { at: [1.6, 1.8, -LV], halfH: 6.0, yaw: -0.3, elev: 0.66 },
    plate: plate.object,
    set(p, _t, a) {
      company.pop(win(a, 0, 0.5)); board.pop(win(a, 0.25, 0.75)); crate.pop(win(a, 0.4, 0.9)); AR.group.visible = a > 0.3; AR.group.scale.y = 0.001 + 0.999 * win(a, 0.3, 0.8)
      // 0 · the crate arrives under the arch; 1 · the sheet reads it along its length
      const arrive = win(p, 0.06, 0.22), onward = win(p, 0.5, 0.64)
      crate.art.group.position.x = mix(mix(-9.4, -4.4, arrive), -1.6, onward)
      const scan = win(p, 0.28, 0.5); sheet.mesh.visible = p > 0.26 && p < 0.52; sheet.mesh.position.x = mix(-2.0, 2.0, scan); sheet.color(p > 0.44 ? ALERT : TRACE)
      // 2 · the rows tick; the third fails and the hazard shows
      marks.forEach((m, i) => { m.group.visible = p > [0.3, 0.37, 0.45][i] })
      virus.group.visible = p > 0.44; virus.group.scale.setScalar(1.6 * (0.4 + 0.6 * win(p, 0.44, 0.5))); tagC.group.visible = p > 0.6
      // 3 · the barrier comes down across the lane; the crate is held outside
      arm.group.rotation.z = mix(Math.PI / 2, 0, win(p, 0.56, 0.68)); hold.draw(win(p, 0.62, 0.7)); hold.mesh.visible = p > 0.62
      door.visible = true
      plate.land(win(p, 0.88, 1))
      void CHAMPAGNE; void INK
    },
    dispose() { A.dispose(); AR.dispose() },
  }
  return station
}
