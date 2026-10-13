import { cleanup, fireEvent, render } from '@testing-library/react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ENTRIES } from '../../data/entries'
import { FileBody, FileHead } from './FileBody'
import { tabsFor } from './tabs'

afterEach(cleanup)
const session = { visitor: 'V-TEST', risk: 7, audit: [['10:00:00', 'one']] as [string, string][] }
const read = (layout: 'tabs' | 'stacked', e: (typeof ENTRIES)[number]) => render(<FileBody entry={e} layout={layout} onJump={() => {}} session={session} />)

describe('FileBody: every entry reads in full, in both layouts', () => {
  it('there are entries of every kind to read', () => {
    expect(new Set(ENTRIES.map((e) => e.kind)).size).toBeGreaterThanOrEqual(6)
  })
  for (const e of ENTRIES) {
    it(`${e.id} (${e.kind}) · tabs`, () => {
      const { container } = read('tabs', e)
      expect(container.textContent!.trim().length).toBeGreaterThan(20)
      expect(container.querySelector('.file-sum')!.textContent!.length).toBeGreaterThan(0)
      const tabs = tabsFor(e, session.visitor, session.audit, () => {}, session.risk)
      const strip = [...container.querySelectorAll<HTMLElement>('.file-tabs [role=tab]')]
      expect(strip.length).toBe(tabs.length)
      expect(container.querySelectorAll('.file-tab').length).toBe(1)
      // a click on a tab opens that tab (kept here when the shell does not control it)
      strip.forEach((t, i) => { fireEvent.click(t); expect(container.querySelector('.file-tabs [aria-selected=true]')).toBe(container.querySelectorAll('.file-tabs [role=tab]')[i]) })
    })
    it(`${e.id} (${e.kind}) · stacked`, () => {
      const { container } = read('stacked', e)
      const tabs = tabsFor(e, session.visitor, session.audit, () => {}, session.risk)
      const sections = [...container.querySelectorAll('.file-stack > section.file-tab')]
      expect(sections.length).toBe(tabs.length)
      expect(container.querySelector('[role=tablist]')).toBeNull()
      sections.forEach((s, i) => expect(s.querySelector('h2')!.textContent).toContain(tabs[i].label))
      expect(container.textContent!.trim().length).toBeGreaterThan(20)
      // the stacked page has every tab's words; the tabbed page only the open one's
      const tabbed = read('tabs', e).container
      expect(container.textContent!.length).toBeGreaterThanOrEqual(tabbed.textContent!.length)
    })
  }
  it('the slots land where the desktop has the interior words, and a jump goes to the shell', () => {
    const e = ENTRIES.find((x) => x.kind === 'subject')!
    const onJump = vi.fn()
    const { container } = render(<FileBody entry={e} layout="tabs" onJump={onJump} session={session} exhibit={<i data-x="a" />} exhibitIndex={<i data-x="b" />} />)
    const order = [...container.children].map((c) => (c as HTMLElement).dataset.x ?? c.className)
    expect(order.indexOf('a')).toBeGreaterThan(order.indexOf('file-creds'))
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('file-sum'))
    expect(order[order.length - 1]).toBe('b')
    expect(order[order.length - 2]).toBe('file-act')
    const rel = ENTRIES.find((x) => x.related?.length)!
    const r = render(<FileBody entry={rel} layout="stacked" onJump={onJump} session={session} />)
    fireEvent.click(r.container.querySelector('.file-rel')!)
    expect(onJump).toHaveBeenCalledWith(rel.related![0])
  })
  it('the visitor file shows the session it is given', () => {
    const e = ENTRIES.find((x) => x.kind === 'visitor')!
    const { container } = read('stacked', e)
    expect(container.textContent).toContain('V-TEST')
    expect(container.textContent).toContain('Risk 07')
  })
  it('the head names the file and its drawer; the seal line is for the shell to ask for', () => {
    const e = ENTRIES.find((x) => x.kind === 'case')!
    const { container, rerender } = render(<FileHead entry={e} heading="A title" />)
    expect(container.querySelector('h1')!.textContent).toBe('A title')
    expect(container.querySelector('.file-eyebrow')!.textContent).toContain(e.id)
    expect(container.querySelector('.file-verify')).toBeNull()
    rerender(<FileHead entry={e} heading="A title" verify />)
    expect(container.querySelector('.file-verify')).not.toBeNull()
  })
})

describe('the shared content does not reach into a shell', () => {
  const dir = __dirname.replace(/\\/g, '/')
  const files = [
    ...readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => join(dir, f)),
    ...readdirSync(join(dir, '../demos')).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f) && f !== 'DesktopDemoCtx.tsx').map((f) => join(dir, '../demos', f)),
  ]
  it('imports no archive context, scene, space, gsap or three', () => {
    expect(files.length).toBeGreaterThan(15)
    for (const f of files) {
      const imports = [...readFileSync(f, 'utf8').matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
      for (const spec of imports) expect(spec, `${f} imports ${spec}`).not.toMatch(/(^|\/)(context|scene|space)(\/|$)|^gsap$|^three(\/|$)/)
    }
  })
})
