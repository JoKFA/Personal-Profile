import { HeroConsole } from './HeroConsole'
import { renderWithProviders } from '../test/render'

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

describe('HeroConsole boot sequence', () => {
  afterEach(() => mockReducedMotion(false))

  it('shows every block on the first render when the user prefers reduced motion', () => {
    mockReducedMotion(true)
    const { container } = renderWithProviders(<HeroConsole />)
    const reducedLines = container.querySelectorAll('.hc-cmd').length

    mockReducedMotion(false)
    const animated = renderWithProviders(<HeroConsole />)
    const animatedLines = animated.container.querySelectorAll('.hc-cmd').length

    // blocks 2-4 are mounted up front only in reduced mode
    expect(reducedLines).toBeGreaterThan(animatedLines)
    expect(container.querySelector('.hc-cursor')).toBeNull()
  })
})
