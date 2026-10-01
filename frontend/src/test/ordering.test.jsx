import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '../api'
import LocationOrderForm from '../components/ordering/LocationOrderForm'
import { PriceListTable } from '../components/ordering/PriceListParts'
import { fakeApi } from './helpers'

vi.mock('../api', () => ({ api: vi.fn() }))

const inDays = (n) => new Date(Date.now() + n * 86_400_000)
const FORM = {
  id: 7, delivery_date: inDays(9).toISOString().slice(0, 10), market_date: inDays(10).toISOString().slice(0, 10),
  orders_due: inDays(6).toISOString(), status: 'open', status_label: 'Open for orders', ordering_open: true,
  notes: 'Great prices on cabbage.',
  items: [
    { id: 1, supplier: 'Ketty Brow’s', product: 'Carrots', box_size: '50 lb', price: '22.50', available: 60, deal: '', note: '', boxes: 0, last_time: 4 },
    { id: 2, supplier: 'Ketty Brow’s', product: 'Green cabbage', box_size: '50 lb', price: '15.00', available: 30, deal: 'good', note: '', boxes: 0, last_time: null },
    { id: 3, supplier: 'Footes Family Farm', product: 'Kale', box_size: 'case of 24', price: '28.00', available: 10, deal: '', note: '', boxes: 0, last_time: null },
  ],
  my_order: { boxes: 0, cost: '0.00', updated_at: null },
}

describe('the order form', () => {
  it('adds up boxes and cost, and saves the order', async () => {
    const user = userEvent.setup()
    let sent
    fakeApi(api, {
      '/manager/order-forms/': { uses_order_forms: true, forms: [FORM] },
      'PUT /manager/order-forms/7/order/': (body) => {
        sent = body
        return { ...FORM, items: FORM.items.map((i) => ({ ...i, boxes: body.lines[i.id] })) }
      },
    })
    render(<LocationOrderForm siteName="Dartmouth" />)

    expect(await screen.findByText('Great prices on cabbage.')).toBeTruthy()
    expect(screen.getByText('★ Good deal')).toBeTruthy()
    expect(screen.getByText('Last time: 4 boxes')).toBeTruthy()
    await user.click(screen.getByLabelText('More boxes of Carrots'))
    await user.click(screen.getByLabelText('More boxes of Carrots'))
    await user.click(screen.getByLabelText('More boxes of Kale'))
    expect(screen.getByText('3 boxes · $73.00')).toBeTruthy() // 2 × $22.50 + $28
    await user.click(screen.getByRole('button', { name: 'Save my order' }))
    expect(sent.lines).toEqual({ 1: 2, 2: 0, 3: 1 })
    expect(await screen.findByText(/Your order is saved/)).toBeTruthy()
  })

  it('says when no form is open', async () => {
    fakeApi(api, { '/manager/order-forms/': { uses_order_forms: true, forms: [] } })
    render(<LocationOrderForm siteName="Dartmouth" />)
    expect(await screen.findByText(/no order form open for Dartmouth/)).toBeTruthy()
  })
})

describe('price lists', () => {
  it('show changes in words, not just colour', () => {
    render(
      <PriceListTable
        list={{
          compared_with: 'October 3 drop',
          gone: [{ product: 'Parsnips', price: '18.00' }],
          items: [
            { id: 1, product: 'Carrots', box_size: '50 lb', price: '22.50', available: 60, notes: '', change: 'up', old_price: '21.00' },
            { id: 2, product: 'Leeks', box_size: 'case of 12', price: '16.00', available: null, notes: '', change: 'new', old_price: null },
          ],
        }}
      />,
    )
    expect(screen.getByText('▲ up from $21.00')).toBeTruthy()
    expect(screen.getByText('New')).toBeTruthy()
    expect(screen.getByText(/Not on this list any more: Parsnips/)).toBeTruthy()
  })
})
