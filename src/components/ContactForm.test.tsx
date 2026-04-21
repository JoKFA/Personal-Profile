import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactForm } from './ContactForm'
import { renderWithProviders } from '../test/render'

describe('ContactForm', () => {
  it('shows required validation on empty submit', async () => {
    renderWithProviders(<ContactForm />)

    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    const errors = await screen.findAllByText('required')
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })

  it('submits successfully and shows the success state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success', message: 'ok' }),
      }),
    )

    renderWithProviders(<ContactForm />)

    await userEvent.type(screen.getByLabelText('// name'), 'Yaoting Wang')
    await userEvent.type(screen.getByLabelText('// email'), 'felixwang1222@gmail.com')
    await userEvent.type(screen.getByLabelText('// message'), 'Hello there, this is a valid introduction message.')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/message received/i)).toBeInTheDocument()
    })
  })

  it('shows inline error on server 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ status: 'error', message: '// submission failed — try felixwang1222@gmail.com' }),
      }),
    )

    renderWithProviders(<ContactForm />)

    await userEvent.type(screen.getByLabelText('// name'), 'Yaoting Wang')
    await userEvent.type(screen.getByLabelText('// email'), 'felixwang1222@gmail.com')
    await userEvent.type(screen.getByLabelText('// message'), 'Hello there, this is a valid introduction message.')
    await userEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/submission failed/i)).toBeInTheDocument()
    })
  })
})
