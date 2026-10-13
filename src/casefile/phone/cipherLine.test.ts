import { webcrypto } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { blocksOf, Line, seal } from './cipherLine'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  // jsdom has no canvas: the bit strips are painted on a stub
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => ({ fillStyle: '', fillRect() {} }), configurable: true })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', { value: () => 'data:,', configurable: true })
})

describe('cipherLine', () => {
  it('seal verifies the GCM tag, and fails when one byte changes', async () => {
    const s = await seal('The quick brown fox')
    expect(await s.verify()).toBe(true)
    s.ct[3] ^= 1
    expect(await s.verify()).toBe(false)
  })
  it('blocksOf: each text rounds up to whole 16-character blocks', () => {
    expect(blocksOf([1, 16, 17, 32])).toBe(1 + 1 + 2 + 2)
  })
  it('a line is split into 16-character blocks that keep the text, and holds real ciphertext once sealed', async () => {
    const text = 'Sandboxes any MCP server in Docker and runs 14 detectors.'
    const host = document.createElement('div'), l = new Line(host, 'x', text, 'p')
    expect(l.spans.length).toBe(Math.ceil(text.length / 16))
    expect(l.el.textContent).toBe(text)
    const sd = await l.ready
    expect(sd).not.toBeNull()
    expect(l.sealed).toBe(true)
    expect(await sd!.verify()).toBe(true)
    // sealed at 0: every block's letters are hidden under its cipher bits; at 1: all readable
    l.set(0)
    expect(l.spans.every((s) => s.style.color === 'transparent')).toBe(true)
    l.set(1)
    expect(l.spans.every((s) => s.style.color === '')).toBe(true)
  })
  it('without crypto the text stays readable (nothing is hidden that could not be shown again)', async () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      const l = new Line(document.createElement('div'), 'x', 'plain text that is longer than sixteen', 'p')
      expect(await l.ready).toBeNull()
      l.set(0)
      expect(l.spans.every((s) => s.style.color === '')).toBe(true)
    } finally {
      if (real) Object.defineProperty(globalThis, 'crypto', real)
    }
  })
})
