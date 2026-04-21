import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(<MemoryRouter>{ui}</MemoryRouter>, options)
}
