import { expect, test } from '@playwright/test'

test('shows and starts the prompt-injection landing game', async ({ page }) => {
  await page.goto('/?force=1')

  await expect(page.getByRole('heading', { name: /break my guard/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /start challenge/i })).toBeVisible()

  await page.getByRole('button', { name: /start challenge/i }).click()

  await expect(page.getByText(/Access point online/i)).toBeVisible()
  await expect(page.getByLabel(/attack input/i)).toBeVisible()
})

test('can skip from landing game to portfolio', async ({ page }) => {
  await page.goto('/?force=1')

  await page.getByRole('button', { name: /skip to portfolio/i }).click()

  await expect(page).toHaveURL(/\/portfolio$/)
  await expect(page.getByRole('heading', { name: 'Yaoting Wang' })).toBeVisible()
})
