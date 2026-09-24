import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { api } from '../api'
import ReservePage from '../pages/site/ReservePage'
import { OPTIONS, fakeApi, renderAt } from './helpers'

vi.mock('../api', () => ({ api: vi.fn() }))

function showReservePage() {
  return renderAt(<ReservePage />, {
    path: '/reserve',
    extraRoutes: <Route path="/reserve/manage/:token" element={<p>Reservation page</p>} />,
  })
}

describe('Reserve a Bundle', () => {
  it('reserves with the chosen price, gift and language, then opens the reservation', async () => {
    const user = userEvent.setup()
    let sent
    fakeApi(api, {
      '/reserve/options/': OPTIONS,
      'POST /reserve/': (body) => {
        sent = body
        return { token: 'new-token' }
      },
    })
    showReservePage()

    await user.selectOptions(await screen.findByLabelText('Location'), 'Dartmouth')
    expect(screen.getByText('7 bundles left')).toBeTruthy()
    await user.click(screen.getByLabelText('More bundles'))
    await user.click(screen.getByLabelText(/\+\$5/))
    await user.type(screen.getByLabelText('Your name'), 'Alex')
    await user.type(screen.getByLabelText(/Email/), 'alex@example.com')
    expect(screen.getByText('$25.00')).toBeTruthy() // 2 × $10 + $5 gift
    await user.click(screen.getByRole('button', { name: 'Reserve 2 bundles' }))

    expect(await screen.findByText('Reservation page')).toBeTruthy()
    expect(sent).toMatchObject({ site_drop: 10, bundles: 2, price_tier: 'standard', pay_it_forward: 5, language: 'en' })
  })

  it('says what is missing before sending anything', async () => {
    const user = userEvent.setup()
    fakeApi(api, { '/reserve/options/': OPTIONS })
    showReservePage()
    await user.selectOptions(await screen.findByLabelText('Location'), 'Dartmouth')
    await user.click(screen.getByRole('button', { name: 'Reserve 1 bundle' }))
    expect(screen.getByText('Please add your name.')).toBeTruthy()
    expect(screen.getByText(/Add an email or a phone number/)).toBeTruthy()
    expect(api).not.toHaveBeenCalledWith('/reserve/', expect.anything())
  })

  it('explains when a location does not take online reservations', async () => {
    const user = userEvent.setup()
    fakeApi(api, { '/reserve/options/': OPTIONS })
    showReservePage()
    await user.selectOptions(await screen.findByLabelText('Location'), 'Middle Musquodoboit')
    expect(screen.getByText(/doesn’t take online reservations yet/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reserve/ })).toBeNull()
  })

  it('switches to French', async () => {
    const user = userEvent.setup()
    fakeApi(api, { '/reserve/options/': OPTIONS })
    showReservePage()
    await user.click(screen.getByRole('button', { name: 'Français' }))
    expect(screen.getByRole('heading', { name: 'Réserver un panier' })).toBeTruthy()
    await user.selectOptions(await screen.findByLabelText('Lieu'), 'Dartmouth')
    expect(screen.getByText('Donner au suivant')).toBeTruthy()
  })

  it('offers the waitlist when there are not enough bundles', async () => {
    const user = userEvent.setup()
    const full = structuredClone(OPTIONS)
    full.sites[0].drops[0].bundles_left = 0
    fakeApi(api, { '/reserve/options/': full })
    showReservePage()
    await user.selectOptions(await screen.findByLabelText('Location'), 'Dartmouth')
    expect(screen.getByRole('button', { name: 'Join the waitlist' })).toBeTruthy()
  })
})
