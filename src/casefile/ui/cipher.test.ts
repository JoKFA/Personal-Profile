import { webcrypto } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { blocksOf, checkText, cipherText, seal } from './cipher'

// jsdom has no layout, so a run here has block spans but no covers: what is checked is the cryptography,
// the block arithmetic, and that a run leaves the page exactly as it found it.
beforeAll(() => { if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }) })
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

const page = () => {
  // p is `position: static` by rule, so a run has to give it its own positioning and take it away again
  // (its inline style is written the way the browser serialises it, which is how React's always is)
  document.head.innerHTML = '<style>p { position: static; }</style>'
  document.body.innerHTML = `
    <article id="host">
      <h1>Short</h1>
      <p style="color: red;">Hello <b>world</b> and more text here that goes on</p>
      <ul><li>0123456789abcdef</li><li>0123456789abcdef0</li></ul>
    </article>`
  const h = document.getElementById('host')!
  return { host: h, targets: [h.querySelector<HTMLElement>('h1')!, h.querySelector<HTMLElement>('p')!, h.querySelector<HTMLElement>('ul')!] }
}

describe('seal', () => {
  it('verifies, and fails when one byte changes', async () => {
    const s = await seal('The quick brown fox')
    expect(await s.verify()).toBe(true)
    s.ct[3] ^= 1
    expect(await s.verify()).toBe(false)
  })

  it('never gives the same ciphertext twice for the same text (a fresh IV each time)', async () => {
    const a = await seal('same text'), b = await seal('same text')
    expect(a.iv).not.toEqual(b.iv)
    expect(a.ct).not.toEqual(b.ct)
  })
})

describe('blocks', () => {
  it('count 16 characters each, every text node rounding up on its own', () => {
    expect(blocksOf([1, 16, 17, 32, 33])).toBe(1 + 1 + 2 + 2 + 3)
    expect(blocksOf([])).toBe(0)
  })

  it('a run covers exactly the blocks the arithmetic says, whitespace between elements not counted', async () => {
    const { targets } = page()
    // "Short" 1 · "Hello " 1 · "world" 1 · " and more text here that goes on" (32) 2 · 16 → 1 · 17 → 2
    const expected = blocksOf([5, 6, 5, 32, 16, 17])
    const run = await cipherText(targets)
    expect(run.blocks).toBe(expected)
    expect(document.querySelectorAll('.cb').length).toBe(expected)
    run.restore()
  })

  it('check the tag for real, without touching the page', async () => {
    const { host, targets } = page()
    const before = host.innerHTML
    const { blocks, ok } = await checkText(targets)
    expect(ok).toBe(true)
    expect(blocks).toBe(blocksOf([5, 6, 5, 32, 16, 17]))
    expect(host.innerHTML).toBe(before)
  })
})

describe('a run', () => {
  it('puts the page back exactly: same HTML, the same text nodes, the targets own style', async () => {
    const { host, targets } = page()
    const before = host.innerHTML, nodes = [...host.querySelectorAll('h1, p, b, li')].flatMap((el) => [...el.childNodes])
    const run = await cipherText(targets)
    expect(host.innerHTML).not.toBe(before)
    run.restore()
    expect(host.innerHTML).toBe(before)
    // the very nodes React owns, not copies of them
    expect([...host.querySelectorAll('h1, p, b, li')].flatMap((el) => [...el.childNodes])).toEqual(nodes)
    expect(targets[0].hasAttribute('style')).toBe(false)
    expect(targets[1].getAttribute('style')).toBe('color: red;')
  })

  it('restoring twice, or after the page moved on, is harmless', async () => {
    const { host, targets } = page()
    const before = host.innerHTML
    const run = await cipherText(targets)
    run.restore(); run.restore()
    expect(host.innerHTML).toBe(before)
    const again = await cipherText(targets)
    host.remove()                    // the page unmounted first
    expect(() => again.restore()).not.toThrow()
  })

  it('decrypts to a verified tag, and says null when it is stopped first', async () => {
    const { targets } = page()
    const run = await cipherText(targets)
    expect(document.querySelectorAll('.cb.enc').length).toBe(run.blocks)
    expect(await run.decrypt(30)).toBe(true)
    expect(document.querySelectorAll('.cb.enc').length).toBe(0)
    run.restore()

    const second = await cipherText(targets)
    const pending = second.decrypt(5000)
    second.halt()
    expect(await pending).toBeNull()
    second.restore()
  })

  it('a prepared seal starts readable and covers again from the last block', async () => {
    const { targets } = page()
    const run = await cipherText(targets, 'plain')
    expect(document.querySelectorAll('.cb.enc').length).toBe(0)
    await run.encrypt(30)
    expect(document.querySelectorAll('.cb.enc').length).toBe(run.blocks)
    run.restore()
  })
})
