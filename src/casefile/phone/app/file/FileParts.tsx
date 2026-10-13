// The React pieces of the phone's file page: the body (FileBody, stacked, shared with the desktop) and the demo with its phone DemoCtx.
// The phone shell itself is plain DOM; these two trees are mounted into it by mount.ts.
import { memo, useMemo, useState, type ReactNode } from 'react'
import type { Entry } from '../../../data/types'
import { Demo } from '../../../ui/demos'
import { DemoContext, type DemoCtx } from '../../../ui/demos/ctx'
import { FileBody } from '../../../ui/file/FileBody'
import type { Visitor } from '../../../visitor'

export interface Bridge {
  visitor: Visitor
  reduced: boolean
  /** a one-line machine status under the window */
  status: (html: string, ms?: number) => void
  /** one line in the in-memory audit log */
  record: (s: string) => void
  /** the restricted file's guard was talked past (SENTINEL-1): the shell may note it */
  onCapture: () => void
  audit: [string, string][]
  jump: (id: string) => void
}

/** The provider every demo on the phone sits in. `captured` is the file's own state: the guard breached once stays breached. */
export function PhoneDemo({ entry, bridge }: { entry: Entry; bridge: Bridge }) {
  const [captured, setCaptured] = useState(false)
  const ctx = useMemo<DemoCtx>(() => ({
    visitor: bridge.visitor, reduced: bridge.reduced, status: bridge.status, record: bridge.record, captured, tall: true,
    capture: () => { setCaptured(true); bridge.onCapture() },
  }), [bridge, captured])
  return <DemoContext.Provider value={ctx}><Demo kind={entry.demo!} entry={entry} jump={bridge.jump} /></DemoContext.Provider>
}

/** A marked, empty place in the subject file where the interior exhibit goes (P3c). It renders nothing visible. */
export function InteriorSlot() {
  return <div className="ph-slot" data-slot="p3c-interior-exhibit" aria-hidden="true" />
}

/**
 * The file's body. It never re-renders (the shell decrypts its text in place, one line at a time, so nothing may change
 * those nodes behind its back): every prop is fixed at mount.
 */
export const PhoneBody = memo(function PhoneBody({ entry, bridge, below }: { entry: Entry; bridge: Bridge; below?: ReactNode }) {
  return (
    <div className="ph-fb-in">
      {below}
      <FileBody
        entry={entry} layout="stacked" onJump={bridge.jump}
        session={{ visitor: bridge.visitor.id, risk: 0, audit: bridge.audit }}
        exhibit={entry.kind === 'subject' ? <InteriorSlot /> : null}
      />
    </div>
  )
})
