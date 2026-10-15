// Mounting the interior's paper (React) into the shell's DOM. A separate chunk with the sheet, the shared file body and nothing of three.js.
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { renderInSlices } from '../slices'
import { SpaceSheet, type SheetProps } from './SpaceSheet'
import '../file/file.css'
import './space.css'

/** P6b: rendered in slices (the interior's paper is built while the cover is on screen) */
export const mountSheetAsync = (el: HTMLElement, props: SheetProps) => renderInSlices(el, createElement(SpaceSheet, props))

export function mountSheet(el: HTMLElement, props: SheetProps) {
  const root = createRoot(el)
  flushSync(() => root.render(createElement(SpaceSheet, props)))
  return { unmount() { flushSync(() => root.unmount()) } }
}
