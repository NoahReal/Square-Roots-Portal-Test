import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { dateAndTime, longDate, money, pounds, shortDate } from '../../../format'
import PageHero from '../../../components/PageHero'

const STATUS_TAGS = {
  waiting: { text: 'Needs your answer', className: 'tag-waiting' },
  confirmed: { text: 'Confirmed', className: 'tag-confirmed' },
  cant_fill: { text: "Can't fill", className: 'tag-cant-fill' },
}

// Farm screen: Square Roots' orders from your farm, when they're picked up, and whether they're paid.
export default function PickupsPage() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api('/farm/orders/')
      .then(setOrders)
      .catch((err) => setError(err.message))
  }, [])

  async function respond(order, action, note) {
    const updated = await api(`/farm/orders/${order.id}/${action}/`, { method: 'POST', body: { note } })
    setOrders(orders.map((o) => (o.id === order.id ? updated : o)))
    setNotice(
      action === 'confirm'
        ? `Thanks! The ${updated.drop_cycle_name} order is confirmed. Pickup is ${dateAndTime(updated.pickup_at)}`
        : "Thanks for letting us know. We've told the Square Roots team.",
    )
  }

  const now = new Date()
  const isPast = (order) => new Date(order.pickup_at) < now
  const needsAnswer = orders?.filter((o) => o.status === 'waiting' && !isPast(o)) ?? []
  const upcoming = orders?.filter((o) => o.status !== 'waiting' && !isPast(o)) ?? []
  const past = orders?.filter(isPast).reverse() ?? []

  const nextPickup = upcoming.find((o) => o.status === 'confirmed')
  // Money is only owed once the produce has been picked up.
  const owed = past.filter((o) => o.status === 'confirmed' && o.payment === 'not_paid')
  const owedTotal = owed.reduce((sum, o) => sum + Number(o.total), 0)

  return (
    <>
      <PageHero title="Pickups" lead="Confirm orders and see pickup dates and payment status." />

      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!orders && !error && <p className="muted">Loading…</p>}

          {orders && (
            <div className="stat-tiles">
              <div className={'stat-tile' + (needsAnswer.length ? ' stat-tile-alert' : '')}>
                <span className="stat-label">Orders to answer</span>
                <span className="stat-value">{needsAnswer.length}</span>
              </div>
              <div className="stat-tile">
                <span className="stat-label">Next pickup</span>
                <span className="stat-value stat-value-small">
                  {nextPickup ? dateAndTime(nextPickup.pickup_at) : 'None confirmed yet'}
                </span>
              </div>
              <div className="stat-tile">
                <span className="stat-label">Owed for past pickups</span>
                <span className="stat-value">{money(owedTotal)}</span>
              </div>
            </div>
          )}

          {notice && (
            <div className="notice notice-success" role="status">
              {notice}
            </div>
          )}

          {needsAnswer.length > 0 && (
            <OrderGroup title="Needs your answer" hint="Please confirm by the day before pickup so we can plan the drop.">
              {needsAnswer.map((order) => (
                <OrderCard key={order.id} order={order} onRespond={respond} />
              ))}
            </OrderGroup>
          )}

          {orders && (
            <OrderGroup title="Upcoming pickups">
              {upcoming.length === 0 ? (
                <p className="muted">No confirmed pickups coming up.</p>
              ) : (
                upcoming.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </OrderGroup>
          )}

          {past.length > 0 && (
            <OrderGroup title="Past pickups">
              {past.map((order) => (
                <OrderCard key={order.id} order={order} past />
              ))}
            </OrderGroup>
          )}
        </div>
      </section>
    </>
  )
}

function OrderGroup({ title, hint, children }) {
  return (
    <section className="order-group">
      <h2>{title}</h2>
      {hint && <p className="muted">{hint}</p>}
      {children}
    </section>
  )
}

function OrderCard({ order, past, onRespond }) {
  const tag = past && order.status === 'waiting' ? { text: 'Not answered', className: '' } : STATUS_TAGS[order.status]
  const totalPounds = order.lines.reduce((sum, line) => sum + line.pounds, 0)

  return (
    <article className={'block block-white order-card order-' + order.status + (past ? ' order-past' : '')}>
      <header className="order-head">
        <div>
          <h3>{dateAndTime(order.pickup_at)}</h3>
          <p className="muted">For the {order.drop_cycle_name} on {longDate(order.drop_date)}</p>
        </div>
        <span className={'tag ' + tag.className}>{tag.text}</span>
      </header>

      {order.pickup_notes && (
        <p className="order-pickup-notes">
          <strong>Pickup:</strong> {order.pickup_notes}
        </p>
      )}

      <table className="order-lines">
        <thead>
          <tr>
            <th scope="col">Produce</th>
            <th scope="col" className="num">Pounds</th>
            <th scope="col" className="num">Price/lb</th>
            <th scope="col" className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.produce}</td>
              <td className="num">{pounds(line.pounds)}</td>
              <td className="num">{money(line.price_per_pound)}</td>
              <td className="num">{money(line.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Order total</th>
            <td className="num">{pounds(totalPounds)}</td>
            <td />
            <td className="num">
              <strong>{money(order.total)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      {order.status === 'cant_fill' && order.farm_note && (
        <p className="order-farm-note">
          <strong>Your note:</strong> {order.farm_note}
        </p>
      )}

      {order.status === 'confirmed' && <PaymentStatus order={order} />}

      {onRespond && order.status === 'waiting' && <RespondButtons order={order} onRespond={onRespond} />}
    </article>
  )
}

function PaymentStatus({ order }) {
  if (order.payment === 'paid') {
    return (
      <p className="payment payment-paid">
        <strong>Paid</strong> {order.paid_on && `on ${shortDate(order.paid_on)}`}
      </p>
    )
  }
  return (
    <p className="payment payment-due">
      <strong>Not paid yet.</strong> Square Roots pays within two weeks of pickup.
    </p>
  )
}

function RespondButtons({ order, onRespond }) {
  const [explaining, setExplaining] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send(action) {
    setBusy(true)
    setError('')
    try {
      await onRespond(order, action, note)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (explaining) {
    return (
      <div className="order-respond">
        <div className="field">
          <label htmlFor={`note-${order.id}`}>
            Tell the team why <span className="field-hint">(optional)</span>
          </label>
          <textarea
            id={`note-${order.id}`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Frost got the carrots, but we could do 200 lbs of beets instead"
          />
        </div>
        {error && <div className="notice notice-error">{error}</div>}
        <div className="button-row">
          <button className="btn btn-primary" disabled={busy} onClick={() => send('cant-fill')}>
            Send
          </button>
          <button className="btn" disabled={busy} onClick={() => setExplaining(false)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="order-respond">
      {error && <div className="notice notice-error">{error}</div>}
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy} onClick={() => send('confirm')}>
          Confirm order
        </button>
        <button className="btn" disabled={busy} onClick={() => setExplaining(true)}>
          Can't fill this order
        </button>
      </div>
    </div>
  )
}
