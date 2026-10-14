import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryBridge, isFirstVisit, type EntryCtl } from './entry'

const ctl = () => ({ prime: vi.fn(), enter: vi.fn().mockResolvedValue(undefined) }) satisfies EntryCtl
const gate = () => document.createElement('div')

beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/') })
afterEach(() => { localStorage.clear(); history.replaceState(null, '', '/') })

describe('first visit or return visit (plan 2.6)', () => {
  it('a visit with no yw.entry is a first visit, and a visit with it is not', () => {
    expect(isFirstVisit()).toBe(true)
    localStorage.setItem('yw.entry', '1'); expect(isFirstVisit()).toBe(false)
  })
  it('?intro shows the entry page again; a link to a file never does', () => {
    localStorage.setItem('yw.entry', '1')
    history.replaceState(null, '', '/?intro'); expect(isFirstVisit()).toBe(true)
    localStorage.clear()
    history.replaceState(null, '', '/projects/mcp-security-framework'); expect(isFirstVisit()).toBe(false)
  })
})

describe('EntryBridge: the page and the controller may be ready in either order', () => {
  it('sealed before the controller exists: the entrance starts when the controller attaches, once', async () => {
    const b = new EntryBridge(false), c = ctl(), done = vi.fn(); b.whenDone(done)
    b.seal({ root: gate(), skipped: false })
    expect(c.enter).not.toHaveBeenCalled()
    b.attach(c); b.attach(c)
    expect(c.enter).toHaveBeenCalledTimes(1)
    await Promise.resolve(); await Promise.resolve()
    expect(done).toHaveBeenCalledTimes(1)
  })
  it('the controller first: the entrance starts at the seal, with what the page said', () => {
    const b = new EntryBridge(true), c = ctl(); b.attach(c)
    const root = gate(); b.seal({ root, skipped: true })
    expect(c.enter).toHaveBeenCalledTimes(1)
    expect(c.enter.mock.calls[0][0]).toBe(root)
    expect(c.enter.mock.calls[0][1]).toMatchObject({ skipped: true, reduced: true })
  })
  it('sealing marks the visit: the next load is a return visit', () => {
    const b = new EntryBridge(false); expect(localStorage.getItem('yw.entry')).toBeNull()
    b.seal({ root: gate(), skipped: false })
    expect(localStorage.getItem('yw.entry')).toBe('1')
  })
  it('every press unlocks the pool; a press that came before the controller is replayed when it attaches', () => {
    const b = new EntryBridge(false), c = ctl()
    b.press(true)
    b.attach(c); expect(c.prime).toHaveBeenCalledTimes(1)
    b.press(false); expect(c.prime).toHaveBeenCalledTimes(2)
    expect(b.log.firstPressAt).toBeGreaterThan(0)
  })
  it('no press, no replay', () => { const b = new EntryBridge(false), c = ctl(); b.attach(c); expect(c.prime).not.toHaveBeenCalled() })
})
