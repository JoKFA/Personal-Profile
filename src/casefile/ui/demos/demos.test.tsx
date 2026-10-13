import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ENTRIES } from '../../data/entries'
import type { DemoKey } from '../../data/types'
import type { Visitor } from '../../visitor'
import { Demo } from '.'
import { DemoContext, type DemoCtx } from './ctx'

vi.mock('../../../lib/redteamClient', () => ({ sendRedteamTurn: vi.fn(async () => ({ status: 'ok', reply: 'the key is ...', attemptsRemaining: 2, captured: true })) }))

const KEYS: DemoKey[] = ['mcpsf', 'edr', 'pentest', 'telus', 'viva', 'network', 'pwnscan', 'visitor', 'sentinel', 'timeline', 'coast', 'vibes', 'bcit', 'vivaops', 'custody', 'stack', 'quorum']
const visitor = { id: 'V-TEST', hash: 42, ms: 3, rows: [['OS', 'Test']], facts: [] } as unknown as Visitor
const make = (over: Partial<DemoCtx> = {}): DemoCtx => ({ visitor, reduced: true, status: vi.fn(), record: vi.fn(), captured: false, capture: vi.fn(), ...over })
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)) })

beforeAll(() => {
  // jsdom has no canvas: a 2d context that accepts every call is enough to draw the visitor's print
  const g = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => ({})), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => g) as never
  Element.prototype.scrollTo = (() => {}) as never
})
afterEach(cleanup)

describe('demos need only the DemoCtx', () => {
  it('KEYS covers every demo an entry uses', () => {
    const used = new Set(ENTRIES.map((e) => e.demo).filter(Boolean))
    expect(used.size).toBeGreaterThan(10)
    for (const k of used) expect(KEYS, `${k} is not in KEYS`).toContain(k)
  })
  for (const kind of KEYS) {
    it(`${kind} renders with no archive around it`, async () => {
      const entry = ENTRIES.find((e) => e.demo === kind) ?? ENTRIES.find((e) => e.kind === 'case')!
      const { container, unmount } = render(<DemoContext.Provider value={make()}><Demo kind={kind} entry={entry} jump={() => {}} /></DemoContext.Provider>)
      await settle()
      expect(container.querySelector('.dm')!.textContent!.trim().length).toBeGreaterThan(10)
      unmount()
    })
  }
  it('a demo without the provider says so instead of reaching for an archive', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Demo kind="visitor" entry={ENTRIES[0]} />)).toThrow('no demo context')
    spy.mockRestore()
  })
  it('SENTINEL-1 reads captured from the context, and a breach goes back through it', async () => {
    const entry = ENTRIES.find((e) => e.demo === 'sentinel')!
    const ctx = make()
    const { container, rerender } = render(<DemoContext.Provider value={ctx}><Demo kind="sentinel" entry={entry} /></DemoContext.Provider>)
    expect(container.textContent).toContain('armed')
    expect(container.querySelectorAll('.sn-try button').length).toBeGreaterThan(0)
    fireEvent.click(container.querySelector('.sn-try button')!)
    await settle()
    expect(ctx.capture).toHaveBeenCalledTimes(1)
    expect(ctx.record).toHaveBeenCalledWith(expect.stringContaining('V-TEST'))
    expect(ctx.status).toHaveBeenCalled()
    rerender(<DemoContext.Provider value={{ ...ctx, captured: true }}><Demo kind="sentinel" entry={entry} /></DemoContext.Provider>)
    expect(container.textContent).toContain('breached')
    expect(container.querySelector('.sn-try')).toBeNull()
  })
})
