// The six stations, in the order the show visits them.
import type { Build } from '../station'
import { buildDetect } from './detect'
import { buildIam } from './iam'
import { buildMail } from './mail'
import { buildMcp } from './mcp'
import { buildNetwork } from './network'
import { buildRisk } from './risk'

export const BUILDERS: Build[] = [buildNetwork, buildIam, buildMcp, buildDetect, buildMail, buildRisk]
