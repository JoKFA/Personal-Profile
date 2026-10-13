// Phone prototype (lab, ?phone): the bake's director (phone/bake/director.ts) with the prototype's page layer over it.
// The prototype keeps its own framing (390 × 844, the stop's drive above the middle, the field breathing); the bake
// (?bake) uses the master framing and no page. Dev and `--mode bake` only (CasefileApp gates the import on LAB).
import { install as installDirector } from './bake/director'
import { createOverlay } from './overlay'

export function install() {
  const ov = createOverlay()
  return installDirector({ master: false, page: ov.update })
}
