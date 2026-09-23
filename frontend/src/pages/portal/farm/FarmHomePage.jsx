import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { dateAndTime, money, pounds } from '../../../format'
import PageHero from '../../../components/PageHero'
import { ScreenCards, TodoList } from '../../../components/Dashboard'

// Farm home: orders to answer, the next pickup, and your posted produce.
export default function FarmHomePage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [produce, setProduce] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api('/farm/orders/'), api('/farm/produce/')])
      .then(([o, p]) => {
        setOrders(o)
        setProduce(p)
      })
      .catch((err) => setError(err.message))
  }, [])

  const now = new Date()
  const upcoming = orders?.filter((o) => new Date(o.pickup_at) > now) ?? []
  const toAnswer = upcoming.filter((o) => o.status === 'waiting')
  const nextPickup = upcoming.find((o) => o.status === 'confirmed')
  const owed = (orders ?? []).filter((o) => new Date(o.pickup_at) <= now && o.status === 'confirmed' && o.payment === 'not_paid')
  const expired = produce?.filter((p) => p.expired) ?? []
  const available = produce?.filter((p) => !p.expired) ?? []

  const items = []
  if (toAnswer.length) {
    items.push({
      count: toAnswer.length,
      title: toAnswer.length === 1 ? 'Order needs your answer' : 'Orders need your answer',
      detail: toAnswer.map((o) => `${o.drop_cycle_name}: ${money(o.total)}, pickup ${dateAndTime(o.pickup_at)}`).join('; '),
      to: '/portal/farm/pickups',
      action: 'Answer',
    })
  }
  if (expired.length) {
    items.push({
      count: expired.length,
      title: 'Produce past its date',
      detail: `${expired.map((p) => p.produce).join(', ')}. Update the date or mark it sold out.`,
      to: '/portal/farm/produce',
      action: 'Update',
    })
  }
  if (produce && available.length === 0) {
    items.push({
      title: 'Nothing posted right now',
      detail: 'Post any seconds produce you have so Square Roots can order it.',
      to: '/portal/farm/produce',
      action: 'Post produce',
    })
  }

  return (
    <>
      <PageHero title={`Welcome, ${user.first_name}`} lead={user.farm_name ?? ''} />
      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!orders && !error && <p className="muted">Loading…</p>}
          {orders && (
            <div className="dashboard-layout">
              <section>
                <h2>To do</h2>
                <TodoList items={items} doneText="You're all caught up. Thanks for helping reduce food waste!" />
              </section>
              <aside>
                <article className="block block-yellow cycle-card">
                  <span className="eyebrow-label">Next pickup</span>
                  {nextPickup ? (
                    <>
                      <h3>{dateAndTime(nextPickup.pickup_at)}</h3>
                      <p>
                        {nextPickup.drop_cycle_name} · {pounds(nextPickup.lines.reduce((s, l) => s + l.pounds, 0))} ·{' '}
                        {money(nextPickup.total)}
                      </p>
                    </>
                  ) : (
                    <h3>None confirmed yet</h3>
                  )}
                  <dl className="cycle-card-numbers">
                    <div>
                      <dt>Produce posted</dt>
                      <dd>{pounds(available.reduce((s, p) => s + p.pounds, 0))}</dd>
                    </div>
                    <div>
                      <dt>Owed to you</dt>
                      <dd>{money(owed.reduce((s, o) => s + Number(o.total), 0))}</dd>
                    </div>
                  </dl>
                  <Link to="/portal/farm/pickups" className="btn btn-small">
                    See pickups
                  </Link>
                </article>
              </aside>
            </div>
          )}
          <ScreenCards role="farm" />
        </div>
      </section>
    </>
  )
}
