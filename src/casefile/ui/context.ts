import { createContext, useContext, useSyncExternalStore, type MutableRefObject } from 'react'
import type { Archive, Handoff, Snapshot } from '../scene/archive'
import type { Clock } from '../space/clock'
import type { Runtime } from '../space/runtime'
import type { Space } from '../space/scene'
import type { Visitor } from '../visitor'

export interface Ctx {
  archive: Archive
  visitor: Visitor
  reduced: boolean
  status: (html: string, ms?: number) => void
  open: () => void
  /** from home: open the subject file, whose door leads inside the drive */
  openProfile: () => void
  /** leave the file; `to` = the URL to go to next (a related file), default "/" */
  close: (opts?: { shred?: boolean; to?: string }) => void
  auditLog: [string, string][]
  record: (s: string) => void
  /** the open file registers its exit animation here; closing waits for it */
  exitRef: MutableRefObject<null | (() => Promise<void>)>
  /** the interior (null until it is built, or if it could not be) and the running show; `cut` is set while the interior is the subject file's exhibit */
  space: { space: Space; clock: Clock } | null
  runtime: MutableRefObject<Runtime | null>
  cut: Handoff | null
}
export const ArchiveContext = createContext<Ctx | null>(null)
export const useCtx = () => { const c = useContext(ArchiveContext); if (!c) throw new Error('no archive'); return c }
export const useSnapshot = (): Snapshot => {
  const { archive } = useCtx()
  return useSyncExternalStore(archive.subscribe, archive.getSnapshot, archive.getSnapshot)
}
