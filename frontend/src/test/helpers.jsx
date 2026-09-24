import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../i18n'

// Shows `element` at `path` inside the app's providers, with a page to land on after navigating.
export function renderAt(element, { path = '/', route = path, extraRoutes = null } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LanguageProvider>
        <Routes>
          <Route path={path} element={element} />
          {extraRoutes}
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  )
}

// A pretend API: give it answers by path, and it records what was sent.
export function fakeApi(api, answers) {
  api.mockImplementation(async (path, options = {}) => {
    const answer = answers[`${options.method ?? 'GET'} ${path}`] ?? answers[path]
    if (answer === undefined) throw new Error(`No fake answer for ${options.method ?? 'GET'} ${path}`)
    return typeof answer === 'function' ? answer(options.body) : answer
  })
}

const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000)
const iso = (d) => d.toISOString().slice(0, 10)

export const OPTIONS = {
  prices: { standard: '10.00', at_cost: '7.50', delivery_fee: '1.99' },
  max_bundles: 4,
  money: {
    standard: '10.00', to_square_roots: '7.50', to_manager: '2.50', to_farms: '4.44',
    pay_it_forward_this_year: '1970.00', free_bundles_covered: 262,
  },
  sites: [
    {
      id: 1, name: 'Dartmouth', address: '105 Highfield Park Dr', delivery_partner: '', instagram_url: '', facebook_url: '',
      online_reservations: true,
      drops: [
        {
          id: 10, drop_date: iso(inTwoWeeks), starts_at: '11:00:00', ends_at: '13:00:00',
          order_cutoff: new Date(inTwoWeeks.getTime() - 4 * 86_400_000).toISOString(), bundles_left: 7, waitlist_count: 0,
        },
      ],
    },
    { id: 2, name: 'Middle Musquodoboit', address: '13867 Hwy 224', delivery_partner: '', instagram_url: '', facebook_url: '', online_reservations: false, drops: [] },
  ],
}

export const RESERVATION = {
  status: 'reserved', token: 'abc123', pickup_code: 'K7M4', waitlist_position: null,
  customer_name: 'Alex', email: 'alex@example.com', phone: '', bundles: 2, price_tier: 'standard',
  delivery: false, delivery_address: '', pay_it_forward: '5.00', every_drop: false, language: 'en',
  amount_due: '25.00', delivery_fee: '1.99', picked_up: false, can_change: true, most_bundles: 4,
  has_happened: false, feedback: '', impact: null, bundle: [],
  drop: { id: 10, drop_date: '2026-10-10', starts_at: '11:00:00', ends_at: '13:00:00', order_cutoff: '2026-10-06T20:00:00Z' },
  site: { id: 1, name: 'Dartmouth', address: '105 Highfield Park Dr', delivery_partner: '', instagram_url: '', facebook_url: '' },
}
