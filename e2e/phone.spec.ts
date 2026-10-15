// The phone shell (src/casefile/phone/app) end to end, in a phone-sized touch browser (projects phone-390 and phone-short; @short marks the ones the short phone repeats).
// It runs against the production build: nothing here uses a window global or a test flag. Roles, accessible names and data attributes only.
import { expect, test } from '@playwright/test'
import { CONTACT, entryById } from '../src/casefile/data/entries'
import { back, coverReady, heading, enterThroughDoor, fileOpen, holdToVerify, noOverflowX, openFile, refusePlay, returning, screens, settled, scrollScreens, watch } from './phone-helpers'

const title = (id: string) => entryById.get(id)!.title
/** a stop's heading on the reel: the employer for a job (the file page's own title is the role) */
const stopTitle = (id: string) => { const e = entryById.get(id)!; return e.kind === 'service' ? e.org ?? e.title : e.title }
const slug = (id: string) => entryById.get(id)!.slug
const areas = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Work areas' })

test.describe('phone shell', () => {
  test('first visit: the entry page asks for a hold, the hold seals it, the entrance plays and the cover is there @short', async ({ page }) => {
    const w = await watch(page)
    await page.goto('/')
    await holdToVerify(page)
    await coverReady(page)
    expect(await page.evaluate(() => localStorage.getItem('yw.entry'))).toBe('1')
    await expect(heading(page, 'Yaoting Wang')).toBeVisible()
    expect(await noOverflowX(page)).toBe(true)
    expect(w.errors).toEqual([])
    expect(await w.violations()).toEqual([])
  })

  test('a return visit has no entry page @short', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await expect(page.getByRole('dialog', { name: /Entry/ })).toHaveCount(0)
    // ?intro plays the entry again, on request
    await page.goto('/?intro')
    await expect(page.getByRole('dialog', { name: /Entry/ })).toBeVisible({ timeout: 30_000 })
    expect(w.errors).toEqual([])
  })

  test('the reel: cover to 04, each a whole screen, each snapped', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    const stops = ['YW-000', 'X-001', 'SR-01', 'SR-02', 'X-009']
    for (let i = 1; i < stops.length; i++) {
      await scrollScreens(page, 1)
      const at = await screens(page)
      expect(Math.abs(at - Math.round(at)), `stop ${i} is on a snap point (${at} screens)`).toBeLessThan(0.02)
      expect(Math.round(at)).toBe(i)
      await expect(heading(page, stopTitle(stops[i]))).toBeInViewport()
    }
    // and back up: one screen at a time to the cover
    for (let i = stops.length - 2; i >= 0; i--) {
      await scrollScreens(page, -1)
      expect(Math.round(await screens(page))).toBe(i)
    }
    expect(w.errors).toEqual([])
  })

  test('open X-001: the window and the body, then back to the same stop @short', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await scrollScreens(page, 1)
    const stopY = await page.evaluate(() => Math.round(scrollY))
    await openFile(page, title('X-001'))
    await fileOpen(page, slug('X-001'), title('X-001'))
    expect(await noOverflowX(page)).toBe(true)
    // the body reads by scrolling the page itself
    await page.evaluate(() => scrollTo(0, 600))
    await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(300)
    await page.evaluate(() => scrollTo(0, 0))
    await back(page)
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: `Open ${title('X-001')}`, exact: true })).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => page.evaluate(() => Math.round(scrollY)), { timeout: 10_000 }).toBe(stopY)
    expect(w.errors).toEqual([])
  })

  test('Index: open an entry that is not on the reel, then back to the same row', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Index' }).click()
    const row = page.locator('button.ph-ix[data-id="X-002"]')
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.scrollIntoViewIfNeeded()
    await settled(page)
    const before = (await row.boundingBox())!.y
    const yBefore = await page.evaluate(() => Math.round(scrollY))
    await row.click()
    await fileOpen(page, slug('X-002'), title('X-002'))
    await back(page)
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
    await expect(row).toBeVisible({ timeout: 20_000 })
    await settled(page)
    expect(Math.abs((await row.boundingBox())!.y - before), 'the row is where it was').toBeLessThan(3)
    expect(Math.abs((await page.evaluate(() => Math.round(scrollY))) - yBefore)).toBeLessThan(3)
    expect(w.errors).toEqual([])
  })

  test('Contact: the four links go where they say @short', async ({ page, context }) => {
    const w = await watch(page)
    // no request leaves the machine: every external address is answered by a stub
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }))
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Contact' }).click()
    const section = page.getByRole('region', { name: 'Contact' })
    await expect(section).toBeInViewport({ timeout: 10_000 })
    const link = (name: RegExp) => section.getByRole('link', { name })
    await expect(link(/Email/)).toHaveAttribute('href', `mailto:${CONTACT.email}`)
    await expect(link(/LinkedIn/)).toHaveAttribute('href', CONTACT.linkedin)
    await expect(link(/GitHub/)).toHaveAttribute('href', CONTACT.github)
    await expect(link(/Résumé/)).toHaveAttribute('href', CONTACT.resume)
    for (const name of [/LinkedIn/, /GitHub/, /Résumé/]) await expect(link(name)).toHaveAttribute('target', '_blank')
    await expect(section.getByText(CONTACT.email, { exact: true })).toBeVisible()
    // an external link opens its own tab at that address
    const [tab] = await Promise.all([context.waitForEvent('page'), link(/GitHub/).click()])
    expect(tab.url()).toBe(CONTACT.github)
    await tab.close()
    expect(w.errors).toEqual([])
  })

  /** in the page: the first moment after the Esc keydown at which the stop's still is opaque and no clip is showing (the stage's layers are found by their data-key; a clip is showing while it is `on` and not faded out) */
  const installStillWatch = (page: import('@playwright/test').Page, key: string) => page.evaluate((k) => {
    const w = window as unknown as { __back?: { t0: number; seen: number | null } }
    w.__back = { t0: 0, seen: null }
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !w.__back!.t0) w.__back!.t0 = e.timeStamp }, true)
    const tick = () => {
      const b = w.__back!
      if (b.t0 && b.seen === null) {
        const still = document.querySelector(`.ph-stage img[data-key="${k}"]`) as HTMLElement | null
        const clips = [...document.querySelectorAll('.ph-stage video.on')].filter((v) => Number(getComputedStyle(v).opacity) > 0.02)
        if (still && Number(getComputedStyle(still).opacity) >= 0.99 && !clips.length) b.seen = performance.now()
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, key)
  const stillAfterBack = async (page: import('@playwright/test').Page) => {
    await expect.poll(() => page.evaluate(() => (window as unknown as { __back: { seen: number | null } }).__back.seen), { timeout: 5000 }).not.toBeNull()
    return page.evaluate(() => { const b = (window as unknown as { __back: { t0: number; seen: number } }).__back; return b.seen - b.t0 })
  }
  const closeClipPlayed = (page: import('@playwright/test').Page) => page.evaluate(() => [...document.querySelectorAll('video')].some((v) => /close-/.test(v.getAttribute('src') ?? '') && (!v.paused || v.currentTime > 0)))

  test('Back while a file is opening stops the open at once: the stop is back within 250 ms, no close clip plays, the reel has not moved @short', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await scrollScreens(page, 1)
    const stopY = await page.evaluate(() => Math.round(scrollY))
    await installStillWatch(page, 'stop:X-001')
    await openFile(page, title('X-001'))
    // the open clip is playing, half a second in
    await page.waitForFunction(() => [...document.querySelectorAll('.ph-stage video.on')].some((v) => !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > 0.5), null, { timeout: 30_000, polling: 16 })
    expect(await page.evaluate(() => document.documentElement.classList.contains('ph-filemode')), 'the file layer is up').toBe(true)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/, { timeout: 3000 })
    expect(await stillAfterBack(page), 'Esc to the stop on screen, ms').toBeLessThanOrEqual(250)
    expect(await closeClipPlayed(page), 'no close clip').toBe(false)
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('ph-filemode'))).toBe(false)
    await settled(page)
    expect(await page.evaluate(() => Math.round(scrollY))).toBe(stopY)
    await expect(page.getByRole('button', { name: `Open ${title('X-001')}`, exact: true })).toBeVisible()
    // and the stop opens again, whole, afterwards
    await openFile(page, title('X-001'))
    await fileOpen(page, slug('X-001'), title('X-001'))
    expect(w.errors).toEqual([])
  })

  const panPlaying = (page: import('@playwright/test').Page) => page.waitForFunction(() => [...document.querySelectorAll('.ph-stage video')].some((v) => /pan-/.test(v.getAttribute('src') ?? '') && !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > 0.4), null, { timeout: 15_000, polling: 16 })

  test('Open tapped while the pan to that stop is still playing is taken at once: its open clip starts within 300 ms @short', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await page.mouse.move(100, 300)
    await page.mouse.wheel(0, 500)   // the reel snaps to stop 1 and the pan clip to it starts
    await panPlaying(page)
    await page.evaluate(() => {
      const t = { tap: 0, frame: null as number | null }
      ;(window as unknown as { __tap: typeof t }).__tap = t
      addEventListener('click', (e) => { if (!t.tap && e.target instanceof Element && e.target.closest('.ph-go')) t.tap = e.timeStamp }, true)
      const tick = () => {
        if (t.tap && t.frame === null && location.pathname.startsWith('/projects/') && [...document.querySelectorAll('.ph-stage video')].some((v) => /open-/.test(v.getAttribute('src') ?? '') && !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > 0.001)) t.frame = performance.now()
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const playing = await page.evaluate(() => [...document.querySelectorAll('.ph-stage video')].filter((v) => /pan-/.test(v.getAttribute('src') ?? '') && !(v as HTMLVideoElement).paused).length)
    expect(playing, 'a pan clip is playing at the tap').toBeGreaterThan(0)
    await openFile(page, title('X-001'))
    await expect.poll(() => page.evaluate(() => (window as unknown as { __tap: { frame: number | null } }).__tap.frame), { timeout: 5000 }).not.toBeNull()
    const ms = await page.evaluate(() => { const t = (window as unknown as { __tap: { tap: number; frame: number } }).__tap; return t.frame - t.tap })
    expect(ms, 'tap to the open clip playing, ms').toBeLessThanOrEqual(300)
    await fileOpen(page, slug('X-001'), title('X-001'))
    expect(w.errors).toEqual([])
  })

  test('the bar Back is there within 120 ms of the Open tap, clear of everything else, and takes the mid-open path @short', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await scrollScreens(page, 1)
    await page.waitForFunction(() => !document.querySelector('.ph-stage video.on'), null, { timeout: 15_000 })   // (a settled stop: the pan is the other test)
    await page.evaluate(() => {
      const t = { tap: 0, seen: null as number | null, overlaps: [] as string[] }
      ;(window as unknown as { __bk: typeof t }).__bk = t
      addEventListener('click', (e) => { if (!t.tap && e.target instanceof Element && e.target.closest('.ph-go')) t.tap = e.timeStamp }, true)
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      const tick = () => {
        if (t.tap) {
          const back = document.querySelector('.ph-back') as HTMLElement, cs = getComputedStyle(back), op = Number(cs.opacity), vis = cs.visibility === 'visible'
          if (t.seen === null && vis && op > 0.02) t.seen = performance.now()
          if (vis && op > 0.05) {
            const r = back.getBoundingClientRect()
            for (const s of ['.ph-tag', '.ph-brand', '.ph-nav', '.ph-barfile']) {
              const o = document.querySelector(s) as HTMLElement | null; if (!o) continue
              const c = getComputedStyle(o); if (c.visibility === 'hidden' || Number(c.opacity) < 0.1) continue
              const rr = o.getBoundingClientRect(); if (rr.width && hit(r, rr)) t.overlaps.push(s)
            }
          }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await openFile(page, title('X-001'))
    await expect.poll(() => page.evaluate(() => (window as unknown as { __bk: { seen: number | null } }).__bk.seen), { timeout: 3000 }).not.toBeNull()
    const ms = await page.evaluate(() => { const t = (window as unknown as { __bk: { tap: number; seen: number } }).__bk; return t.seen - t.tap })
    expect(ms, 'Open tap to `← All files` there, ms').toBeLessThanOrEqual(120)
    await page.getByRole('button', { name: '← All files' }).click()   // in that window: the mid-open path
    await expect(page).toHaveURL(/\/$/, { timeout: 3000 })
    await page.waitForTimeout(500)
    expect(await closeClipPlayed(page), 'no close clip').toBe(false)
    expect(await page.evaluate(() => (window as unknown as { __bk: { overlaps: string[] } }).__bk.overlaps), 'the control never overlaps the tag, the name, the links or the label').toEqual([])
    expect(w.errors).toEqual([])
  })

  test('Back while an Index entry is opening: the sheet is back under the same row, and the browser Back does the same', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Index' }).click()
    const row = page.locator('button.ph-ix[data-id="X-002"]')
    await row.scrollIntoViewIfNeeded()
    await settled(page)
    const before = (await row.boundingBox())!.y
    await row.click()
    await expect(page).toHaveURL(/\/projects\//, { timeout: 5000 })
    await page.waitForTimeout(600)
    await page.goBack()   // the browser's Back (a swipe-back is this, with the browser's own animation)
    await expect(page).toHaveURL(/\/$/, { timeout: 3000 })
    await expect(row).toBeVisible({ timeout: 3000 })
    await settled(page)
    expect(Math.abs((await row.boundingBox())!.y - before), 'the row is where it was').toBeLessThan(3)
    expect(await closeClipPlayed(page), 'no close clip').toBe(false)
    expect(w.errors).toEqual([])
  })

  test('Back while a file is opening, under reduced motion: an instant swap', async ({ browser }, info) => {
    const ctx = await browser.newContext({ ...info.project.use, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await scrollScreens(page, 1)
    await installStillWatch(page, 'stop:X-001')
    await openFile(page, title('X-001'))
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/, { timeout: 3000 })
    expect(await stillAfterBack(page), 'Esc to the stop on screen, ms').toBeLessThanOrEqual(120)
    expect(w.errors).toEqual([])
    await ctx.close()
  })

  test('the profile: the door, the interior, a pick, then back to the cover', async ({ page }) => {
    test.setTimeout(180_000)
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await enterThroughDoor(page)
    const sheet = page.locator('.ph-sp[data-area]')
    await expect(page.getByRole('button', { name: /Evidence/ })).toBeVisible()
    // a pick: Detection (the first visit's tour is still playing: a pick takes over from it)
    const first = await sheet.getAttribute('data-area')
    await areas(page).getByRole('button', { name: /Detection/ }).click()
    await expect(areas(page).getByRole('button', { name: /Detection/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 45_000 })
    await expect(sheet).toHaveAttribute('data-area', 'detect')
    expect(first).not.toBe('detect')
    // its result stands, and links to its file
    await expect(sheet).toHaveAttribute('data-result', '1', { timeout: 45_000 })
    await expect(page.getByRole('button', { name: /^Open X-002/ }).first()).toBeVisible()
    // out: the cover again, no interior left behind
    await back(page)
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Open the profile/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.ph-space')).toBeHidden()
    expect(w.errors).toEqual([])
    expect(await w.violations()).toEqual([])
  })

  test('a cold link to a file: no entry page, the file opens, back goes to the reel @short', async ({ page }) => {
    const w = await watch(page)
    await page.goto(`/projects/${slug('X-001')}`)
    await expect(page.getByRole('dialog', { name: /Entry/ })).toHaveCount(0)
    await fileOpen(page, slug('X-001'), title('X-001'))
    await back(page)
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Open the profile/ })).toBeVisible({ timeout: 30_000 })
    expect(w.errors).toEqual([])
  })

  test('a cold link to /projects/profile: the cover, then the door and the interior; Esc leaves', async ({ page }) => {
    test.setTimeout(120_000)
    const w = await watch(page)
    await page.goto('/projects/profile')
    await expect(page.getByRole('dialog', { name: /Entry/ })).toHaveCount(0)
    await expect(page.locator('.ph-sp[data-area]')).toBeVisible({ timeout: 60_000 })
    await expect(page).toHaveURL(/\/projects\/profile$/)
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Open the profile/ })).toBeVisible({ timeout: 30_000 })
    expect(w.errors).toEqual([])
  })

  test('reduced motion: stills and crossfades only, nothing plays, files and the interior still open @short', async ({ browser }, info) => {
    test.setTimeout(120_000)
    // (a context of its own: the project's phone settings with the reduce preference)
    const ctx = await browser.newContext({ ...info.project.use, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const w = await watch(page)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    const playing = () => page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended).length)
    await scrollScreens(page, 1)
    await openFile(page, title('X-001'))
    await fileOpen(page, slug('X-001'), title('X-001'))
    expect(await playing()).toBe(0)
    await back(page)
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
    await page.evaluate(() => scrollTo(0, 0))
    await enterThroughDoor(page)
    expect(await playing()).toBe(0)
    await expect(page.locator('.ph-sp[data-area]')).toHaveAttribute('data-result', '1', { timeout: 20_000 })   // no tour to wait for: the area stands at its result
    expect(w.errors).toEqual([])
    await ctx.close()
  })

  test('play refused (a browser that will not autoplay): the stills carry the whole visit @short', async ({ page }) => {
    test.setTimeout(120_000)
    const w = await watch(page)
    await refusePlay(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await scrollScreens(page, 1)
    await openFile(page, title('X-001'))
    await fileOpen(page, slug('X-001'), title('X-001'))
    await back(page)
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 })
    await page.evaluate(() => scrollTo(0, 0))
    await enterThroughDoor(page)
    await areas(page).getByRole('button', { name: /Cloud IAM/ }).click()
    await expect(areas(page).getByRole('button', { name: /Cloud IAM/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
    expect(await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended).length)).toBe(0)
    await back(page)
    await expect(page.getByRole('button', { name: /Open the profile/ })).toBeVisible({ timeout: 30_000 })
    expect(w.errors.filter((e) => !/NotAllowedError|play\(\) refused/.test(e))).toEqual([])
  })

  test('landscape: a notice asks to turn the phone upright, and the page is where it was when it is', async ({ page }) => {
    const w = await watch(page)
    await returning(page)
    await page.goto('/')
    await coverReady(page)
    await scrollScreens(page, 1)
    const y = await screens(page)
    await page.setViewportSize({ width: 844, height: 390 })
    const notice = page.getByRole('status').filter({ hasText: 'Turn your phone upright' })
    await expect(notice).toBeVisible({ timeout: 10_000 })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(notice).toBeHidden({ timeout: 10_000 })
    await settled(page)
    expect(Math.abs((await screens(page)) - y)).toBeLessThan(0.02)
    expect(w.errors).toEqual([])
  })
})
