// What a demo may ask of the shell around it. A demo knows nothing of the archive, the scene or three.js:
// the desktop provides this from the archive (demos/DesktopDemoCtx.tsx), a phone shell provides its own.
import { createContext, useContext } from 'react'
import type { Visitor } from '../../visitor'

export interface DemoCtx {
  visitor: Visitor
  /** reduced motion: a demo shows its end state and its waits resolve at once */
  reduced: boolean
  /** a line in the shell's status area (HTML), for `ms` milliseconds */
  status: (html: string, ms?: number) => void
  /** a line in the shell's audit log */
  record: (s: string) => void
  /** the restricted file's guard has been talked past (SENTINEL-1). A shell re-renders its provider when this changes. */
  captured: boolean
  /** the guard was breached: declassify the restricted file */
  capture: () => void
}
export const DemoContext = createContext<DemoCtx | null>(null)
export const useDemo = (): DemoCtx => { const c = useContext(DemoContext); if (!c) throw new Error('no demo context'); return c }
