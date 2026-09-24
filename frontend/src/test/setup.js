import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Each test starts with a clean page, no saved details and English.
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

// jsdom doesn't scroll.
window.scrollTo = () => {}
