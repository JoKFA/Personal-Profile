// 3 · AI tool security (X-001), drawn. An agent is about to connect to a rack of tools (MCP servers).
// A scanner (a sheet of light) reads each one inside a sandbox outline first. One tool carries a
// hidden instruction in its description: the scan exposes it, the tool is caged and left
// unconnected, and the agent is connected only to the tools that passed.
import * as THREE from 'three'
import { ALERT, Art, CHAMPAGNE, INK, INK_SOFT, OLIVE, pane, rrect, smoothPath, TRACE, type P2 } from '../art'
import { icons } from '../glyphs'
import { clamp01, mix, win } from '../kit'
import type { Build, Station } from '../station'
import { evidencePlate, plinth } from './common'
import { along, at, edge, etch, FLOOR_Y, node, packet } from './flat'

const TOOLS = [0, 1, 2, 3], BAD = 2, VR = 0.2
const toolU = (i: number) => -2.0 + i * 3.7

export const buildMcp: Build = (kit) => {
  const group = new THREE.Group(); group.name = 'station-mcp'
  plinth(group, kit, 23, 12.6)
  const A = new Art(group, 'flat', [0, FLOOR_Y, 0])
  etch(A, 23, 12.6, 3)

  const agent = node(A, kit, -8.4, VR + 1.6, 'agent', { size: 4.2 })
  // the rack the tools stand in: a long inset strip with connector marks
  A.fill(rrect(4.6, VR, 16.2, 4.6, 0.4), { color: INK, opacity: 0.08, z: 0.01 })
  A.stroke(rrect(4.6, VR, 16.2, 4.6, 0.4), { w: 0.05, color: INK_SOFT, opacity: 0.8, closed: true, z: 0.02 })
  for (let i = 0; i < 4; i++) for (const x of [-0.5, 0, 0.5]) A.stroke([[toolU(i) + x, VR - 2.3], [toolU(i) + x, VR - 1.9]], { w: 0.07, color: INK_SOFT, opacity: 0.9, z: 0.03 })
  const tools = TOOLS.map((i) => node(A, kit, toolU(i), VR, 'tool', { size: 3.2 }))
  const hidden = tools[BAD].art.stroke([[-0.55, -0.05], [0.65, -0.05]], { w: 0.1, color: ALERT, z: 0.175, opacity: 1 })

  // the scanner: a glass sheet standing across the rack, sliding along it
  const S = new Art(group, 'stand', [0, FLOOR_Y, VR + 3.3], Math.PI / 2)
  pane(S, 6.6, 3.6, { x: 3.3, r: 0.3, opacity: 0.28, edge: CHAMPAGNE })
  const scanEdge = S.stroke([[0.2, 0], [0.2, 3.6]], { w: 0.12, color: TRACE, glow: true, z: 0.02 })

  // the sandbox: corner brackets and a lock close round the flagged tool
  const cage = A.child(toolU(BAD), VR, 0.3); icons.cage(cage, { color: ALERT }); cage.group.scale.setScalar(1.45)
  const lock = A.child(toolU(BAD), VR + 2.9, 0.6); icons.lock(lock, { color: ALERT }); lock.group.scale.setScalar(1.1)
  const cageOutline = A.stroke(rrect(toolU(BAD), VR, 3.9, 3.9, 0.6), { w: 0.1, color: ALERT, closed: true, z: 0.3, opacity: 0.95 })

  // connections: the agent to each tool that passed (arcs over the rack); the flagged one gets a stub that stops
  const link = (i: number) => smoothPath([[-6.0, VR + 2.2], [(-6.0 + toolU(i)) / 2, VR + 4.4], [toolU(i), VR + 1.9]])
  const links = TOOLS.map((i) => ({ i, pts: link(i), s: edge(A, i === BAD ? link(i).slice(0, Math.floor(link(i).length * 0.55)) : link(i), { color: i === BAD ? ALERT : TRACE, w: i === BAD ? 0.07 : 0.1, glow: i !== BAD, z: 0.1 }) }))
  const flows = TOOLS.filter((i) => i !== BAD).map(() => packet(A))
  const plate = evidencePlate(group, kit, [4.6, 0.6, 5.4], 0.05)

  const station: Station = {
    group,
    anchors: { agent: [...at(-8.4, VR + 1.6, 1.8)], rack: [...at(4.6, VR, 1.6)], flagged: [...at(toolU(BAD), VR - 1.2, 0.6)], cage: [...at(toolU(BAD), VR + 3.4, 1.6)], gantry: [0, FLOOR_Y + 3.8, -VR] },
    result: { at: [toolU(BAD), 1.4, -VR], halfH: 5.4, yaw: -0.25, elev: 0.7 },
    plate: plate.object,
    set(p, t, a) {
      agent.pop(win(a, 0, 0.5)); tools.forEach((n, i) => n.pop(win(a, 0.15 + i * 0.12, 0.6 + i * 0.12)))
      // 1 · the scanner reads each tool; the flagged one shows its hidden line and the sheet turns red there
      const sweep = win(p, 0.26, 0.6)
      S.group.visible = p > 0.22 && p < 0.66; S.group.position.x = mix(-3.8, toolU(3) + 2.2, sweep)
      const over = clamp01(1 - Math.abs(S.group.position.x - toolU(BAD)) / 1.9)
      scanEdge.color(over > 0.2 ? ALERT : TRACE)
      hidden.draw(win(p, 0.4, 0.5)); tools[BAD].art.group.children.forEach(() => undefined)
      // 2 · the flagged tool is caged
      const down = win(p, 0.6, 0.74)
      cage.group.visible = down > 0.01; cage.group.scale.setScalar(mix(2.4, 1.45, down)); cageOutline.draw(down); cageOutline.mesh.visible = down > 0.01
      lock.group.visible = down > 0.9
      // 3 · the agent connects only to the tools that passed
      const conn = win(p, 0.74, 0.86)
      links.forEach(({ s, i }) => s.draw(i === BAD ? win(p, 0.7, 0.78) : conn))
      flows.forEach((f, n) => { const i = TOOLS.filter((x) => x !== BAD)[n], q = along(links[i].pts, (t * 0.4 + n / 3) % 1); f.mesh.visible = conn > 0.5; f.mesh.position.set(q[0], q[1], 0.14) })
      plate.land(win(p, 0.88, 1))
      void INK; void OLIVE
    },
    dispose() { A.dispose(); S.dispose(); cage.dispose(); lock.dispose() },
  }
  return station
}
export type { P2 }
