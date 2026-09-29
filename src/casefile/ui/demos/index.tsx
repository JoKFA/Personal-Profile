// Project demos, projected onto the opened drive's face. Light, frosted style: ink on the drive's
// own surface, champagne for light, olive for pass, red for threat. Each replays on its own and
// can be driven by hand; reduced motion shows the end state.
import type { DemoKey, Entry } from '../../data/types'
import { Mcpsf } from './Mcpsf'
import { Edr } from './Edr'
import { Pentest } from './Pentest'
import { Telus } from './Telus'
import { Viva } from './Viva'
import { Network } from './Network'
import { PwnScan } from './PwnScan'
import { Sentinel } from './Sentinel'
import { Timeline, Subject, VisitorPrint } from './Simple'
import { Story } from './Story'
import { Bcit, CoastCapital, VibesMeet, VivaOps } from './Service'
import './demos.css'
import './service.css'

export function Demo({ kind, entry }: { kind: DemoKey; entry: Entry }) {
  const C = { mcpsf: Mcpsf, edr: Edr, pentest: Pentest, telus: Telus, viva: Viva, network: Network, pwnscan: PwnScan, sentinel: Sentinel, timeline: Timeline, subject: Subject, visitor: VisitorPrint, story: Story, coast: CoastCapital, vibes: VibesMeet, bcit: Bcit, vivaops: VivaOps }[kind]
  return <div className="dm">{C ? <C entry={entry} /> : null}</div>
}
export interface DemoProps { entry: Entry }
