// @vitest-environment node

import { submitContactForm } from '../src/server/contact'

describe('submitContactForm', () => {
  it('silently ignores honeypot submissions', async () => {
    const result = await submitContactForm({
      name: 'Bot',
      email: 'bot@example.com',
      message: 'This looks valid enough to pass basic checks.',
      honeypot: 'filled',
    })

    expect(result.httpStatus).toBe(200)
    expect(result.body.status).toBe('success')
  })

  it('returns validation errors for invalid payloads', async () => {
    const result = await submitContactForm({
      name: '',
      email: 'invalid',
      message: 'short',
    })

    expect(result.httpStatus).toBe(400)
    expect(result.body.fieldErrors?.name).toBeTruthy()
    expect(result.body.fieldErrors?.email).toBeTruthy()
    expect(result.body.fieldErrors?.message).toBeTruthy()
  })

  it('sends mail when dependencies are provided', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'email_123' })
    const result = await submitContactForm(
      {
        name: 'Yaoting Wang',
        email: 'felixwang1222@gmail.com',
        message: 'Hello there, I would like to discuss a security role.',
      },
      {
        apiKey: 're_test',
        createClient: () => ({
          emails: {
            send,
          },
        }),
      },
    )

    expect(result.httpStatus).toBe(200)
    expect(result.body.status).toBe('success')
    expect(send).toHaveBeenCalledTimes(1)
  })
})
