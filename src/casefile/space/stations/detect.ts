// 4 · Detection & triage (X-002), drawn. Eight identical failed sign-in events arrive from the sensor
// in a rhythm, one per beat; the pattern lens recognises them and they are merged into one stack; the
// stack is answered from the cache; a model drafts the first triage note; the analyst's review stays
// pending (AI used to improve ordinary SOC work, with a person on the decision).
import * as THREE from 'three'
import { Art, CHAMPAGNE, INK, INK_SOFT, OLIVE, rrect } from '../art'
import { icons } from '../glyphs'
import { clamp01, mix, win } from '../kit'
import type { Build, Station } from '../station'
import { evidencePlate, plinth } from './common'
import { at, edge, etch, FLOOR_Y, node } from './flat'

const N = 8, TV = -1.8
const slotU = (i: number) => -5.9 + i * 1.28
const STACK_U = 3.4

export const buildDetect: Build = (kit) => {
  const group = new THREE.Group(); group.name = 'station-detect'
  plinth(group, kit, 22, 13)
  const A = new Art(group, 'flat', [0, FLOOR_Y, 0])
  etch(A, 22, 13, 4)

  const sensor = node(A, kit, -9.0, TV, 'chip', { size: 3.4 })
  const cache = node(A, kit, 8.0, TV, 'database', { size: 3.4 }), llm = node(A, kit, 8.0, 3.6, 'chip', { size: 3.4 })
  const note = node(A, kit, 3.6, 4.2, 'note', { size: 3.8 }), analyst = node(A, kit, -2.6, 3.8, 'analyst', { size: 3.6 })
  const track = A.stroke([[-7.0, TV], [STACK_U + 1.4, TV]], { w: 0.16, color: INK, opacity: 0.55, z: 0.02 })
  for (let i = 0; i <= 14; i++) A.stroke([[-7.0 + i * 0.88, TV - 0.55], [-7.0 + i * 0.88, TV - 0.3]], { w: 0.05, color: INK_SOFT, opacity: 0.7, z: 0.02 })

  // the events: identical small tiles with one red stripe
  const events = Array.from({ length: N }, () => { const t = node(A, kit, 0, TV, 'event', { size: 1.5, z: 0.08, accent: INK_SOFT }); return t })
  // the lens: a ring that runs along the row
  const lens = A.child(slotU(0), TV, 0.5); icons.lens(lens); lens.group.scale.setScalar(1.7)
  // the merged stack's brackets
  const br = A.child(STACK_U, TV, 0.2)
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) br.stroke([[sx * 1.2, sy * 0.7], [sx * 1.2, sy * 1.15], [sx * 0.7, sy * 1.15]].map(([x, y]) => [x, y] as [number, number]), { w: 0.09, color: CHAMPAGNE, z: 0.01 })
  br.group.visible = false

  const eCache = edge(A, [[STACK_U + 1.5, TV], [6.1, TV]], { color: CHAMPAGNE, w: 0.09, glow: true })
  const eLlm = edge(A, [[8.0, TV + 1.8], [8.0, 3.6 - 1.8]], { color: CHAMPAGNE, w: 0.09, glow: true })
  const eNote = edge(A, [[6.2, 3.8], [5.6, 4.0]], { color: CHAMPAGNE, w: 0.09, glow: true })
  const eRev = edge(A, [[1.6, 4.2], [-0.8, 3.9]], { color: INK_SOFT, w: 0.07 })
  const cacheRing = A.stroke(rrect(8.0, TV, 3.9, 3.9, 0.6), { w: 0.1, color: OLIVE, closed: true, z: 0.25 })
  const lamp = analyst.art.child(1.15, -0.45, 0.2); lamp.dot(0, 0, 0.11, CHAMPAGNE, { glow: true })
  const plate = evidencePlate(group, kit, [-1.0, 0.6, 5.8], 0.1)

  const station: Station = {
    group,
    anchors: { events: [...at(-1.0, TV, 1.4)], lens: [...at(STACK_U, TV, 1.8)], cache: [...at(8.0, TV, 1.6)], note: [...at(3.6, 4.2, 1.8)], review: [...at(-2.6, 3.8, 1.6)] },
    result: { at: [3.2, 1.2, -1.6], halfH: 6.4, yaw: -0.25, elev: 0.72 },
    plate: plate.object,
    set(p, t, a) {
      sensor.pop(win(a, 0, 0.5)); track.draw(win(a, 0.3, 0.9))
      // 0 · the events arrive on the beat, each one a little after the last
      events.forEach((e, i) => {
        const arrive = 0.05 + i * 0.026, k = win(p, arrive, arrive + 0.04) * win(a, 0.5, 0.9)
        // after the pattern is found they merge into a stack where the brackets are
        const merge = win(p, 0.4 + i * 0.006, 0.5 + i * 0.006)
        e.pop(k)
        e.art.group.position.set(mix(slotU(i), STACK_U - 0.5 + i * 0.1, merge), TV, 0.08 + merge * (0.12 * i) + (1 - k) * 1.2)
        e.art.group.visible = p > arrive && a > 0.5
      })
      // 1 · the lens runs along the row and finds the same pattern
      const scan = win(p, 0.26, 0.4), rest = win(p, 0.4, 0.5)
      lens.group.visible = p > 0.24; lens.group.position.x = mix(mix(slotU(0) - 1, slotU(N - 1) + 0.4, scan), STACK_U, rest)
      br.group.visible = rest > 0.6
      // 2 · the merged stack is answered from the cache
      eCache.draw(win(p, 0.5, 0.58)); eCache.pulse(p > 0.55 ? { x: (t * 0.5) % 1.3, w: 0.1 } : null); cache.pop(win(p, 0.46, 0.54)); cacheRing.draw(win(p, 0.56, 0.62)); cacheRing.mesh.visible = p > 0.56
      // 3 · the model drafts the first note; the review stays pending
      llm.pop(win(p, 0.58, 0.66)); eLlm.draw(win(p, 0.6, 0.66)); note.pop(win(p, 0.66, 0.78)); eNote.draw(win(p, 0.68, 0.76)); analyst.pop(win(p, 0.7, 0.8)); eRev.draw(win(p, 0.76, 0.84))
      lamp.group.visible = p > 0.74; lamp.group.scale.setScalar(1 + 0.3 * Math.sin(t * 4))
      plate.land(win(p, 0.88, 1))
      void INK; void clamp01; void icons
    },
    dispose() { A.dispose(); lens.dispose(); br.dispose() },
  }
  return station
}
