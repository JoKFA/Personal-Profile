// Mounting the file page's React trees into the shell's DOM. A separate chunk (the phone shell's first screen does not carry React demos).
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { renderInSlices } from '../slices'
import type { Entry } from '../../../data/types'
import { PhoneBody, PhoneDemo, type Bridge } from './FileParts'
import './file.css'
import './demos.css'

export interface Mounted { el: HTMLElement; unmount(): void }

const mount = (el: HTMLElement, node: ReturnType<typeof createElement>): Mounted => {
  const root = createRoot(el)
  flushSync(() => root.render(node))
  return { el, unmount() { flushSync(() => root.unmount()) } }
}

/** the body (and, for the restricted file, its game below the window's head) */
export const mountBody = (el: HTMLElement, entry: Entry, bridge: Bridge): Mounted =>
  mount(el, createElement(PhoneBody, { entry, bridge, below: entry.kind === 'restricted' && entry.demo ? createElement('div', { className: 'ph-fgame' }, createElement(PhoneDemo, { entry, bridge })) : null }))

/** P6b: the same body, rendered in slices (the file's view is built before the tap, in steps) */
export const mountBodyAsync = (el: HTMLElement, entry: Entry, bridge: Bridge): Promise<Mounted> =>
  renderInSlices(el, createElement(PhoneBody, { entry, bridge, below: entry.kind === 'restricted' && entry.demo ? createElement('div', { className: 'ph-fgame' }, createElement(PhoneDemo, { entry, bridge })) : null }))

/** P6b: the demo rendered in slices (the hidden mount that measures where its core is) */
export const mountDemoAsync = (el: HTMLElement, entry: Entry, bridge: Bridge): Promise<Mounted> => renderInSlices(el, createElement(PhoneDemo, { entry, bridge }))

export const mountDemo = (el: HTMLElement, entry: Entry, bridge: Bridge): Mounted => mount(el, createElement(PhoneDemo, { entry, bridge }))
