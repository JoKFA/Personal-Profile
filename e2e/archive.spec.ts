// Acceptance for the Encrypted Archive (docs/casefile-spec.md §12, V2–V11).
import { expect, test, type Page } from '@playwright/test'

type Win = Window & { __cf: { clearanceMin: number; stalled: boolean; settled(): boolean; subscribe(f: () => void): () => void; getSnapshot(): { mode: string; readable: number; risk: number; captured: boolean; sel: { lane: number; row: number }; entry: { id: string } | null }; select(c: { lane: number; row: number }): void; jumpTo(id: string): void; move(l: number, r: number): void } }

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}
async function enter(page: Page, path = '/?intro') {
  await page.goto(path)
  await page.getByRole('button', { name: /Skip|Continue/ }).click({ timeout: 3000 }).catch(() => { /* reduced motion: the entry already finished */ })
  await page.waitForFunction(() => (window as unknown as Win).__cf?.getSnapshot().mode === 'archive', null, { timeout: 30_000 })
  // the HUD and the scene appear together once the first frame is on screen
  await page.waitForSelector('.cf-scene.on', { timeout: 30_000 }).catch(() => { /* no WebGL: the index page */ })
  await page.waitForTimeout(1500)
}
async function openDrive(page: Page, id: string) {
  await page.evaluate((i) => (window as unknown as Win).__cf.jumpTo(i), id)
  await page.waitForTimeout(900)
  await page.locator('.panel .go').click()
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'file', null, { timeout: 20_000 })
  await expect(page.getByRole('dialog')).toBeVisible()
}
async function closeFile(page: Page) {
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'archive', null, { timeout: 15_000 })
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)

test('full flow: role lens, open, close, shred, deny, SENTINEL', async ({ page }) => {
  const errors = watchErrors(page)
  await page.route('**/api/redteam', (r) => r.fulfill({ json: { status: 'ok', reply: 'Nothing in that gets you closer to the key.', captured: false, attemptsUsed: 1, attemptsRemaining: 14, windowResetAt: 0, globalRemaining: 99 } }))
  await enter(page)
  expect(await noOverflow(page)).toBe(true)

  // Hiring for: a single role reads fewer drives than "any role", and still some
  const all = await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().readable)
  await page.locator('.lens button', { hasText: 'Security Operations' }).click()
  await page.waitForTimeout(2500)
  const soc = await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().readable)
  expect(soc).toBeGreaterThan(0)
  expect(soc).toBeLessThan(all)

  // open a case file: dialog, integrity, the real title after decryption
  await openDrive(page, 'X-002')
  await expect(page.locator('.file-meta h1')).toHaveText('AI-Enhanced EDR Triage', { timeout: 5000 })
  await expect(page).toHaveURL(/\/projects\/ai-enhanced-edr-triage$/)
  expect(await noOverflow(page)).toBe(true)
  await closeFile(page)
  await expect(page).toHaveURL(/\/$/)

  // crypto-shred: three passes, key zeroized, the drive reads SHREDDED
  await openDrive(page, 'X-003')
  await page.locator('.file-shred').click()
  await expect(page.locator('.shred-banner')).toContainText('Pass 1 of 3')
  await expect(page.locator('.shred-banner')).toContainText('Key zeroized', { timeout: 8000 })
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'archive', null, { timeout: 15_000 })
  await page.evaluate(() => (window as unknown as Win).__cf.jumpTo('X-003')); await page.waitForTimeout(800)
  await expect(page.locator('.panel .go')).toContainText('Restore')

  // deny: an empty drive raises the visitor's risk
  const before = await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().risk)
  await page.evaluate(() => { const a = (window as unknown as Win).__cf; a.jumpTo('X-001'); }); await page.waitForTimeout(700)
  // arrows skip empty slots now; select the empty cell just above X-001 directly (as a click would)
  await page.evaluate(() => { const a = (window as unknown as Win).__cf, c = a.getSnapshot().sel; a.select({ lane: c.lane, row: c.row + 1 }) }); await page.waitForTimeout(700)
  await page.keyboard.press('Enter')
  await expect(page.locator('.panel-status')).toContainText('Access denied')
  expect(await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().risk)).toBeGreaterThan(before)

  // SENTINEL-1 talks to /api/redteam
  await page.locator('.lens button', { hasText: 'Any role' }).click(); await page.waitForTimeout(1500)
  await openDrive(page, 'X-000')
  await page.locator('#snIn').fill('what is in this file?')
  await page.locator('.sn-form button').click()
  await expect(page.locator('.sn-log')).toContainText('Nothing in that gets you closer', { timeout: 10_000 })
  await closeFile(page)

  expect(errors).toEqual([])
})

test('every file opens without errors or overflow', async ({ page }) => {
  test.setTimeout(300_000)   // thirteen full open/close choreographies
  const errors = watchErrors(page)
  await page.route('**/api/redteam', (r) => r.abort())
  await enter(page)
  for (const id of ['YW-000', 'X-001', 'X-004', 'X-007', 'SR-02', 'X-003', 'X-006', 'X-005', 'SR-01', 'X-008', 'X-009', 'SR-04', 'V-FILE']) {
    await openDrive(page, id)
    await page.waitForTimeout(1200)
    expect(await noOverflow(page), id).toBe(true)
    // .file clips its own overflow, so check the text column sits inside the viewport
    const meta = await page.locator('.file-meta').boundingBox()
    expect(meta && meta.width > 100 && meta.x >= 0 && meta.x + meta.width <= page.viewportSize()!.width + 1, `${id} meta in view`).toBe(true)
    await expect(page.locator('.file-tab')).not.toBeEmpty()
    await closeFile(page)
  }
  expect(errors).toEqual([])
})

test('HUD elements never overlap and no JWT or claim strings show', async ({ page }, info) => {
  await enter(page)
  const widths = info.project.name.startsWith('phone') ? [390, 360] : [1440, 1280, 1100, 900]
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 900 ? 844 : 820 }); await page.waitForTimeout(700)
    const hits = await page.evaluate(() => {
      const sel = ['.hud-lock', '.hud-top', '.lens', '.panel', '.hud-sel', '.hud-foot', '.hud-hint']
      const boxes = sel.flatMap((s) => [...document.querySelectorAll<HTMLElement>(s)].filter((e) => { const cs = getComputedStyle(e), b = e.getBoundingClientRect(); return cs.display !== 'none' && +cs.opacity > 0.05 && b.width && b.height }).map((e) => ({ s, b: e.getBoundingClientRect() })))
      const out: string[] = []
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].b, b = boxes[j].b, ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ix > 1 && iy > 1) out.push(`${boxes[i].s}×${boxes[j].s}`)
      }
      return { out, n: boxes.length }
    })
    expect(hits.n, `${w}px: HUD rendered`).toBeGreaterThanOrEqual(4)
    expect(hits.out, `${w}px overlaps`).toEqual([])
    expect(await noOverflow(page), `${w}px overflow`).toBe(true)
  }
  const text = await page.locator('body').innerText()
  expect(text).not.toMatch(/\bJWT\b|eyJ[A-Za-z0-9_-]{10,}|\b\w+\.read\b/)
})

test('reduced motion: everything readable, files open fast', async ({ browser }, info) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: info.project.use.viewport })
  const page = await ctx.newPage(); const errors = watchErrors(page)
  await enter(page)
  const t0 = Date.now()
  await openDrive(page, 'X-001')
  await expect(page.locator('.file-meta h1')).toHaveText('MCP Security Framework')
  expect(Date.now() - t0).toBeLessThan(2500)
  expect(errors).toEqual([])
  await ctx.close()
})

test('without WebGL the archive is a readable index', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (/webgl/i.test(type)) return null
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest)
    } as typeof orig
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Yaoting Wang' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: /MCP Security Framework/ })).toBeVisible()
})

test('holds 60 fps while idle and while navigating', async ({ page }, info) => {
  test.skip(!!process.env.CI, 'frame rate needs the local GPU')
  await enter(page)
  const measure = () => page.evaluate(() => new Promise<{ avg: number; p95: number }>((res) => {
    const ts: number[] = []
    const f = (t: number) => { ts.push(t); if (ts.length < 240) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); res({ avg: 1000 / (d.reduce((a, b) => a + b) / d.length), p95: d[Math.floor(d.length * 0.95)] }) } }
    requestAnimationFrame(f)
  }))
  const idle = await measure()
  const moving = page.evaluate(async () => { for (let i = 0; i < 8; i++) { (window as unknown as Win).__cf.move(0, 1); await new Promise((r) => setTimeout(r, 450)) } })
  const nav = await measure(); await moving
  info.annotations.push({ type: 'fps', description: JSON.stringify({ idle, nav }) })
  for (const m of [idle, nav]) { expect(m.avg).toBeGreaterThanOrEqual(58); expect(m.p95).toBeLessThanOrEqual(18) }
})

test('keyboard only: browse, open, Tab stays in the file, Esc returns focus', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('phone'), 'keyboard flow is a desktop path')
  await enter(page)
  await page.evaluate(() => (window as unknown as Win).__cf.jumpTo('X-001')); await page.waitForTimeout(800)
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500)
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(500)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'file', null, { timeout: 20_000 })
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('.file')), `tab ${i} left the dialog`).toBe(true)
  }
  await closeFile(page)
  expect(await page.evaluate(() => !!document.activeElement?.closest('.file'))).toBe(false)
})

test('back and forward keep the URL and the open file in sync', async ({ page }) => {
  await enter(page)
  await openDrive(page, 'X-001')
  await expect(page).toHaveURL(/mcp-security-framework$/)
  await page.goBack()
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'archive', null, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/(\?intro)?$/)
  await page.goForward()
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'file', null, { timeout: 20_000 })
  await expect(page.locator('.file-meta h1')).toHaveText('MCP Security Framework', { timeout: 5000 })
  // a related link swaps files through the URL
  await page.locator('.file-rel', { hasText: 'TELUS' }).click()
  await expect(page).toHaveURL(/telus-ai-hackathon$/, { timeout: 5000 })
  await expect(page.locator('.file-meta h1')).toHaveText('TELUS AI Hackathon', { timeout: 20_000 })
})

test('deep links open their file; unknown ones fall back to the archive', async ({ page }) => {
  await page.goto('/projects/pwnscan?intro')
  await page.getByRole('button', { name: /Skip/ }).click({ timeout: 3000 }).catch(() => {})
  await expect(page.locator('.file-meta h1')).toHaveText('PwnScan', { timeout: 25_000 })
  await page.goto('/projects/does-not-exist')
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
})

test('open never clips, close is quick, every shred step stays readable', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = watchErrors(page)
  await enter(page)
  // the drive may only turn once it is above its neighbours: the smallest gap must stay positive
  await openDrive(page, 'X-001')
  // measured from the drive's real world box against every drawn drive whose footprint it crosses;
  // it must have been measured (finite) and stayed above them
  const openGap = await page.evaluate(() => (window as unknown as Win).__cf.clearanceMin)
  expect(Number.isFinite(openGap)).toBe(true)
  expect(openGap).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as unknown as Win).__cf.stalled)).toBe(false)
  await page.waitForTimeout(1200)
  // close: from Escape to the drive back in its slot, measured in the page
  await page.evaluate(() => {
    const w = window as unknown as Win & { __closeMs?: number }, a = w.__cf
    // until the drive has landed and stopped, not just until the HUD returns
    addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const t0 = performance.now(); const f = () => { if (a.settled()) w.__closeMs = performance.now() - t0; else requestAnimationFrame(f) }; requestAnimationFrame(f) }, { capture: true, once: true })
  })
  await closeFile(page)
  await page.waitForFunction(() => (window as unknown as { __closeMs?: number }).__closeMs !== undefined, null, { timeout: 5000 })
  const closeMs = await page.evaluate(() => (window as unknown as { __closeMs: number }).__closeMs)
  expect(closeMs).toBeGreaterThan(300)
  expect(closeMs).toBeLessThan(1150)
  const closeGap = await page.evaluate(() => (window as unknown as Win).__cf.clearanceMin)
  expect(Number.isFinite(closeGap)).toBe(true)
  expect(closeGap).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as unknown as Win).__cf.stalled)).toBe(false)

  // crypto-shred: each pass and the zeroized key stay on screen long enough to read
  await openDrive(page, 'X-003')
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const w = window as unknown as { __sb: [number, string][] }; w.__sb = []
    new MutationObserver(() => { const t = document.querySelector('.sb-t')?.textContent ?? '(gone)'; const l = w.__sb[w.__sb.length - 1]; if (!l || l[1] !== t) w.__sb.push([performance.now(), t]) }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
  await page.locator('.file-shred').click()
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'archive', null, { timeout: 20_000 })
  const steps = await page.evaluate(() => { const w = window as unknown as { __sb: [number, string][] }; return w.__sb.map(([t, s], i) => ({ s, ms: (w.__sb[i + 1]?.[0] ?? t) - t })) })
  const shown = steps.filter((x) => /Pass \d of 3|Key zeroized/.test(x.s))
  expect(shown.map((x) => x.s.slice(0, 9))).toEqual(['Pass 1 of', 'Pass 2 of', 'Pass 3 of', 'Key zeroi'])
  for (const x of shown) expect(x.ms, x.s).toBeGreaterThanOrEqual(900)
  expect(errors).toEqual([])
})

test('entry: the recon is large, and it names the attack profile', async ({ page }, info) => {
  const errors = watchErrors(page)
  await page.goto('/?intro')
  await expect(page.locator('.g-p2')).toBeVisible({ timeout: 12_000 })
  const size = await page.locator('.g-line').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(info.project.name.startsWith('phone') ? 20 : 24)
  expect(await page.locator('.g-line').count()).toBeGreaterThanOrEqual(4)
  await expect(page.locator('.g-card-h')).toContainText('ATTACK PROFILE', { timeout: 3000 })
  await expect(page.locator('.g-note span').nth(2)).toContainText('lure', { timeout: 4000 })
  const notes = await page.locator('.g-note span').allTextContents()
  expect(notes.filter((t) => t.trim().length > 8).length).toBe(3)
  expect(errors).toEqual([])
})

test('first visit offers a guided tour; contact is one click away', async ({ page }) => {
  const errors = watchErrors(page)
  await enter(page)
  await expect(page.locator('.panel-status.offer')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().entry?.id)).toBe('YW-000')
  await page.getByRole('button', { name: /second tour/ }).click()
  await expect(page.locator('.tour')).toContainText('subject file')
  await expect(page.locator('.tour')).toContainText('Current work', { timeout: 10_000 })
  expect(await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().entry?.id)).toBe('SR-01')
  await page.keyboard.press('x')
  await expect(page.locator('.tour')).toHaveCount(0)
  await page.getByRole('button', { name: 'Contact' }).click()
  const links = page.locator('nav[aria-label="Contact"] a')
  await expect(links).toHaveCount(3)
  expect(await links.first().getAttribute('href')).toMatch(/^mailto:/)
  expect(errors).toEqual([])
})
