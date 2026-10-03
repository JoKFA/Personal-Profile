// Safari's engine (WebKit). On Windows it has no GPU, so frame rate is not judged here; this
// checks that the archive renders, a file opens and closes, and nothing throws.
import { expect, test } from '@playwright/test'

type Win = Window & { __cf: { getSnapshot(): { mode: string; readable: number }; jumpTo(id: string): void } }

test('webkit: the archive renders, a file opens and closes, no errors', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/?intro')
  await page.getByRole('button', { name: /Skip|Continue/ }).click({ timeout: 10_000 })
  await page.waitForFunction(() => (window as unknown as Win).__cf?.getSnapshot().mode === 'archive', null, { timeout: 90_000 })
  // a first visit opens the subject file by itself once the entrance settles: close it
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'file', null, { timeout: 30_000 })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'archive', null, { timeout: 30_000 })
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().readable > 10, null, { timeout: 20_000 })
  await page.evaluate(() => (window as unknown as Win).__cf.jumpTo('X-001')); await page.waitForTimeout(1500)
  await page.locator('.panel .go').click()
  await expect(page.locator('.file-meta h1')).toHaveText('MCP Security Framework', { timeout: 30_000 })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'archive', null, { timeout: 30_000 })
  expect(errors).toEqual([])
})
