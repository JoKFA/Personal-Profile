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
  await page.getByRole('button', { name: /Skip|Continue/ }).click({ timeout: 15_000 })
  // (a first visit may already be opening the subject file by itself; that is handled below)
  await page.waitForFunction(() => ['archive', 'opening', 'file'].includes((window as unknown as Win).__cf?.getSnapshot().mode), null, { timeout: 30_000 })
  // the HUD and the scene appear together once the first frame is on screen
  await page.waitForSelector('.cf-scene.on', { timeout: 30_000 }).catch(() => { /* no WebGL: the index page */ })
  // the entrance: the camera whips in and the file panel follows once it has settled
  await page.waitForFunction(() => !document.querySelector('.cf--arriving'), null, { timeout: 15_000 })
  // a first visit opens the subject file by itself once the entrance settles: close it
  const opened = await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode !== 'archive', null, { timeout: 2500 }).then(() => true, () => false)
  if (opened) {
    await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().mode === 'file', null, { timeout: 20_000 })
    await closeFile(page)
  }
  await page.waitForTimeout(800)
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

test('full flow: read access, open, close, shred, deny, SENTINEL', async ({ page }) => {
  const errors = watchErrors(page)
  await page.route('**/api/redteam', (r) => r.fulfill({ json: { status: 'ok', reply: 'Nothing in that gets you closer to the key.', captured: false, attemptsUsed: 1, attemptsRemaining: 14, windowResetAt: 0, globalRemaining: 99 } }))
  await enter(page)
  expect(await noOverflow(page)).toBe(true)

  // read access is issued once the entrance settles: every record decrypts
  await page.waitForFunction(() => (window as unknown as Win).__cf.getSnapshot().readable > 30, null, { timeout: 5000 })

  // open a case file: dialog, integrity, the real title after decryption
  await openDrive(page, 'X-002')
  await expect(page.locator('.file-meta h1')).toHaveText('SecureInsight · EDR + AI', { timeout: 5000 })
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
  // arrows skip empty slots; select an empty cell well beyond X-001's drawer run directly (as a click would)
  await page.evaluate(() => { const a = (window as unknown as Win).__cf, c = a.getSnapshot().sel; a.select({ lane: c.lane, row: c.row + 12 }) }); await page.waitForTimeout(700)
  await page.keyboard.press('Enter')
  await expect(page.locator('.panel-status')).toContainText('Access denied')
  expect(await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().risk)).toBeGreaterThan(before)

  // SENTINEL-1 talks to /api/redteam
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
  for (const id of ['YW-000', 'X-001', 'X-004', 'X-007', 'SR-02', 'X-003', 'X-006', 'X-005', 'SR-01', 'X-008', 'X-009', 'SR-04', 'ED-01', 'ED-02', 'ED-03', 'V-FILE']) {
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
      const sel = ['.hud-lock', '.hud-top', '.panel', '.hud-sel', '.hud-foot', '.hud-hint', '.kind-key']
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
  // the subject file's work space (docs/subject-space-spec.md): the tour running, and a finished result at rest
  await openDrive(page, 'YW-000')
  await page.waitForTimeout(2500)
  const film = await measure()
  await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.select(2))
  await page.waitForFunction(() => !(window as unknown as SpaceWin).__space.clock.state.travel, null, { timeout: 15_000 })
  await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.step(3))
  await page.waitForTimeout(1200)
  const rest = await measure()
  info.annotations.push({ type: 'fps', description: JSON.stringify({ idle, nav, film, rest }) })
  for (const m of [idle, nav, film, rest]) { expect(m.avg).toBeGreaterThanOrEqual(58); expect(m.p95).toBeLessThanOrEqual(18) }
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

test('entry: your facts land in an attack profile, which is sealed and falls into the archive', async ({ page }, info) => {
  const errors = watchErrors(page)
  const phone = info.project.name.startsWith('phone')
  await page.goto('/?intro')
  // the hook: the first fact is said large and lands in the card within about two seconds
  await expect(page.locator('.gz-s').first()).toBeVisible({ timeout: 5000 })
  const size = await page.locator('.gz-s').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(phone ? 24 : 30)
  await expect(page.locator('.gz-f .v').first()).toBeVisible({ timeout: 2500 })
  // the turn: an attack profile, with what an attacker would do written under three fields
  await expect(page.locator('.gz-card.attack .gz-h')).toContainText('ATTACK PROFILE', { timeout: 4000 })
  const aims = await page.locator('.gz-aim').allTextContents()
  expect(aims.filter((t) => t.trim().length > 8).length).toBe(3)
  await expect.poll(() => page.locator('.gz-aim').last().evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.95)
  for (const el of await page.locator('.gz-aim').all()) {
    expect(await el.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), await el.textContent() ?? '').toBe(true)
  }
  await page.screenshot({ path: `.codex-runtime/design/entrance/art-directed/${info.project.name}-attack.png` })
  // the defender: sealed, nothing left the browser; the card stays inside the screen
  await expect(page.locator('.gz-card.sealed .gz-h')).toContainText('PROFILE SEALED', { timeout: 4000 })
  await expect(page.locator('.gz-foot')).toContainText('Nothing sent.')
  const card = await page.locator('.gz-card').boundingBox(), vw = page.viewportSize()!
  expect(card && card.x >= 0 && card.x + card.width <= vw.width && card.y + card.height <= vw.height).toBe(true)
  const skip = await page.locator('.gz-skip').boundingBox()
  if (phone) expect(card && skip && card.y + card.height < skip.y).toBe(true)
  for (const el of await page.locator('.gz-f .v, .gz-aim, .gz-h span').all()) {
    const fits = await el.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)
    expect(fits, await el.textContent() ?? '').toBe(true)
  }
  await page.waitForTimeout(300)
  await page.screenshot({ path: `.codex-runtime/design/entrance/art-directed/${info.project.name}-sealed.png` })
  // then into the archive: the wave settles and the subject file opens by itself
  await page.waitForFunction(() => (window as unknown as Win).__cf?.getSnapshot().mode === 'file', null, { timeout: 30_000 })
  expect(await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().entry?.id)).toBe('YW-000')
  await expect(page.locator('.gate')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('entry: skipping during a value flight leaves no moving text or gate behind', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/?intro')
  await page.locator('.gz-flight').first().waitFor({ state: 'attached', timeout: 5000 })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => (window as unknown as Win).__cf?.getSnapshot().mode === 'file', null, { timeout: 30_000 })
  await expect(page.locator('.gz-flight, .gate')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as Win).__cf.getSnapshot().entry?.id)).toBe('YW-000')
  expect(errors).toEqual([])
})

test('entrance: a returning visitor follows a populated wave to the selected file', async ({ page }, info) => {
  const errors = watchErrors(page)
  await page.addInitScript(() => { localStorage.setItem('yw.entry', '1'); localStorage.setItem('yw.hint', '1') })
  await page.goto('/')
  await page.locator('.cf-scene.on').waitFor({ state: 'visible', timeout: 30_000 })
  type EntryWin = Window & { __cf: { entranceAge(): number; stage: { N: number }; getSnapshot(): { mode: string; entry: { id: string } | null } } }
  for (const age of [0.7, 1.8, 3.5]) {
    await page.waitForFunction((a) => (window as unknown as EntryWin).__cf.entranceAge() >= a, age, { timeout: 15_000, polling: 'raf' })
    expect(await page.evaluate(() => (window as unknown as EntryWin).__cf.stage.N)).toBeGreaterThan(100)
    await page.screenshot({ path: `.codex-runtime/design/entrance/art-directed/${info.project.name}-wave-${age}.png` })
  }
  await page.waitForFunction(() => !document.querySelector('.cf--arriving'), null, { timeout: 15_000 })
  await expect(page.locator('.panel-title')).toContainText('Yaoting Wang')
  expect(await page.evaluate(() => (window as unknown as EntryWin).__cf.getSnapshot().mode)).toBe('archive')
  await expect(page.locator('.gate')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('contact is one click away', async ({ page }) => {
  const errors = watchErrors(page)
  await enter(page)
  await page.getByRole('button', { name: 'Contact' }).click()
  const links = page.locator('nav[aria-label="Contact"] a')
  await expect(links).toHaveCount(3)
  expect(await links.first().getAttribute('href')).toMatch(/^mailto:/)
  expect(errors).toEqual([])
})

// the subject file is the way into the work space (docs/subject-space-spec.md); the kind legend is spec §25
type FilmWin = Window & { __cf: { getSnapshot(): { mode: string; kindFocus: string | null } } }
type SpaceWin = Window & { __space: { clock: { state: { area: number; travel: unknown; tour: boolean; playing: boolean; reason: string; retained: boolean[]; order: number[]; p: number }; select(i: number): void; step(i: number): void }; space: { debug(): { visibleAreas: number[] } } } }
test('subject file: the drive opens into six areas, each alone in its space, and their evidence stays', async ({ page }, info) => {
  test.setTimeout(180_000)
  const errors = watchErrors(page)
  const phone = info.project.name.startsWith('phone')
  await enter(page)
  // (the entry may have opened the file already: this visit is made a first one again)
  await page.evaluate(() => sessionStorage.removeItem('yw.space'))
  await openDrive(page, 'YW-000')
  await page.waitForFunction(() => !!(window as unknown as SpaceWin).__space, null, { timeout: 10_000 })
  await expect(page.locator('.space-title')).toBeVisible()
  // the first area plays by itself: the tour is on and the right side is the whole profile
  expect(await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state.tour)).toBe(true)
  await expect(page.locator('.file-meta h1')).toContainText('Yaoting Wang')
  await expect(page.locator('.file-creds')).toContainText('CCNA')
  await expect(page.locator('.file-creds')).toContainText('Security+')
  // the first area's fields are on screen while it plays (they hang from the scene's anchors every frame)
  await expect.poll(() => page.locator('.space-chip').evaluateAll((els) => els.filter((e) => getComputedStyle(e).visibility === 'visible' && +getComputedStyle(e).opacity > 0.5).length), { timeout: 20_000 }).toBeGreaterThan(0)
  const rightSide = () => page.evaluate(() => ({ tab: [...document.querySelectorAll('.file-tabs [role="tab"]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'), top: document.querySelector('.file-meta')?.scrollTop ?? 0 }))
  const right0 = await rightSide()
  const titles: string[] = []
  for (let i = 0; i < 6; i++) {
    await page.locator('.space-area').nth(i).click()
    await page.waitForFunction((n) => { const s = (window as unknown as SpaceWin).__space.clock.state; return s.area === n && !s.travel }, i, { timeout: 15_000 })
    // choosing an area ends the tour; the right side does not move
    expect(await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state.tour)).toBe(false)
    await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.step(3))
    await expect(page.locator('.space-result')).toBeVisible()
    await expect(page.locator('.space-kept')).toBeVisible()
    titles.push((await page.locator('.space-title').textContent()) ?? '')
    // one area at a time: nothing of any other area is in the scene
    expect(await page.evaluate(() => (window as unknown as SpaceWin).__space.space.debug().visibleAreas)).toEqual([i])
  }
  // nothing on the left changed the right: the same tab; and, off a phone (where the page is the scroller), the same scroll
  const right1 = await rightSide()
  expect(right1.tab).toBe(right0.tab)
  if (!phone) expect(right1.top).toBe(right0.top)
  expect(new Set(titles).size).toBe(6)
  // all six results are kept, in the order they were produced
  const kept = await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state)
  expect(kept.retained.filter(Boolean)).toHaveLength(6)
  expect(kept.order).toEqual([0, 1, 2, 3, 4, 5])
  await expect(page.locator('.space-ev b')).toHaveText('6')
  // reading the profile pauses the show, and nothing on the left changes the right
  await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.select(0))
  await page.waitForFunction(() => !(window as unknown as SpaceWin).__space.clock.state.travel, null, { timeout: 15_000 })
  await expect.poll(() => page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state.playing)).toBe(true)
  await page.locator('.file-tabs [role="tab"]').nth(1).click()
  expect(await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state.playing)).toBe(false)
  expect(await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state.reason)).toBe('reading')
  // the index: six cells, and each result links to the file of the work behind it
  await page.locator('.space-ev').click()
  const cells = phone ? page.locator('.space-list .space-cell') : page.locator('.space-index .space-cell')
  await expect(cells).toHaveCount(6)
  await cells.nth(4).locator('.space-go').click()   // awareness: the BCIT file
  await page.waitForURL(/\/projects\/bcit-cyber-security-office/, { timeout: 15_000 })
  await page.waitForFunction(() => (window as unknown as FilmWin).__cf.getSnapshot().mode === 'file', null, { timeout: 20_000 })
  await closeFile(page)
  // coming back in the same session opens on the work space again with the tour off, and the six results still pictured
  await openDrive(page, 'YW-000')
  await expect(page.locator('.space-title')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as SpaceWin).__space.clock.state.tour)).toBe(false)
  await page.locator('.space-ev').click()
  await expect.poll(() => page.locator(phone ? '.space-list .space-thumb img' : '.space-index .space-thumb img').count(), { timeout: 5000 }).toBe(6)
  // Esc closes the open index first, and only the next one leaves the file
  await page.keyboard.press('Escape')
  await expect(page.locator(phone ? '.space-list .space-index-grid' : '.space-index')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as FilmWin).__cf.getSnapshot().mode)).toBe('file')
  await closeFile(page)
  expect(await noOverflow(page)).toBe(true)
  expect(errors).toEqual([])
})

test('subject file: reading the profile pauses the show; hovering does not; a hidden tab freezes it and nothing is caught up', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('phone'), 'a phone reads by scrolling the page: covered by the flow test')
  test.setTimeout(120_000)
  const errors = watchErrors(page)
  await enter(page)
  await page.evaluate(() => sessionStorage.removeItem('yw.space'))
  await openDrive(page, 'YW-000')
  const st = () => page.evaluate(() => { const s = (window as unknown as SpaceWin).__space.clock.state; return { playing: s.playing, reason: s.reason, p: s.p, area: s.area } })
  const resume = async () => { await page.locator('.space-ctl button').first().click(); await expect.poll(async () => (await st()).playing).toBe(true) }
  await expect.poll(async () => (await st()).playing).toBe(true)
  const meta = (await page.locator('.file-meta').boundingBox())!
  // hovering the profile is not reading
  await page.mouse.move(meta.x + 120, meta.y + 260); await page.waitForTimeout(900)
  expect((await st()).playing).toBe(true)
  // the wheel is
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await st()).reason).toBe('reading')
  expect((await st()).playing).toBe(false)
  await resume()
  // a key inside the profile, focus, a text selection: each is
  await page.locator('.file-tabs [role="tab"]').nth(1).focus()
  await expect.poll(async () => (await st()).reason).toBe('reading')
  await resume()
  await page.evaluate(() => { const h = document.querySelector('.file-meta h1')!; getSelection()!.selectAllChildren(h) })
  await expect.poll(async () => (await st()).reason).toBe('reading')
  await page.evaluate(() => getSelection()!.removeAllRanges())
  await resume()
  // choosing an area on the left is a command, not reading, and ends the tour
  await page.locator('.space-area').nth(2).click()
  await page.waitForFunction(() => { const s = (window as unknown as SpaceWin).__space.clock.state; return s.area === 2 && !s.travel }, null, { timeout: 15_000 })
  expect((await st()).playing).toBe(true)
  // a hidden tab: frozen, and coming back does not play on or catch up until the visitor resumes
  const away = async (hidden: boolean) => page.evaluate((h) => { Object.defineProperty(document, 'hidden', { value: h, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }, hidden)
  await away(true)
  const frozen = await st()
  expect(frozen.reason).toBe('away'); expect(frozen.playing).toBe(false)
  await page.waitForTimeout(800); await away(false); await page.waitForTimeout(900)
  const back = await st()
  expect(back.reason).toBe('away'); expect(back.playing).toBe(false)
  expect(back.p).toBeCloseTo(frozen.p, 3)
  await resume()
  await expect.poll(async () => (await st()).p).toBeGreaterThan(back.p)
  expect(errors).toEqual([])
})

test('the legend lights one kind of record at a time', async ({ page }, info) => {
  await enter(page)
  const key = page.locator('.kind-key')
  await expect(key).toContainText('Experience')
  await expect(key).toContainText('Projects')
  const exp = key.getByRole('button', { name: /Experience/ })
  if (info.project.name.startsWith('phone')) await exp.tap(); else await exp.hover()
  await page.waitForFunction(() => (window as unknown as FilmWin).__cf.getSnapshot().kindFocus === 'service', null, { timeout: 3000 })
  // the panel names kinds in plain words
  await expect(page.locator('.panel-eyebrow')).not.toContainText(/Case file|Service record/)
})
