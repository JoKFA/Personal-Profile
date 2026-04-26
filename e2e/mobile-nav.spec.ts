import { expect, test } from '@playwright/test'

test('opens and closes the mobile drawer after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/portfolio')

  const menuButton = page.locator('button[aria-controls="mobile-drawer"]')
  await menuButton.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')

  await page.getByRole('link', { name: 'work' }).last().click()

  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
})
