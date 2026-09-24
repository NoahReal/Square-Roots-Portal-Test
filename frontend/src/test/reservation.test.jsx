import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api'
import ManageReservationPage from '../pages/site/ManageReservationPage'
import { RESERVATION, fakeApi, renderAt } from './helpers'

vi.mock('../api', () => ({ api: vi.fn() }))

const showReservation = () => renderAt(<ManageReservationPage />, { path: '/reserve/manage/:token', route: '/reserve/manage/abc123' })

describe('Your reservation', () => {
  it('shows the pickup code, what to pay and the gift', async () => {
    fakeApi(api, { '/reserve/abc123/': RESERVATION })
    showReservation()
    expect(await screen.findByText('K7M4')).toBeTruthy()
    expect(screen.getByText('$25.00')).toBeTruthy()
    expect(screen.getByText('$5.00. Thank you!')).toBeTruthy()
  })

  it('asks "How was your bundle?" after the drop and saves one tap', async () => {
    const user = userEvent.setup()
    let sent
    fakeApi(api, {
      '/reserve/abc123/': { ...RESERVATION, has_happened: true, can_change: false },
      'POST /reserve/abc123/feedback/': (body) => {
        sent = body
        return { ...RESERVATION, has_happened: true, can_change: false, feedback: body.feedback }
      },
    })
    showReservation()
    await user.click(await screen.findByRole('button', { name: 'Great' }))
    expect(sent).toEqual({ feedback: 'good', comment: '' })
    expect(await screen.findByText(/Your Community Manager will see this/)).toBeTruthy()
  })

  it('explains a link that no longer works', async () => {
    api.mockRejectedValue(Object.assign(new Error('We couldn’t find this reservation. It may have been cancelled.'), { status: 404 }))
    showReservation()
    expect(await screen.findByText(/It may have been cancelled/)).toBeTruthy()
  })
})
