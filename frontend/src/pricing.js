// Bundle prices, set by the Square Roots team on the admin Settings screen.
// Fetched once and shared, since many screens show them.

import { useEffect, useState } from 'react'
import { api } from './api'

let cached = null

export function usePricing() {
  const [pricing, setPricing] = useState(cached)
  useEffect(() => {
    if (cached) return
    api('/pricing/').then((result) => {
      cached = result
      setPricing(result)
    })
  }, [])
  return pricing
}

// Call after the admin changes prices, so screens pick up the new ones.
export function forgetPricing() {
  cached = null
}
