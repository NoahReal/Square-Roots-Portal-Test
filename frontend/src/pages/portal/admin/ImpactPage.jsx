import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { pounds, shortDate } from '../../../format'
import PageHero from '../../../components/PageHero'

// Admin screen: what Square Roots achieved this year, with a spreadsheet download.
export default function ImpactPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api(`/admin/impact/?year=${year}`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [year])

  const totals = data?.totals

  return (
    <>
      <PageHero title="Impact" lead="Pounds diverted, bundles sold, sites active. Download as CSV." />

      <section className="section">
        <div className="container">
          <div className="toolbar">
            <div className="field cycle-picker">
              <label htmlFor="year">Year</label>
              <select id="year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {(data?.years ?? [year]).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {/* A normal link, so the browser downloads the file using the logged-in session. */}
            <a className="btn btn-primary" href={`/api/admin/impact.csv?year=${year}`} download>
              Download CSV
            </a>
          </div>
          {error && <div className="notice notice-error">{error}</div>}
          {!data && !error && <p className="muted">Loading…</p>}

          {data && (
            <>
              <div className="hero-numbers">
                <HeroNumber value={pounds(totals.pounds_diverted)} label="of produce diverted from waste" />
                <HeroNumber value={totals.bundles_sold.toLocaleString('en-CA')} label="bundles sold to communities" />
                <HeroNumber value={totals.sites_active} label="locations active" />
                <HeroNumber value={totals.drops_held} label="drops held" />
              </div>

              {data.reports_missing > 0 && (
                <div className="notice notice-error">
                  {data.reports_missing} {data.reports_missing === 1 ? 'drop is' : 'drops are'} still waiting for an
                  after-drop report, so bundles sold may be a little low.
                </div>
              )}

              {data.by_cycle.length === 0 ? (
                <p className="muted">No drops have happened in {year} yet.</p>
              ) : (
                <>
                  <section className="chart-block block block-white">
                    <h2>Bundles sold at each drop</h2>
                    <p className="muted">All locations together. Hover or tap a bar for the numbers.</p>
                    <ColumnChart
                      rows={data.by_cycle}
                      value={(c) => c.bundles_sold}
                      label={(c) => shortDate(c.drop_date)}
                      tooltip={(c) =>
                        `${c.name}: ${c.bundles_sold} bundles sold at ${c.sites} locations, ${pounds(c.pounds_diverted)} bought from farms`
                      }
                    />
                    <details className="chart-table">
                      <summary>See the numbers</summary>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">Drop</th>
                            <th scope="col" className="num">Locations</th>
                            <th scope="col" className="num">Bundles sold</th>
                            <th scope="col" className="num">Bought from farms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.by_cycle.map((c) => (
                            <tr key={c.drop_date}>
                              <td>{c.name}</td>
                              <td className="num">{c.sites}</td>
                              <td className="num">{c.bundles_sold}</td>
                              <td className="num">{pounds(c.pounds_diverted)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </section>

                  <div className="impact-columns">
                    <section className="block block-white">
                      <h2>By location</h2>
                      <BarList
                        rows={data.by_site}
                        value={(s) => s.bundles_sold}
                        name={(s) => s.site}
                        detail={(s) => `${s.bundles_sold} bundles · ${s.drops} drops`}
                      />
                    </section>

                    <section className="block block-white">
                      <h2>Leftover bundles</h2>
                      {data.leftovers.length === 0 ? (
                        <p className="muted">Every bundle sold. Nothing left over!</p>
                      ) : (
                        <>
                          <p className="muted">
                            {data.leftovers.reduce((sum, l) => sum + l.bundles, 0)} bundles weren't sold. Here's where
                            they went.
                          </p>
                          <BarList
                            rows={data.leftovers}
                            value={(l) => l.bundles}
                            name={(l) => l.label}
                            detail={(l) => `${l.bundles} bundles`}
                          />
                        </>
                      )}
                      <p className="muted impact-footnote">
                        Farms supplying this year: {totals.farms_supplying}. Pounds diverted counts produce bought from
                        farms and picked up. <Link to="/portal/admin/orders">See orders</Link>
                      </p>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

function HeroNumber({ value, label }) {
  return (
    <div className="hero-number">
      <span className="hero-number-value">{value}</span>
      <span className="hero-number-label">{label}</span>
    </div>
  )
}

// Vertical bars over time. One series, so one colour and no legend; each bar has a tooltip.
function ColumnChart({ rows, value, label, tooltip }) {
  const max = Math.max(...rows.map(value), 1)
  // About six date labels, evenly spaced, so they never run into each other on a phone.
  const labelEvery = Math.max(1, Math.ceil(rows.length / 6))
  return (
    <div className="column-chart" role="group" aria-label="Bar chart of bundles sold at each drop. The numbers are also in the table below.">
      <div className="column-chart-plot">
        {rows.map((row, i) => (
          <div key={i} className="column" tabIndex={0} data-tip={tooltip(row)} aria-label={tooltip(row)}>
            <div className="column-bar" style={{ height: `${(value(row) / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="column-chart-axis" aria-hidden="true">
        {rows.map((row, i) => (
          <span key={i}>{i % labelEvery === 0 ? label(row) : ''}</span>
        ))}
      </div>
    </div>
  )
}

// Horizontal bars with the name and number written beside each one.
function BarList({ rows, value, name, detail }) {
  const max = Math.max(...rows.map(value), 1)
  return (
    <ul className="bar-list">
      {rows.map((row) => (
        <li key={name(row)} title={detail(row)}>
          <div className="bar-list-text">
            <span>{name(row)}</span>
            <span className="muted">{detail(row)}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(value(row) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
