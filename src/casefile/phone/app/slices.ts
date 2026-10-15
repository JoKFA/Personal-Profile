// P6b: a React tree rendered as a transition: React cuts the render into slices of about 5 ms between which the page is free to move, and the promise is kept when the tree is on the page.
// (The shell builds its file pages and the interior's paper before they are needed; the same trees rendered in one piece were tasks of 80 to 150 ms on a slow phone.)
import { createElement, startTransition, useLayoutEffect, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

export interface Mounted { el: HTMLElement; unmount(): void }

function Ready({ done, children }: { done: () => void; children?: ReactNode }) { useLayoutEffect(() => { done() }, [done]); return children }

export const renderInSlices = (el: HTMLElement, node: ReactNode): Promise<Mounted> => new Promise<Mounted>((resolve) => {
  const root = createRoot(el)
  const m: Mounted = { el, unmount() { flushSync(() => root.unmount()) } }
  startTransition(() => root.render(createElement(Ready, { done: () => resolve(m) }, node)))
})
