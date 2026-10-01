import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { dateAndTime, longDate, money, pounds, shortDate, timeLeft, timeRange } from '../../../format'
import PageHero from '../../../components/PageHero'
import { ScreenCards, TodoList } from '../../../components/Dashboard'

// Community Manager home: your next drop, and anything waiting for you.
export default function ManagerHomePage() {
  const { user } = useAuth()
  const [drops, setDrops] = useState(null)
  const [forms, setForms] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api('/manager/drops/')
      .then(setDrops)
      .catch((err) => setError(err.message))
    // Locations whose route has switched to order forms order boxes instead of bundles.
    if (user.uses_order_forms) api('/manager/order-forms/').then((data) => setForms(data.forms))
  }, [user.uses_order_forms])

  const next = drops?.find((d) => !d.has_happened)
  const openNotOrdered = drops?.filter((d) => d.ordering_open && d.bundles === null) ?? []
  const toLog = drops?.filter((d) => d.has_happened && d.bundles !== null && !d.report) ?? []

  const items = []
  const openForm = forms.find((f) => f.ordering_open)
  if (openForm) {
    items.push({
      title: openForm.my_order.boxes ? `Your order: ${openForm.my_order.boxes} boxes` : 'Fill in this week’s order form',
      detail: `Due ${dateAndTime(openForm.orders_due)} (${timeLeft(openForm.orders_due)}). Trucks deliver ${longDate(openForm.delivery_date)}.`,
      to: '/portal/manager/order',
      action: openForm.my_order.boxes ? 'Change it' : 'Order now',
    })
  }
  if (user.runs_hub) {
    items.push({
      title: 'Your hub',
      detail: 'What arrives for each location you take deliveries for, and your share for sorting.',
      to: '/portal/manager/hub',
      action: 'Open',
    })
  }
  if (!user.uses_order_forms && openNotOrdered[0]) {
    const drop = openNotOrdered[0]
    items.push({
      title: `Order for the ${drop.cycle_name}`,
      detail: `Order by ${dateAndTime(drop.order_cutoff)} (${timeLeft(drop.order_cutoff)})`,
      to: '/portal/manager/order',
      action: 'Order now',
    })
  }
  const unpaid = drops?.filter((d) => d.statement && Number(d.statement.owed_to_square_roots) > 0 && !d.statement.remittance_received_on) ?? []
  if (unpaid.length) {
    const total = unpaid.reduce((sum, d) => sum + Number(d.statement.owed_to_square_roots), 0)
    items.push({
      count: unpaid.length,
      title: `Pay Square Roots ${money(total)}`,
      detail: `For ${unpaid.map((d) => d.cycle_name).join(', ')}. The team will mark it received.`,
      to: '/portal/manager/after-drop',
      action: 'See statement',
    })
  }
  if (toLog.length) {
    items.push({
      count: toLog.length,
      title: toLog.length === 1 ? 'Drop to log' : 'Drops to log',
      detail: `How did it go? ${toLog.map((d) => d.cycle_name).join(', ')}`,
      to: '/portal/manager/after-drop',
      action: 'Log it',
    })
  }

  return (
    <>
      <PageHero title={`Welcome, ${user.first_name}`} lead={user.site_name ? `Your Square Roots location: ${user.site_name}` : ''} />
      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!drops && !error && <p className="muted">Loading…</p>}
          {drops && (
            <div className="dashboard-layout">
              <section>
                <h2>To do</h2>
                <TodoList items={items} doneText="You're all set. Your next order is in and every drop is logged." />
              </section>
              <aside>
                {next ? (
                  <article className="block block-yellow cycle-card">
                    <span className="eyebrow-label">Next drop</span>
                    <h3>{longDate(next.drop_date)}</h3>
                    <p>{timeRange(next.starts_at, next.ends_at)}</p>
                    <dl className="cycle-card-numbers">
                      <div>
                        <dt>Your order</dt>
                        <dd>{next.bundles === null ? 'Not yet' : `${next.bundles} bundles`}</dd>
                      </div>
                      <div>
                        <dt>Preorders</dt>
                        <dd>
                          {next.preorder_count} ({next.preorder_bundles} bundles)
                        </dd>
                      </div>
                    </dl>
                    <p className="muted-dark">
                      {next.ordering_open
                        ? `You can change your order until ${shortDate(next.order_cutoff.slice(0, 10))}.`
                        : `Ordering closed. ${next.bundles ? `${pounds(next.bundles * 10)} of produce is on its way.` : ''}`}
                    </p>
                    <div className="button-row">
                      <Link to="/portal/manager/preorders" className="btn btn-small">
                        Preorders
                      </Link>
                      {next.ordering_open && (
                        <Link to="/portal/manager/order" className="btn btn-small">
                          Order
                        </Link>
                      )}
                    </div>
                  </article>
                ) : (
                  <div className="block block-white">
                    <p className="muted">No drops scheduled yet. The Square Roots team will open the next one soon.</p>
                  </div>
                )}
              </aside>
            </div>
          )}
          <ScreenCards role="community_manager" />
        </div>
      </section>
    </>
  )
}
