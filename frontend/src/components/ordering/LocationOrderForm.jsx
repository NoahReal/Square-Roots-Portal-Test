import { useEffect, useState } from 'react'
import { api } from '../../api'
import { boxes, dateAndTime, dateAtTime, longDate, money, timeLeft } from '../../format'
import Stepper from '../Stepper'

const DEAL_WORDS = { good: '★ Good deal', pricey: '▲ Pricier than usual' }

// Community Manager: this cycle's order form for your route. Choose how many boxes of each item;
// totals add up as you go. Replaces filling in the highlighted cells on your tab of the spreadsheet.
export default function LocationOrderForm({ siteName }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/manager/order-forms/')
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <div className="notice notice-error">{error}</div>
  if (!data) return <p className="muted">Loading…</p>

  const open = data.forms.filter((f) => f.ordering_open)
  const closed = data.forms.filter((f) => !f.ordering_open)

  return (
    <>
      {open.length === 0 && (
        <div className="notice notice-info">
          There’s no order form open for {siteName} right now. The team will send a link when the next one is ready.
        </div>
      )}
      {open.map((form) => (
        <OpenForm key={form.id} initial={form} />
      ))}
      {closed.length > 0 && (
        <>
          <h2 className="past-orders-title">Recent orders</h2>
          {closed.map((form) => (
            <article key={form.id} className="block block-white closed-order">
              <div>
                <span className="tag">{form.status_label}</span>
                <h3>Delivered {longDate(form.delivery_date)}</h3>
              </div>
              <p className="closed-order-amount">
                {form.my_order.boxes ? (
                  <>
                    You ordered <strong>{boxes(form.my_order.boxes)}</strong> ({money(form.my_order.cost)}):{' '}
                    {form.items
                      .filter((i) => i.boxes)
                      .map((i) => `${i.boxes} ${i.product}`)
                      .join(', ')}
                    .
                  </>
                ) : (
                  <>You didn’t order on this form.</>
                )}
              </p>
            </article>
          ))}
        </>
      )}
    </>
  )
}

function OpenForm({ initial }) {
  const [form, setForm] = useState(initial)
  // What's been chosen on screen, by item id; saved with "Save my order".
  const [boxes, setBoxes] = useState(() => Object.fromEntries(initial.items.map((i) => [i.id, i.boxes])))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const changed = form.items.some((i) => (boxes[i.id] ?? 0) !== i.boxes)
  const totalBoxes = form.items.reduce((sum, i) => sum + (boxes[i.id] ?? 0), 0)
  const totalCost = form.items.reduce((sum, i) => sum + (boxes[i.id] ?? 0) * Number(i.price), 0)

  // Group items by supplier, like the tabs and sections people know from the spreadsheet.
  const suppliers = [...new Set(form.items.map((i) => i.supplier))]

  function set(itemId, value) {
    setBoxes((current) => ({ ...current, [itemId]: value }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const updated = await api(`/manager/order-forms/${form.id}/order/`, { method: 'PUT', body: { lines: boxes } })
      setForm(updated)
      setBoxes(Object.fromEntries(updated.items.map((i) => [i.id, i.boxes])))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <article className="order-form-card">
      <div className="block block-yellow order-form-head">
        <span className="eyebrow-label">Order form</span>
        <h2>Delivered {longDate(form.delivery_date)}</h2>
        <p>
          Order by <strong>{dateAndTime(form.orders_due)}</strong> ({timeLeft(form.orders_due)}). Market usually{' '}
          {longDate(form.market_date)}.
        </p>
        {form.notes && <p className="order-form-note">{form.notes}</p>}
      </div>

      {suppliers.map((supplier) => (
        <section key={supplier} className="block block-white order-supplier">
          <h3>{supplier}</h3>
          <ul className="order-items">
            {form.items
              .filter((i) => i.supplier === supplier)
              .map((item) => (
                <li key={item.id} className={'order-item' + ((boxes[item.id] ?? 0) > 0 ? ' order-item-on' : '')}>
                  <div className="order-item-what">
                    <strong>{item.product}</strong>
                    <span className="muted">
                      {item.box_size && `${item.box_size} · `}
                      {money(item.price)} a box
                      {item.available !== null && ` · ${item.available} available`}
                    </span>
                    {item.deal && <span className={'deal deal-' + item.deal}>{DEAL_WORDS[item.deal]}</span>}
                    {item.note && <span className="order-item-note">{item.note}</span>}
                    {item.last_time !== null && item.last_time !== undefined && (
                      <span className="muted">
                        Last time: {item.last_time} {item.last_time === 1 ? 'box' : 'boxes'}
                      </span>
                    )}
                  </div>
                  <div className="order-item-count">
                    <Stepper
                      id={`boxes-${item.id}`}
                      value={boxes[item.id] ?? 0}
                      onChange={(value) => set(item.id, value)}
                      min={0}
                      max={200}
                      size="small"
                      label={`boxes of ${item.product}`}
                    />
                    <span className="order-item-cost">{money((boxes[item.id] ?? 0) * Number(item.price))}</span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <div className="order-total-bar">
        <div>
          <span className="order-total-label">Your order</span>
          <span className="order-total">
            {totalBoxes} {totalBoxes === 1 ? 'box' : 'boxes'} · {money(totalCost)}
          </span>
        </div>
        <button className="btn btn-primary btn-large" onClick={save} disabled={saving || !changed}>
          {saving ? 'Saving…' : changed ? 'Save my order' : 'Order saved'}
        </button>
      </div>
      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {saved && !changed && (
        <div className="notice notice-success" role="status">
          Your order is saved. You can change it until {dateAtTime(form.orders_due)}
        </div>
      )}
    </article>
  )
}
