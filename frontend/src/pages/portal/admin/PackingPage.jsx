import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { dateAndTime, longDate, pounds, timeRange } from '../../../format'
import PageHero from '../../../components/PageHero'
import CyclePicker, { useChosenCycle } from '../../../components/CyclePicker'

// Admin screen: the packing and delivery sheet for a drop. Produce arrives at the sorting space,
// volunteers pack it into 10 lb bundles, then it goes out to each location and to home deliveries.
export default function PackingPage() {
  const { cycles, chosen, choose } = useChosenCycle()
  const [sheet, setSheet] = useState(null)

  useEffect(() => {
    if (!chosen) return
    setSheet(null)
    api(`/admin/cycles/${chosen.id}/logistics/`).then(setSheet)
  }, [chosen?.id])

  const shortBy = sheet ? sheet.pounds_needed - sheet.pounds_arriving : 0

  return (
    <>
      <PageHero title="Packing & Delivery" lead="What arrives from farms, how to pack it into 10 lb bundles, and where it all goes." />
      <section className="section">
        <div className="container">
          <div className="toolbar no-print">
            <CyclePicker cycles={cycles} chosen={chosen} onChoose={choose} />
            {sheet && (
              <button className="btn btn-small" onClick={() => window.print()}>
                Print this sheet
              </button>
            )}
          </div>
          {cycles && !sheet && <p className="muted">Loading…</p>}

          {sheet && (
            <>
              <h2 className="print-title">
                {sheet.name}: {longDate(sheet.drop_date)}
              </h2>
              <p>
                <strong>Sorting space:</strong>{' '}
                {sheet.staging_location || (
                  <span className="text-warning">
                    not set yet. <Link to="/portal/admin/settings">Add it in Settings</Link>
                  </span>
                )}
              </p>

              <section className="order-group">
                <h2>1. Arriving from farms</h2>
                {sheet.farm_orders.length === 0 && <p className="muted">Nothing bought for this drop yet.</p>}
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Farm</th>
                        <th scope="col">Pickup</th>
                        <th scope="col">Produce</th>
                        <th scope="col" className="num">Pounds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.farm_orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            {order.farm_name}
                            {!order.sent_at && <span className="tag tag-waiting print-hide-tag">Not sent yet</span>}
                            {order.status === 'waiting' && order.sent_at && <span className="tag tag-waiting">Not confirmed</span>}
                          </td>
                          <td>
                            {dateAndTime(order.pickup_at)}
                            {order.pickup_notes && (
                              <>
                                <br />
                                <span className="muted">{order.pickup_notes}</span>
                              </>
                            )}
                          </td>
                          <td>{order.lines.map((line) => `${line.produce} (${pounds(line.pounds)})`).join(', ')}</td>
                          <td className="num">{pounds(order.lines.reduce((sum, line) => sum + line.pounds, 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {shortBy > 0 && (
                  <div className="notice notice-error no-print">
                    {pounds(shortBy)} short of the {pounds(sheet.pounds_needed)} needed.{' '}
                    <Link to={`/portal/admin/farms?cycle=${sheet.id}`}>Buy more from farms</Link>
                  </div>
                )}
              </section>

              <section className="order-group">
                <h2>2. Packing guide</h2>
                <p>
                  Pack <strong>{sheet.bundles_total} bundles</strong> of 10 lbs. Each bundle gets about:
                </p>
                {sheet.sorting.length === 0 ? (
                  <p className="muted">The guide appears once produce is bought.</p>
                ) : (
                  <ul className="sorting-guide">
                    {sheet.sorting.map((item) => (
                      <li key={item.produce}>
                        <span className="sorting-amount">{item.per_bundle} lbs</span>
                        <span>
                          {item.produce} <span className="muted">({pounds(item.pounds)} in total)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="order-group">
                <h2>3. Out to locations</h2>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col">Drop</th>
                        <th scope="col" className="num">Bundles</th>
                        <th scope="col">Community Manager</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.sites.map((site) => (
                        <tr key={site.site}>
                          <td>
                            <strong>{site.site}</strong>
                            <br />
                            <span className="muted">{site.address}</span>
                          </td>
                          <td>{timeRange(site.starts_at, site.ends_at)}</td>
                          <td className="num">
                            {site.bundles ?? <span className="muted">none ordered</span>}
                            {site.deliveries > 0 && (
                              <>
                                <br />
                                <span className="muted">incl. {site.deliveries} home deliveries</span>
                              </>
                            )}
                          </td>
                          <td>
                            {site.managers.length === 0 ? (
                              <span className="muted">No one linked</span>
                            ) : (
                              site.managers.map((m) => (
                                <div key={m.name}>
                                  {m.name}
                                  {m.phone && (
                                    <>
                                      {' · '}
                                      <a href={`tel:${m.phone}`}>{m.phone}</a>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="order-group">
                <div className="list-heading">
                  <h2>4. Home deliveries</h2>
                  {sheet.deliveries.length > 0 && (
                    <a className="btn btn-small no-print" href={`/api/admin/cycles/${sheet.id}/deliveries.csv`} download>
                      Download for the delivery partner (CSV)
                    </a>
                  )}
                </div>
                {sheet.deliveries.length === 0 ? (
                  <p className="muted">No home deliveries for this drop.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Customer</th>
                          <th scope="col">Address</th>
                          <th scope="col" className="num">Bundles</th>
                          <th scope="col">From</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.deliveries.map((d) => (
                          <tr key={`${d.site}-${d.customer_name}`}>
                            <td>
                              {d.customer_name}
                              {d.phone && (
                                <>
                                  <br />
                                  <a href={`tel:${d.phone}`}>{d.phone}</a>
                                </>
                              )}
                            </td>
                            <td>{d.address}</td>
                            <td className="num">{d.bundles}</td>
                            <td>
                              {d.site}
                              <br />
                              <span className="muted">by {d.partner}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </>
  )
}
