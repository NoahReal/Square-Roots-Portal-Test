import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { money, shortDate } from '../../../format'
import PageHero from '../../../components/PageHero'

const FILTERS = [
  { value: 'owed', label: 'Waiting for payment' },
  { value: 'all', label: 'All drops' },
]

// Admin screen: what each drop collected, what its Community Manager owes Square Roots, and payments received.
export default function MoneyPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('owed')
  const [notice, setNotice] = useState('')

  function load() {
    return api(`/admin/money/?year=${year}`).then(setData)
  }

  useEffect(() => {
    setData(null)
    load()
  }, [year])

  async function setReceived(row, received) {
    await api(`/admin/money/${row.site_drop_id}/received/`, { method: received ? 'POST' : 'DELETE' })
    await load()
    setNotice(
      received
        ? `Recorded ${money(row.owed_to_square_roots)} from ${row.site} for the ${row.cycle_name}.`
        : `Marked ${row.site}'s payment for the ${row.cycle_name} as not received.`,
    )
  }

  const owes = (row) => Number(row.owed_to_square_roots) > 0
  const rows = data?.statements.filter((row) => filter === 'all' || (owes(row) && !row.remittance_received_on)) ?? []
  const totals = data?.totals

  return (
    <>
      <PageHero
        title="Money"
        lead="What each drop collected on the sliding scale, what its Community Manager owes Square Roots, and payments received."
      />
      <section className="section">
        <div className="container">
          <div className="toolbar">
            <div className="field cycle-picker">
              <label htmlFor="money-year">Year</label>
              <select id="money-year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[year, year - 1, year - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <a className="btn btn-primary" href={`/api/admin/money.csv?year=${year}`} download>
              Download CSV
            </a>
          </div>

          {!data && <p className="muted">Loading…</p>}
          {totals && (
            <div className="stat-tiles stat-tiles-4">
              <Tile label="Waiting for payment" value={money(totals.outstanding)} detail={`${totals.outstanding_count} drops`} alert={totals.outstanding_count > 0} />
              <Tile label="Collected at drops" value={money(totals.collected)} />
              <Tile label="Owed to Square Roots" value={money(totals.owed_to_square_roots)} />
              <Tile label="Kept by Community Managers" value={money(totals.manager_keeps)} detail={`incl. ${money(totals.donations)} donations`} />
            </div>
          )}
          {totals && (
            <p className="muted sliding-scale-line">
              Sliding scale this year: {totals.bundles_standard.toLocaleString('en-CA')} standard,{' '}
              {totals.bundles_at_cost.toLocaleString('en-CA')} at cost and{' '}
              <strong>{totals.bundles_free.toLocaleString('en-CA')} free</strong> bundles.
            </p>
          )}

          {notice && (
            <div className="notice notice-success" role="status">
              {notice}
            </div>
          )}

          {data && (
            <>
              <div className="tabs" role="tablist">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    role="tab"
                    aria-selected={filter === option.value}
                    className={'tab' + (filter === option.value ? ' active' : '')}
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {rows.length === 0 ? (
                <div className="notice notice-success">Every drop is paid up.</div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Drop</th>
                        <th scope="col" className="num">Standard / at cost / free</th>
                        <th scope="col" className="num">Collected</th>
                        <th scope="col" className="num">Owed</th>
                        <th scope="col" className="num">They keep</th>
                        <th scope="col">Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.site_drop_id}>
                          <td>
                            <strong>{row.site}</strong>
                            <br />
                            <span className="muted">
                              {shortDate(row.drop_date)}
                              {row.managers.length > 0 && ` · ${row.managers.join(', ')}`}
                              {row.first_drop && ' · first drop'}
                            </span>
                          </td>
                          <td className="num">
                            {row.bundles_standard} / {row.bundles_at_cost} / {row.bundles_free}
                          </td>
                          <td className="num">{money(row.collected)}</td>
                          <td className="num">{money(row.owed_to_square_roots)}</td>
                          <td className="num">{money(row.manager_keeps)}</td>
                          <td>
                            {!owes(row) ? (
                              <span className="muted">Nothing owed</span>
                            ) : row.remittance_received_on ? (
                              <span className="payment-received">
                                Received {shortDate(row.remittance_received_on)}{' '}
                                <button className="link-button" onClick={() => setReceived(row, false)}>
                                  Undo
                                </button>
                              </span>
                            ) : (
                              <button className="btn btn-small btn-primary" onClick={() => setReceived(row, true)}>
                                Mark received
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="muted money-footnote">
                How it's worked out: a Community Manager owes the at-cost price for each bundle sold at the standard or
                at-cost price (a lower first-drop price at a brand-new location). Free bundles cost them nothing, and
                they keep the rest plus any donations. Prices are on the Settings screen.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function Tile({ label, value, detail, alert }) {
  return (
    <div className={'stat-tile' + (alert ? ' stat-tile-alert' : '')}>
      <span className="stat-label">{label}</span>
      <span className="stat-value stat-value-medium">{value}</span>
      {detail && <span className="muted">{detail}</span>}
    </div>
  )
}
