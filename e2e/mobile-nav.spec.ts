import { expect, test } from '@playwright/test'

test('opens and closes the mobile drawer after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  const menuButton = page.locator('button[aria-controls="mobile-drawer"]')
  await menuButton.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')

  await page.getByRole('link', { name: '#projects' }).last().click()

  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
})
