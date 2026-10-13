import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ENTRIES } from '../../../data/entries'
import type { Visitor } from '../../../visitor'
import { Line } from '../../cipherLine'
import { pageIndex, sampleAt } from '../clock'
import { PhoneBody, PhoneDemo, type Bridge } from './FileParts'

vi.mock('../../../../lib/redteamClient', () => ({ sendRedteamTurn: vi.fn(async () => ({ status: 'error', code: 'network', message: 'x' })) }))

const visitor = { id: 'V-TEST', hash: 42, ms: 3, rows: [['OS', 'Test']], facts: [] } as unknown as Visitor
const bridge: Bridge = { visitor, reduced: true, status: vi.fn(), record: vi.fn(), onCapture: vi.fn(), audit: [], jump: vi.fn() }
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)) })

beforeAll(() => {
  const g = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : () => ({})), set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => g) as never
  Element.prototype.scrollTo = (() => {}) as never
})
afterEach(cleanup)

const OPENABLE = ENTRIES.filter((e) => e.kind !== 'skill' && e.kind !== 'credential')

describe('the phone file page', () => {
  it('every stop entry renders its body in the stacked layout and its demo in the phone provider', async () => {
    expect(OPENABLE.length).toBe(19)
    for (const e of OPENABLE) {
      const body = render(<PhoneBody entry={e} bridge={bridge} />)
      expect(body.container.querySelectorAll('.file-tab--stacked').length, `${e.id} stacked sections`).toBeGreaterThan(0)
      expect(body.container.querySelectorAll('[data-redact]').length, `${e.id} text to decrypt`).toBeGreaterThan(0)
      body.unmount()
      if (!e.demo) continue
      const demo = render(<PhoneDemo entry={e} bridge={bridge} />)
      await settle()
      expect(demo.container.querySelector('.dm')!.textContent!.trim().length, `${e.id} demo text`).toBeGreaterThan(10)
      expect(demo.container.querySelector('[data-core]'), `${e.id} has a data-core element`).not.toBeNull()
      demo.unmount()
    }
  })
  it('the subject file carries a marked, empty slot for the interior exhibit', () => {
    const { container } = render(<PhoneBody entry={ENTRIES.find((e) => e.kind === 'subject')!} bridge={bridge} />)
    expect(container.querySelector('[data-slot="p3c-interior-exhibit"]')).not.toBeNull()
  })
  it('a line adopts the text of an element and keeps its blocks', () => {
    const el = document.createElement('p'); el.textContent = 'x'.repeat(40)
    const l = Line.adopt(el)
    expect(l.spans.length).toBe(3)
    expect(el.textContent).toBe('x'.repeat(40))
  })
})

describe('the page layer leads the picture by half a frame', () => {
  it('samples a per-frame table linearly between two frames', () => {
    expect(sampleAt([0, 10, 20], 0.5)).toBe(5)
    expect(sampleAt([0, 10, 20], 1.75)).toBe(17.5)
    expect(sampleAt([0, 10, 20], 9)).toBe(20)
    expect(sampleAt([0, 10, 20], -2)).toBe(0)
  })
  it('the frame position is the media time in frames plus half a frame, capped at the last frame', () => {
    expect(pageIndex(0.4, 25, 49)).toBeCloseTo(10.5)
    expect(pageIndex(5, 25, 49)).toBe(49)
  })
})
