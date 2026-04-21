import { expect, test } from '@playwright/test'

test('submits the contact form successfully', async ({ page }) => {
  await page.route('**/api/contact', async (route) => {
    await route.fulfill({
      json: {
        status: 'success',
        message: "Message sent. I'll get back to you.",
      },
    })
  })

  await page.goto('/#contact')

  await page.getByLabel('Name').fill('Yaoting Wang')
  await page.getByLabel('Email').fill('felixwang1222@gmail.com')
  await page.getByLabel('Message').fill('Hello there, I would like to discuss a security role.')
  await page.getByRole('button', { name: /send message/i }).click()

  await expect(page.getByText(/message sent/i)).toBeVisible()
})

test('shows the fallback error when the API fails', async ({ page }) => {
  await page.route('**/api/contact', async (route) => {
    await route.fulfill({
      status: 500,
      json: {
        status: 'error',
        message: 'Failed to send. Try emailing directly at felixwang1222@gmail.com.',
      },
    })
  })

  await page.goto('/#contact')

  await page.getByLabel('Name').fill('Yaoting Wang')
  await page.getByLabel('Email').fill('felixwang1222@gmail.com')
  await page.getByLabel('Message').fill('Hello there, I would like to discuss a security role.')
  await page.getByRole('button', { name: /send message/i }).click()

  await expect(page.getByText(/Try emailing directly/i)).toBeVisible()
})
