// Project demos, projected onto the opened drive's face. Light, frosted style: ink on the drive's
// own surface, champagne for light, olive for pass, red for threat. Each replays on its own and
// can be driven by hand; reduced motion shows the end state.
import type { ComponentType } from 'react'
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
import { Custody } from './Custody'
import { Stack } from './Stack'
import { Quorum } from './Quorum'
import { Bcit, CoastCapital, VibesMeet, VivaOps } from './Service'
import './demos.css'
import './service.css'

export function Demo({ kind, entry, jump }: { kind: DemoKey; entry: Entry; jump?: (id: string) => void }) {
  const C = { mcpsf: Mcpsf, edr: Edr, pentest: Pentest, telus: Telus, viva: Viva, network: Network, pwnscan: PwnScan, sentinel: Sentinel, timeline: Timeline, subject: Subject, visitor: VisitorPrint, custody: Custody, stack: Stack, quorum: Quorum, coast: CoastCapital, vibes: VibesMeet, bcit: Bcit, vivaops: VivaOps }[kind] as ComponentType<DemoProps> | undefined
  return <div className="dm">{C ? <C entry={entry} jump={jump} /> : null}</div>
}
export interface DemoProps { entry: Entry; jump?: (id: string) => void }
