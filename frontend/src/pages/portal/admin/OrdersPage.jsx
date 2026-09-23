import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { dateAndTime, longDate, money, pounds, shortDate } from '../../../format'
import PageHero from '../../../components/PageHero'
import CyclePicker, { useChosenCycle } from '../../../components/CyclePicker'

const STATUS_TAGS = {
  waiting: { text: 'Waiting for farm', className: 'tag-waiting' },
  confirmed: { text: 'Confirmed', className: 'tag-confirmed' },
  cant_fill: { text: "Can't fill", className: 'tag-cant-fill' },
}

// Admin screen: everything ordered for one drop cycle, turned into what to buy from each farm.
export default function OrdersPage() {
  const { cycles, chosen, choose } = useChosenCycle()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  function load(id) {
    return api(`/admin/cycles/${id}/`).then(setDetail)
  }

  useEffect(() => {
    if (!chosen) return
    setDetail(null)
    load(chosen.id)
  }, [chosen?.id])

  async function run(request) {
    setError('')
    try {
      await request()
      await load(chosen.id)
    } catch (err) {
      setError(err.data?.detail || err.message)
    }
  }

  const stillNeeded = detail ? Math.max(0, detail.pounds_needed - detail.pounds_bought) : 0
  const progress = detail?.pounds_needed ? Math.min(100, Math.round((detail.pounds_bought / detail.pounds_needed) * 100)) : 0

  return (
    <>
      <PageHero title="Orders" lead="See every site’s bundle order and the purchase list for each farm." />

      <section className="section">
        <div className="container">
          <div className="toolbar">
            <CyclePicker cycles={cycles} chosen={chosen} onChoose={choose} />
            {detail && (
              <button className="btn btn-small no-print" onClick={() => window.print()}>
                Print purchase lists
              </button>
            )}
          </div>
          {error && <div className="notice notice-error">{error}</div>}
          {cycles && !detail && <p className="muted">Loading…</p>}

          {detail && (
            <>
              <p className="cycle-dates">
                <strong>{longDate(detail.drop_date)}</strong> · ordering{' '}
                {detail.ordering_open ? `closes ${dateAndTime(detail.order_cutoff)}` : `closed ${dateAndTime(detail.order_cutoff)}`}
              </p>

              <div className="stat-tiles stat-tiles-4">
                <Tile label="Bundles ordered" value={detail.bundles_ordered} />
                <Tile label="Sites ordered" value={`${detail.sites_ordered} of ${detail.site_count}`} />
                <Tile label="Produce needed" value={pounds(detail.pounds_needed)} />
                <Tile label="Bought from farms" value={pounds(detail.pounds_bought)} alert={stillNeeded > 0} />
              </div>

              <div className="progress-block">
                <div className="progress-label">
                  <span>
                    <strong>{progress}%</strong> of the produce is bought
                  </span>
                  {stillNeeded > 0 && !detail.has_happened && (
                    <Link className="btn btn-small btn-primary no-print" to={`/portal/admin/farms?cycle=${detail.id}`}>
                      Buy {pounds(stillNeeded)} more from farms
                    </Link>
                  )}
                </div>
                <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="orders-layout">
                <section>
                  <h2>Site orders</h2>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col" className="num">Bundles</th>
                        <th scope="col" className="num">Pounds</th>
                        <th scope="col" className="num">Preordered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.site_drops.map((drop) => (
                        <tr key={drop.id}>
                          <td>
                            {drop.site_name}
                            {drop.drop_date !== detail.drop_date && (
                              <span className="muted"> ({shortDate(drop.drop_date)})</span>
                            )}
                          </td>
                          <td className="num">
                            {drop.bundles ?? (
                              <span className={drop.ordering_open ? 'muted' : 'text-warning'}>
                                {drop.ordering_open ? 'not yet' : 'no order'}
                              </span>
                            )}
                          </td>
                          <td className="num">{drop.bundles !== null ? pounds(drop.bundles * 10) : ''}</td>
                          <td className="num">{drop.preorder_bundles || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total</th>
                        <td className="num">{detail.bundles_ordered}</td>
                        <td className="num">{pounds(detail.pounds_needed)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </section>

                <section>
                  <h2>Purchase list by farm</h2>
                  {detail.farm_orders.length === 0 && (
                    <div className="block block-white">
                      <p className="muted">Nothing bought yet for this drop.</p>
                      <Link className="btn btn-small" to={`/portal/admin/farms?cycle=${detail.id}`}>
                        See what farms have
                      </Link>
                    </div>
                  )}
                  {detail.farm_orders.map((order) => (
                    <FarmOrderCard key={order.id} order={order} onRun={run} />
                  ))}
                </section>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function Tile({ label, value, alert }) {
  return (
    <div className={'stat-tile' + (alert ? ' stat-tile-alert' : '')}>
      <span className="stat-label">{label}</span>
      <span className="stat-value stat-value-medium">{value}</span>
    </div>
  )
}

function FarmOrderCard({ order, onRun }) {
  const tag = STATUS_TAGS[order.status]
  const beforePickup = new Date(order.pickup_at) > new Date()
  const totalPounds = order.lines.reduce((sum, line) => sum + line.pounds, 0)

  return (
    <article className={'block block-white order-card order-' + order.status}>
      <header className="order-head">
        <div>
          <h3>{order.farm_name}</h3>
          <p className="muted">Pickup {dateAndTime(order.pickup_at)}</p>
        </div>
        <span className={'tag ' + tag.className}>{tag.text}</span>
      </header>
      {order.farm_note && (
        <p className="order-farm-note">
          <strong>Farm says:</strong> {order.farm_note}
        </p>
      )}
      <table className="order-lines">
        <thead>
          <tr>
            <th scope="col">Produce</th>
            <th scope="col" className="num">Pounds</th>
            <th scope="col" className="num">Total</th>
            {beforePickup && (
              <th scope="col" className="no-print">
                <span className="visually-hidden">Remove</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td>
                {line.produce} <span className="muted">@ {money(line.price_per_pound)}</span>
              </td>
              <td className="num">{pounds(line.pounds)}</td>
              <td className="num">{money(line.total)}</td>
              {beforePickup && (
                <td className="num no-print">
                  <button
                    className="link-button"
                    onClick={() => onRun(() => api(`/admin/farm-order-lines/${line.id}/`, { method: 'DELETE' }))}
                    aria-label={`Remove ${line.produce}`}
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num">{pounds(totalPounds)}</td>
            <td className="num">
              <strong>{money(order.total)}</strong>
            </td>
            {beforePickup && <td className="no-print" />}
          </tr>
        </tfoot>
      </table>
      {order.status === 'confirmed' &&
        (order.payment === 'paid' ? (
          <p className="payment payment-paid">
            <strong>Paid</strong> {order.paid_on && `on ${shortDate(order.paid_on)}`}
          </p>
        ) : (
          <div className="button-row">
            <span className="payment payment-due">
              <strong>Not paid yet</strong>
            </span>
            <button
              className="btn btn-small no-print"
              onClick={() => onRun(() => api(`/admin/farm-orders/${order.id}/paid/`, { method: 'POST' }))}
            >
              Mark paid
            </button>
          </div>
        ))}
    </article>
  )
}
