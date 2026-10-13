// The desktop's DemoCtx: the demos' narrow interface, answered by the archive.
import { useMemo, type ReactNode } from 'react'
import { useCtx, useSnapshot } from '../context'
import { DemoContext } from './ctx'

export function DesktopDemoCtx({ children }: { children: ReactNode }) {
  const { archive, visitor, reduced, status, record } = useCtx()
  const { captured } = useSnapshot()
  const value = useMemo(() => ({ visitor, reduced, status, record, captured, capture: () => archive.capture() }), [archive, visitor, reduced, status, record, captured])
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}
