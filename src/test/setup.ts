import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  class MockIntersectionObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  })

  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
  })

  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: () => {},
  })

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
}
