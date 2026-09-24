import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../components/ErrorBoundary'
import { recipeFor } from '../recipes'

describe('the "something went wrong" screen', () => {
  it('replaces a crashed page instead of leaving it blank', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken() {
      throw new Error('boom')
    }
    render(
      <ErrorBoundary resetKey="/">
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load the page again' })).toBeTruthy()
  })
})

describe('recipes', () => {
  it('match the farm’s produce names', () => {
    expect(recipeFor('Yukon Gold potatoes', 'en').name).toBe('Potatoes')
    expect(recipeFor('Sweet potatoes', 'en').name).toBe('Sweet potatoes')
    expect(recipeFor('Apples (Cortland seconds)', 'fr').name).toBe('Pommes')
    expect(recipeFor('Dragon fruit', 'en')).toBeNull()
  })
})
