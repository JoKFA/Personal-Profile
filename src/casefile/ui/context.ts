import { createContext, useContext, useSyncExternalStore, type MutableRefObject } from 'react'
import type { Archive, Snapshot } from '../scene/archive'
import type { Visitor } from '../visitor'

export interface Ctx {
  archive: Archive
  visitor: Visitor
  reduced: boolean
  status: (html: string, ms?: number) => void
  open: () => void
  /** leave the file; `to` = the URL to go to next (a related file), default "/" */
  close: (opts?: { shred?: boolean; to?: string }) => void
  auditLog: [string, string][]
  record: (s: string) => void
  /** the open file registers its exit animation here; closing waits for it */
  exitRef: MutableRefObject<null | (() => Promise<void>)>
}
export const ArchiveContext = createContext<Ctx | null>(null)
export const useCtx = () => { const c = useContext(ArchiveContext); if (!c) throw new Error('no archive'); return c }
export const useSnapshot = (): Snapshot => {
  const { archive } = useCtx()
  return useSyncExternalStore(archive.subscribe, archive.getSnapshot, archive.getSnapshot)
}
