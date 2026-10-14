import { useMemo } from 'react'
import { Gate } from '../../../ui/Gate'
import { reconVisitor } from '../../../visitor'
import { COPY } from '../copy'
import type { EntryBridge } from './entry'
import './gate.phone.css'

const none = () => {}
/** The phone's entry page: the desktop's fingerprint page in hold-to-verify mode (Gate.tsx `phone`). Everything after the seal belongs to the controller (EntryBridge). */
export default function PhoneGate({ bridge }: { bridge: EntryBridge }) {
  const visitor = useMemo(() => reconVisitor(), [])
  return <Gate visitor={visitor} reduced={bridge.reduced} sceneReady onBuild={none} onReveal={none} onStrike={none} onDone={none}
    phone={{ label: COPY.hold, onPress: bridge.press, onSealed: bridge.seal }} />
}
