import { expect, test } from '@playwright/test'

test('loads deep-linked case study routes', async ({ page }) => {
  await page.goto('/projects/mcp-security-framework')

  await expect(page.getByRole('heading', { name: 'MCP Security Framework' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Problem' })).toBeVisible()
})

test('renders the portfolio page and PDF link', async ({ page }) => {
  await page.goto('/portfolio')

  await expect(page.getByRole('heading', { name: 'Yaoting Wang' })).toBeVisible()
  await expect(page.getByRole('link', { name: /resume\.pdf/i }).first()).toHaveAttribute('href', '/resume.pdf')
})
