// The Content-Security-Policy in practice: the production build, served by `vite preview` with vercel.json's headers, is walked along its main paths and must raise no
// `securitypolicyviolation` event, no console error and no page error. The phone path runs in phone-390, the desktop path in desktop-1440; both use the production build (no test hooks).
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { CONTACT, entryById } from '../src/casefile/data/entries'
import { back, coverReady, enterThroughDoor, fileOpen, holdToVerify, openFile, scrollScreens, watch } from './phone-helpers'

const PROD = `http://127.0.0.1:${process.env.E2E_PROD_PORT ?? 4173}`
test.use({ baseURL: PROD })

const policy = () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  return v.headers.find((h) => h.source === '/(.*)')!.headers.find((h) => h.key === 'Content-Security-Policy')!.value
}

test('the server sends the site\'s policy, so the walks below mean something', async ({ request }) => {
  const res = await request.get('/')
  const sent = res.headers()['content-security-policy']
  expect(sent, 'a Content-Security-Policy header').toBeTruthy()
  // (the local preview leaves out upgrade-insecure-requests: there is no https here)
  for (const d of policy().split(';').map((x) => x.trim()).filter((x) => x && x !== 'upgrade-insecure-requests')) expect(sent).toContain(d)
  expect(sent).toContain("script-src 'self'")
  expect(sent).toContain("style-src 'self'")
})

test('the watch can fail: an inline script is blocked and seen', async ({ page }) => {
  const w = await watch(page)
  await page.goto('/')
  await page.evaluate(() => { const el = document.createElement('script'); el.textContent = 'window.__ran = true'; document.head.appendChild(el) })
  await expect.poll(async () => (await w.violations()).length).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran)).toBeUndefined()
})

test('phone path: the entry, the reel, a file, the Index, Contact and the profile raise nothing', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-390', 'the phone path')
  test.setTimeout(240_000)
  const w = await watch(page)
  const title = (id: string) => entryById.get(id)!.title
  await page.goto('/')
  await holdToVerify(page)
  await coverReady(page)
  await scrollScreens(page, 1)
  await openFile(page, title('X-001'))
  await fileOpen(page, entryById.get('X-001')!.slug, title('X-001'))
  await back(page)
  await page.evaluate(() => scrollTo(0, 0))
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Index' }).click()
  const row = page.locator('button.ph-ix[data-id="X-002"]')
  await expect(row).toBeVisible()
  await row.click()
  await fileOpen(page, entryById.get('X-002')!.slug, title('X-002'))
  await back(page)
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Contact' }).click()
  await expect(page.getByRole('region', { name: 'Contact' }).getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', CONTACT.github)
  await page.evaluate(() => scrollTo(0, 0))
  await enterThroughDoor(page)
  await page.getByRole('navigation', { name: 'Work areas' }).getByRole('button', { name: /AI tools/ }).click()
  await expect(page.locator('.ph-sp[data-area="mcp"]')).toBeVisible({ timeout: 45_000 })
  await back(page)
  await expect(page.getByRole('button', { name: /Open the profile/ })).toBeVisible({ timeout: 30_000 })
  expect(w.errors).toEqual([])
  expect(await w.violations()).toEqual([])
})

test('desktop path: the entry, the archive, a file and back raise nothing', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1440', 'the desktop path')
  test.setTimeout(240_000)
  const w = await watch(page)
  await page.goto('/?intro')
  await page.getByRole('button', { name: /Skip|Continue/ }).click({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Enter the archive/ })).toBeVisible({ timeout: 90_000 })
  await page.getByRole('button', { name: /Enter the archive/ }).click()
  await page.waitForTimeout(1500)
  await page.goto('/projects/mcp-security-framework')
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 60_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 })
  await page.waitForTimeout(1000)
  expect(w.errors).toEqual([])
  expect(await w.violations()).toEqual([])
})
