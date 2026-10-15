// Shared by the phone shell's specs (phone.spec.ts, csp.spec.ts). Everything is found by role, accessible name or a stable data attribute: no pixel positions,
// and no window globals (the production build has none).
import { expect, type BrowserContext, type Page } from '@playwright/test'

/** what a visit must never produce: page errors, console errors, CSP violations */
export interface Watch { errors: string[]; violations(): Promise<string[]> }
export async function watch(page: Page): Promise<Watch> {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] }
    w.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  return { errors, violations: () => page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []) }
}

/** a return visitor: the entry page is not shown (the shell remembers the visit in localStorage) */
export const returning = (page: Page) => page.addInitScript(() => { try { localStorage.setItem('yw.entry', '1') } catch { /* private mode */ } })

/** play() refused, as iOS does in low-power mode: the shell must fall back to its stills */
export const refusePlay = (page: Page) => page.addInitScript(() => {
  HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('play() refused by the test', 'NotAllowedError'))
})

/** the cover is on screen and the shell is accepting input: the profile's door is there and the entry is over */
export async function coverReady(page: Page) {
  await expect(page.getByRole('button', { name: /Open the profile/ })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('.ph-gate')).toHaveCount(0)
  await expect(page.locator('.ph-root')).not.toHaveAttribute('data-entering', /.*/, { timeout: 30_000 })
  await expect(page.locator('html')).not.toHaveClass(/ph-entry/, { timeout: 30_000 })   // (the reel snaps once the entry is over)
}

/** scroll position, in screens */
export const screens = (page: Page) => page.evaluate(() => scrollY / innerHeight)
/** wait for the scroll to come to rest (a snap settles) */
export async function settled(page: Page) {
  let last = -1, still = 0
  await expect.poll(async () => { const y = await page.evaluate(() => Math.round(scrollY)); still = y === last ? still + 1 : 0; last = y; return still }, { timeout: 15_000, intervals: [120] }).toBeGreaterThanOrEqual(6)
}

/**
 * Scroll the page by `n` screens, one wheel notch (500 px, under a screen) per screen: the browser's own scrolling runs and the reel's mandatory snap carries each notch to the next
 * whole screen. (The bundled headless Chromium does not run the snap after a synthetic touch drag every time, so the notch is the input that proves it; a real finger is the phone checks'.)
 * n < 0 scrolls the other way.
 */
export async function scrollScreens(page: Page, n = 1) {
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
  await page.mouse.move(w / 2, h * 0.5)
  for (let k = 0; k < Math.abs(n); k++) {
    await page.mouse.wheel(0, Math.sign(n) * Math.min(500, h * 0.6))
    await page.waitForTimeout(300)
    await settled(page)
    // the reel's snap is mandatory: a scroll ends on a whole screen
    await expect.poll(async () => { const at = await page.evaluate(() => scrollY / innerHeight); return Math.abs(at - Math.round(at)) }, { timeout: 5000, message: 'the scroll ends on a snap point' }).toBeLessThan(0.02)
  }
}

/** hold a finger on the entry page's print until it is sealed; the page then leaves by itself */
export async function holdToVerify(page: Page) {
  const gate = page.getByRole('dialog', { name: /Entry/ })
  await expect(gate).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Hold to verify')).toBeVisible()
  const cdp = await page.context().newCDPSession(page)
  const [x, y, w, h] = (await page.locator('.ph-gate').getAttribute('data-print'))!.split(',').map(Number)
  const touch = (type: 'touchStart' | 'touchEnd', px = 0, py = 0) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py, id: 1 }] })
  await touch('touchStart', x + w / 2, y + h / 2)
  await expect(page.locator('.ph-gate')).toHaveAttribute('data-phase', /seal|done|leave/, { timeout: 20_000 }).catch(() => { /* the phase names are the page's own; the gate leaving is the check */ })
  await expect(page.locator('.ph-gate')).toHaveCount(0, { timeout: 40_000 })
  await touch('touchEnd')
  await cdp.detach()
}

/** open the file of this stop on the reel: the Open button (accessible name `Open <title>`) */
export async function openFile(page: Page, title: string) {
  // one tap, however the reel is moving (a tap on the stop a pan is heading for is taken): the file has its URL at once
  await page.getByRole('button', { name: `Open ${title}`, exact: true }).click()
  await expect(page).toHaveURL(/\/projects\//, { timeout: 5000 })
}
/** a heading by its words: the text is set in pieces (the decrypting lines), so the accessible name has gaps in it; the text content does not */
export const heading = (page: Page, text: string) => page.getByRole('heading').filter({ hasText: text }).first()
/** the file page is up: the URL, the entry's heading, and a body of text */
export async function fileOpen(page: Page, slug: string, title: string) {
  await expect(page).toHaveURL(new RegExp(`/projects/${slug}$`), { timeout: 30_000 })
  await expect(heading(page, title)).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.locator('.ph-fbody').first().innerText().then((t) => t.length), { timeout: 30_000 }).toBeGreaterThan(300)
}
export async function back(page: Page) {
  // one tap on `← All files`: while the file is still opening it stops the open, once it is open it is the normal close
  await page.getByRole('button', { name: '← All files' }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
}

export async function enterThroughDoor(page: Page) {
  // one tap on the door, wherever the reel is (a pan to the cover is taken over)
  await page.getByRole('button', { name: /Open the profile/ }).click()
  await expect(page).toHaveURL(/\/projects\/profile$/, { timeout: 5000 })
  await expect(page.locator('.ph-sp[data-area]')).toBeVisible({ timeout: 60_000 })
}
export const noOverflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
export type { BrowserContext }
