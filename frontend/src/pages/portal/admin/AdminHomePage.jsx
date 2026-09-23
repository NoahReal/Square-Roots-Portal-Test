import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { dateAndTime, longDate, money, pounds, shortDate, timeLeft } from '../../../format'
import PageHero from '../../../components/PageHero'
import { ScreenCards, TodoList } from '../../../components/Dashboard'

// Admin home: what needs doing today, and how the next drop is coming together.
export default function AdminHomePage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/admin/dashboard/')
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <PageHero title={`Welcome, ${user.first_name}`} lead="Here's what needs doing for Square Roots right now." />
      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!data && !error && <p className="muted">Loading…</p>}
          {data && (
            <div className="dashboard-layout">
              <section>
                <h2>To do</h2>
                <TodoList items={todos(data)} doneText="You're all caught up. Nothing needs you right now." />
              </section>
              <aside>
                {data.next_cycle && <CycleCard title="Next drop" cycle={data.next_cycle} />}
                {data.open_cycle && <CycleCard title="Ordering now" cycle={data.open_cycle} />}
              </aside>
            </div>
          )}
          <ScreenCards role="admin" />
        </div>
      </section>
    </>
  )
}

function todos(data) {
  const items = []
  const cycle = data.open_cycle ?? data.next_cycle

  if (data.signups_waiting) {
    items.push({
      count: data.signups_waiting,
      title: data.signups_waiting === 1 ? 'Sign-up waiting for approval' : 'Sign-ups waiting for approval',
      to: '/portal/admin/signups',
      action: 'Review',
    })
  }
  if (data.sites_not_ordered.length && cycle?.ordering_open) {
    items.push({
      count: data.sites_not_ordered.length,
      title: `Sites haven't ordered for the ${cycle.name} (ordering closes in ${timeLeft(cycle.order_cutoff).replace(' left', '')})`,
      detail: data.sites_not_ordered.join(', '),
      to: `/portal/admin/orders?cycle=${cycle.id}`,
      action: 'See orders',
    })
  }
  for (const c of [data.next_cycle, data.open_cycle].filter(Boolean)) {
    const still = c.pounds_needed - c.pounds_bought
    if (still > 0) {
      items.push({
        title: `Buy ${pounds(still)} more produce for the ${c.name}`,
        detail: `${pounds(c.pounds_bought)} of ${pounds(c.pounds_needed)} bought so far`,
        to: `/portal/admin/farms?cycle=${c.id}`,
        action: 'Buy from farms',
      })
    }
  }
  if (data.farms_waiting.length) {
    items.push({
      count: data.farms_waiting.length,
      title: data.farms_waiting.length === 1 ? "Farm hasn't confirmed its order" : "Farms haven't confirmed their orders",
      detail: data.farms_waiting.map((o) => `${o.farm} (${o.cycle_name}, pickup ${dateAndTime(o.pickup_at)})`).join('; '),
      to: `/portal/admin/orders?cycle=${data.farms_waiting[0].cycle_id}`,
      action: 'See orders',
    })
  }
  if (data.unpaid_farm_orders.length) {
    const total = data.unpaid_farm_orders.reduce((sum, o) => sum + Number(o.total), 0)
    items.push({
      count: data.unpaid_farm_orders.length,
      title: `Farm ${data.unpaid_farm_orders.length === 1 ? 'order' : 'orders'} picked up but not paid (${money(total)})`,
      detail: data.unpaid_farm_orders.map((o) => `${o.farm}, ${o.cycle_name}: ${money(o.total)}`).join('; '),
      to: `/portal/admin/orders?cycle=${data.unpaid_farm_orders[0].cycle_id}`,
      action: 'Mark paid',
    })
  }
  if (data.reports_missing.length) {
    items.push({
      count: data.reports_missing.length,
      title: 'After-drop reports not logged yet',
      detail:
        data.reports_missing.map((r) => `${r.site} (${shortDate(r.drop_date)})`).join(', ') +
        '. Their Community Managers log these on their After Drop screen.',
      to: '/portal/admin/people?role=community_manager',
      action: 'Contact them',
    })
  }
  return items
}

function CycleCard({ title, cycle }) {
  const progress = cycle.pounds_needed ? Math.min(100, Math.round((cycle.pounds_bought / cycle.pounds_needed) * 100)) : 0
  return (
    <article className="block block-yellow cycle-card">
      <span className="eyebrow-label">{title}</span>
      <h3>{cycle.name}</h3>
      <p>{longDate(cycle.drop_date)}</p>
      <p className="muted-dark">
        {cycle.ordering_open ? `Ordering closes ${dateAndTime(cycle.order_cutoff)}` : 'Ordering is closed'}
      </p>
      <dl className="cycle-card-numbers">
        <div>
          <dt>Sites ordered</dt>
          <dd>
            {cycle.sites_ordered} of {cycle.site_count}
          </dd>
        </div>
        <div>
          <dt>Bundles</dt>
          <dd>{cycle.bundles_ordered}</dd>
        </div>
      </dl>
      <p className="cycle-card-progress-label">
        {pounds(cycle.pounds_bought)} of {pounds(cycle.pounds_needed)} bought
      </p>
      <div className="progress progress-on-yellow" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <Link to={`/portal/admin/orders?cycle=${cycle.id}`} className="btn btn-small">
        Open orders
      </Link>
    </article>
  )
}
