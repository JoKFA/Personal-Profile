// 5 · Security awareness (SR-03), drawn. A message hangs from a fishing hook (phishing, as a picture):
// it looks familiar. A lens is brought over its sender and its link; what it shows does not match; a
// stamp reports it and it is lowered into the reported tray. It is never clicked.
import * as THREE from 'three'
import { ALERT, Art, CHAMPAGNE, INK, INK_SOFT, OLIVE, pane, rrect, circle } from '../art'
import { icons } from '../glyphs'
import { mix, win } from '../kit'
import type { Build, Station } from '../station'
import { evidencePlate, plinth } from './common'
import { at, etch, FLOOR_Y, node } from './flat'

const CW = 6.6, CH = 4.6
export const buildMail: Build = (kit) => {
  const group = new THREE.Group(); group.name = 'station-mail'
  plinth(group, kit, 19, 11.5)
  const A = new Art(group, 'flat', [0, FLOOR_Y, 0])
  etch(A, 19, 11.5, 5)
  const tray = node(A, kit, 5.8, -0.8, 'tray', { size: 5 })
  const ring = A.stroke(circle(5.8, -0.8, 2.6, 40), { w: 0.1, color: OLIVE, closed: true, z: 0.3 })

  // ── the hook and the message, standing up facing the viewer: one drawing that is moved as a whole ──
  const H = new Art(group, 'stand', [-3.2, FLOOR_Y, 0.8])
  const line = H.stroke([[0, 0], [0, 14]], { w: 0.06, color: INK, opacity: 0.9, z: 0.02 })   // runs up out of the frame
  const hook = H.child(0, 0, 0.02, 1.7); icons.hook(hook)
  const M = H.child(0.5, -0.4, 0.02)              // the message: its top centre hangs off the hook
  pane(M, CW, CH, { x: 0, y: -CH, r: 0.4, opacity: 0.62 })
  const icon = M.child(-2.4, -1.0, 0.02, 0.6); icons.envelope(icon)
  const bar = (u: number, v: number, w: number, c = INK_SOFT, ww = 0.1) => M.stroke([[u, v], [u + w, v]], { w: ww, color: c, opacity: 0.85, z: 0.03 })
  bar(-1.6, -0.85, 3.0, INK, 0.12); bar(-1.6, -1.3, 2.0); bar(-2.9, -2.1, 5.6); bar(-2.9, -2.55, 5.0); bar(-2.9, -3.0, 5.4)
  M.stroke(rrect(-1.6, -3.8, 2.6, 0.62, 0.3), { w: 0.07, color: CHAMPAGNE, opacity: 1, closed: true, z: 0.03 })
  const sender = M.stroke(rrect(0.3, -0.85, 3.4, 0.6, 0.2), { w: 0.07, color: ALERT, opacity: 1, closed: true, z: 0.03 })
  const tag = M.child(2.5, -0.5, 0.06); tag.fill(rrect(0, 0, 1.6, 0.7, 0.25), { color: ALERT, z: 0 }); tag.group.visible = false

  // ── the lens, what it shows, the stamp: each its own drawing placed in front of the message ──
  const L = new Art(group, 'stand', [0, FLOOR_Y, 1.8], 0, 1.6); icons.lens(L)
  const proof = new Art(group, 'stand', [0, FLOOR_Y, 2.0])
  pane(proof, 3.8, 1.8, { x: 0, y: -0.9, r: 0.3, opacity: 0.74 })
  proof.stroke([[-1.6, 0.0], [-0.1, 0.0]], { w: 0.12, color: INK_SOFT, z: 0.02 }); proof.stroke([[-1.6, -0.7], [1.2, -0.7]], { w: 0.12, color: ALERT, z: 0.02 })
  proof.stroke([[1.2, 0.15], [1.6, -0.45]], { w: 0.09, color: ALERT, z: 0.02 }); proof.stroke([[0.95, -0.05], [1.65, -0.05]], { w: 0.06, color: ALERT, z: 0.02 })
  const S = new Art(group, 'stand', [0, FLOOR_Y, 2.0], 0, 1.8); icons.stamp(S)
  const plate = evidencePlate(group, kit, [-1.6, 0.6, 4.8], 0.12)

  const station: Station = {
    group,
    anchors: { sender: [-1.2, FLOOR_Y + 7.4, 0.8], link: [-4.4, FLOOR_Y + 3.0, 0.8], lens: [-1.6, FLOOR_Y + 4.2, 1.8], tray: [...at(5.8, -0.8, 2.6)] },
    result: { at: [4.6, 2.4, 0.8], halfH: 5.4, yaw: -0.2, elev: 0.5 },
    plate: plate.object,
    set(p, t, a) {
      tray.pop(win(a, 0.2, 0.8))
      // 0 · the message is lowered on its hook and hangs there looking ordinary
      const drop = win(p, 0, 0.14), swing = Math.sin(t * 1.3) * 0.03 * (1 - win(p, 0.6, 0.72))
      const release = win(p, 0.68, 0.76), carry = win(p, 0.74, 0.86), down = win(p, 0.76, 0.86)
      const hy = mix(10.5, 7.4, drop)             // where the message hangs (height above the plate)
      H.group.position.set(mix(-3.2, 5.8, carry), FLOOR_Y + mix(0, 0, carry), mix(0.8, 1.2, carry))
      // once the message is let go, the hook is drawn up out of the frame and gone
      const hookY = hy + release * 8
      line.draw(1); hook.group.position.y = hookY; line.mesh.position.y = hookY + 3.4; line.mesh.visible = release < 1; hook.group.visible = release < 1
      M.group.position.set(0.4 + swing * 4, hy - 0.2 - down * (hy - 3.4), 0.02); M.group.scale.setScalar(mix(1, 0.6, down)); M.group.rotation.z = swing
      // the message's own position in the world, for the things that come to it
      const mx = H.group.position.x + M.group.position.x, my = M.group.position.y + H.group.position.y - FLOOR_Y, mz = H.group.position.z
      // the sender and the link are on the message, so the fields that name them go where it goes
      const ms = M.group.scale.x, an = station.anchors
      an.sender = [mx + 2.0 * ms, FLOOR_Y + my - 0.55 * ms, mz + 0.3]; an.link = [mx - 0.3 * ms, FLOOR_Y + my - 3.5 * ms, mz + 0.3]
      // 1 · the lens comes over the message (the sender, then the link); 2 · it shows that they do not match
      const arrive = win(p, 0.24, 0.34), toLink = win(p, 0.36, 0.5), gone = win(p, 0.66, 0.78)
      L.group.visible = p > 0.22 && gone < 1
      L.group.position.set(mx + mix(mix(7.0, 1.4, arrive), -1.8, toLink), FLOOR_Y + my - 1.2 - 2.5 * toLink + gone * 3, mz + 1.2)
      sender.opacity(p > 0.4 ? 0.95 : 0); proof.group.visible = toLink > 0.5 && p < 0.8
      proof.group.position.set(mx + 4.9, FLOOR_Y + my - 1.4, mz + 1.4); proof.group.scale.setScalar(Math.min(1, (toLink - 0.5) * 2 + 0.01))
      // 3 · the stamp comes down and the message is tagged; it goes into the tray, never clicked
      const s = win(p, 0.6, 0.7); S.group.visible = p > 0.58 && p < 0.78
      S.group.position.set(mx + 2.6, FLOOR_Y + my + 3.8 - s * 3.6 + Math.max(0, (p - 0.68) * 30), mz + 1.2); tag.group.visible = p > 0.66
      ring.draw(win(p, 0.86, 0.92)); ring.mesh.visible = p > 0.86
      plate.land(win(p, 0.88, 1))
      void icon
    },
    dispose() { A.dispose(); H.dispose(); L.dispose(); proof.dispose(); S.dispose() },
  }
  return station
}
